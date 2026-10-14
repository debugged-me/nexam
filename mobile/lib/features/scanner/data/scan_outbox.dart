import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_exception.dart';
import 'scan_api.dart';

/// Mint a client-side idempotency key — stable across retries of the same
/// submission, and unique enough that two devices of one instructor never
/// collide. No uuid dependency: millisecond clock + secure random suffix.
String mintClientScanId() {
  final ts = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  final rnd = Random.secure().nextInt(1 << 31).toRadixString(36);
  return 'm$ts$rnd';
}

/// One queued scan submission — every field POST /api/scans needs, captured
/// at review time so a network failure loses nothing.
class PendingScan {
  PendingScan({
    required this.clientScanId,
    required this.examId,
    required this.answers,
    this.examSetId,
    this.set,
    this.studentName,
    this.studentNumber,
    DateTime? queuedAt,
    this.attempts = 0,
    this.lastError,
  }) : queuedAt = queuedAt ?? DateTime.now();

  final String clientScanId;
  final String examId;
  final String? examSetId;
  final String? set;
  final String? studentName;
  final String? studentNumber;
  final List<ScannedAnswer> answers;
  final DateTime queuedAt;
  int attempts;
  String? lastError;

  Map<String, dynamic> toJson() => {
        'clientScanId': clientScanId,
        'examId': examId,
        'examSetId': examSetId,
        'set': set,
        'studentName': studentName,
        'studentNumber': studentNumber,
        'answers': answers.map((a) => a.toJson()).toList(),
        'queuedAt': queuedAt.toIso8601String(),
        'attempts': attempts,
        'lastError': lastError,
      };

  factory PendingScan.fromJson(Map<String, dynamic> json) {
    final answers = (json['answers'] as List? ?? [])
        .map((a) => ScannedAnswer(
              itemNumber:
                  int.tryParse(a['itemNumber']?.toString() ?? '') ?? 0,
              markedAnswer: a['markedAnswer']?.toString() ?? '',
              ambiguous:
                  a['ambiguous'] == true || a['ambiguous'] == 1,
            ))
        .toList();
    return PendingScan(
      clientScanId: json['clientScanId']?.toString() ?? '',
      examId: json['examId']?.toString() ?? '',
      examSetId: json['examSetId']?.toString(),
      set: json['set']?.toString(),
      studentName: json['studentName']?.toString(),
      studentNumber: json['studentNumber']?.toString(),
      answers: answers,
      queuedAt: DateTime.tryParse(json['queuedAt']?.toString() ?? ''),
      attempts: int.tryParse(json['attempts']?.toString() ?? '') ?? 0,
      lastError: json['lastError']?.toString(),
    );
  }
}

/// Result of one outbox flush pass.
class FlushOutcome {
  const FlushOutcome({
    this.synced = 0,
    this.stillPending = 0,
    this.sessionExpired = false,
  });

  final int synced;
  final int stillPending;
  final bool sessionExpired;
}

/// Offline outbox for scan submissions.
///
/// A scan that fails to reach the server (dead network, timeout) is stored
/// here under the instructor's own key — so a different account on the same
/// device can never flush someone else's sheets. On the next successful
/// connection the entries replay oldest-first; the server dedupes on
/// `clientScanId`, so replaying an entry whose original request actually
/// landed returns the stored result instead of duplicating the scan.
class ScanOutbox {
  ScanOutbox._(this._prefs, this._storageKey);

  final SharedPreferences _prefs;
  final String _storageKey;

  static const _keyPrefix = 'nexam_scan_outbox_';
  static bool _flushing = false;

  /// Outbox scoped to one instructor account — the SharedPreferences key is
  /// namespaced by user id so a different login on the same device can
  /// never flush (or even read) someone else's queued sheets.
  static Future<ScanOutbox> forOwner(String ownerId) async {
    final prefs = await SharedPreferences.getInstance();
    return ScanOutbox._(prefs, '$_keyPrefix$ownerId');
  }

  /// Queued entries, oldest first.
  Future<List<PendingScan>> list() async {
    final raw = _prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .map((e) => PendingScan.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _save(List<PendingScan> entries) =>
      _prefs.setString(_storageKey, jsonEncode(entries.map((e) => e.toJson()).toList()));

  Future<void> add(PendingScan entry) async {
    final entries = await list();
    entries.removeWhere((e) => e.clientScanId == entry.clientScanId);
    entries.add(entry);
    await _save(entries);
  }

  Future<void> remove(String clientScanId) async {
    final entries = await list();
    entries.removeWhere((e) => e.clientScanId == clientScanId);
    await _save(entries);
  }

  /// Replay every queued entry, oldest first.
  ///
  /// - 2xx (including a `duplicate` replay) removes the entry.
  /// - An expired session aborts the whole flush — every entry would fail.
  /// - A network failure aborts early too; entries stay queued.
  /// - A server rejection marks the entry with its error and moves on —
  ///   the instructor sees it in the Scans list and decides to rescan or
  ///   discard it.
  /// [replaceIds] — clientScanIds the instructor explicitly chose to
  /// overwrite for. A queued sheet that hit DUPLICATE_SCAN parks until a
  /// human decides; replaying it with replaceExisting resolves it.
  Future<FlushOutcome> flush({
    required String baseUrl,
    required String token,
    ScanApi? api,
    Set<String> replaceIds = const {},
  }) async {
    if (_flushing) return const FlushOutcome();
    _flushing = true;
    try {
      final scanApi = api ?? ScanApi();
      final entries = await list();
      final doneIds = <String>{};
      var synced = 0;

      Future<void> persist() => _save(
          entries.where((e) => !doneIds.contains(e.clientScanId)).toList());

      for (final entry in entries) {
        try {
          await scanApi.submitScan(
            baseUrl: baseUrl,
            token: token,
            examId: entry.examId,
            examSetId: entry.examSetId,
            set: entry.set,
            studentName: entry.studentName,
            studentNumber: entry.studentNumber,
            clientScanId: entry.clientScanId,
            replaceExisting: replaceIds.contains(entry.clientScanId),
            answers: entry.answers,
          );
          doneIds.add(entry.clientScanId);
          synced++;
        } on ApiException catch (e) {
          if (e.isSessionExpired) {
            await persist();
            return FlushOutcome(
                synced: synced,
                stillPending: entries.length - doneIds.length,
                sessionExpired: true);
          }
          if (e.isNetworkError) {
            await persist();
            return FlushOutcome(
                synced: synced,
                stillPending: entries.length - doneIds.length);
          }
          // Server rejection — permanent for this payload. Keep it, record
          // the reason, move to the next entry.
          entry.attempts++;
          entry.lastError = e.message;
        } catch (e) {
          entry.attempts++;
          entry.lastError = '$e';
        }
      }

      await persist();
      return FlushOutcome(
          synced: synced, stillPending: entries.length - doneIds.length);
    } finally {
      _flushing = false;
    }
  }
}

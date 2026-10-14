/// Network-level exception thrown by all API calls.
///
/// Carries enough context for the UI to distinguish a transient network
/// failure (retry) from an authentication failure (re-login) or a
/// validation error (show the message).
class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.isNetworkError = false,
    this.statusCode,
    this.code,
  });

  final String message;
  final bool isNetworkError;

  /// HTTP status behind the failure, when there was one. Lets a caller tell
  /// an expired session (401) apart from a transient network blip.
  final int? statusCode;

  /// Server-declared error code (e.g. DUPLICATE_SCAN, STALE_SET) when the
  /// response body carried one — lets callers branch on meaning, not text.
  final String? code;

  bool get isSessionExpired => statusCode == 401;
  bool get isDuplicateScan => code == 'DUPLICATE_SCAN';

  /// Failures for which retrying the exact same write is safe and useful.
  bool get isRetryable =>
      isNetworkError ||
      statusCode == 408 ||
      statusCode == 429 ||
      (statusCode != null && statusCode! >= 500);

  @override
  String toString() => message;
}

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/session_avatar.dart';
import '../../auth/data/auth_api.dart';
import '../../auth/domain/instructor_session.dart';

/// Edit profile — mirrors the web account page: photo change/remove,
/// name fields (PUT /me), and password change (POST /change-password).
/// Every mutation returns a refreshed session via [onSessionChanged]
/// so the whole app (greeting, nav avatar) updates immediately.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({
    super.key,
    required this.session,
    required this.onSessionChanged,
    required this.onSessionExpired,
  });

  final InstructorSession session;
  final ValueChanged<InstructorSession> onSessionChanged;
  final VoidCallback onSessionExpired;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _api = AuthApi();
  final _picker = ImagePicker();

  late final TextEditingController _first;
  late final TextEditingController _middle;
  late final TextEditingController _last;
  late final TextEditingController _ext;
  final _currentPw = TextEditingController();
  final _newPw = TextEditingController();
  final _confirmPw = TextEditingController();

  /// The working copy — updated after each successful avatar call so
  /// this screen redraws before the parent even rebuilds.
  late InstructorSession _session;
  bool _savingProfile = false;
  bool _savingPassword = false;
  bool _avatarBusy = false;

  @override
  void initState() {
    super.initState();
    _session = widget.session;
    _first = TextEditingController(text: _session.firstName);
    _middle = TextEditingController(text: _session.middleName);
    _last = TextEditingController(text: _session.lastName);
    _ext = TextEditingController(text: _session.nameExt);
  }

  @override
  void dispose() {
    _first.dispose();
    _middle.dispose();
    _last.dispose();
    _ext.dispose();
    _currentPw.dispose();
    _newPw.dispose();
    _confirmPw.dispose();
    super.dispose();
  }

  bool get _profileDirty =>
      _first.text.trim() != _session.firstName ||
      _middle.text.trim() != _session.middleName ||
      _last.text.trim() != _session.lastName ||
      _ext.text.trim() != _session.nameExt;

  void _handleApiError(Object e) {
    if (e is ApiException && e.isSessionExpired) {
      widget.onSessionExpired();
      return;
    }
    _toast(e is ApiException ? e.message : 'Something went wrong.');
  }

  void _toast(String message, {bool ok = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: ok ? AppTheme.success : AppTheme.ink,
      ),
    );
  }

  void _applySession(InstructorSession updated) {
    setState(() => _session = updated);
    widget.onSessionChanged(updated);
  }

  // ── Photo ──────────────────────────────────────────────

  Future<void> _pickAndUpload() async {
    final x = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 88,
    );
    if (x == null) return;
    setState(() => _avatarBusy = true);
    try {
      final bytes = await x.readAsBytes();
      final (hasAvatar, avatarV) = await _api.uploadAvatar(
        baseUrl: _session.baseUrl,
        token: _session.token,
        bytes: bytes,
        fileName: x.name,
      );
      _applySession(
        _session.copyWith(hasAvatar: hasAvatar, avatarV: avatarV),
      );
      _toast('Profile photo updated.', ok: true);
    } catch (e) {
      _handleApiError(e);
    } finally {
      if (mounted) setState(() => _avatarBusy = false);
    }
  }

  Future<void> _removePhoto() async {
    setState(() => _avatarBusy = true);
    try {
      await _api.deleteAvatar(
        baseUrl: _session.baseUrl,
        token: _session.token,
      );
      _applySession(_session.copyWith(hasAvatar: false, avatarV: 0));
      _toast('Profile photo removed.', ok: true);
    } catch (e) {
      _handleApiError(e);
    } finally {
      if (mounted) setState(() => _avatarBusy = false);
    }
  }

  void _photoActions() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Change photo'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUpload();
              },
            ),
            if (_session.hasAvatar)
              ListTile(
                leading: Icon(Icons.delete_outline_rounded,
                    color: AppTheme.error),
                title: Text('Remove photo',
                    style: TextStyle(color: AppTheme.error)),
                onTap: () {
                  Navigator.pop(ctx);
                  _removePhoto();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ── Save ───────────────────────────────────────────────

  Future<void> _saveProfile() async {
    if (_first.text.trim().isEmpty || _last.text.trim().isEmpty) {
      _toast('First and last name are required.');
      return;
    }
    setState(() => _savingProfile = true);
    try {
      final updated = await _api.updateProfile(
        baseUrl: _session.baseUrl,
        token: _session.token,
        firstName: _first.text,
        lastName: _last.text,
        middleName: _middle.text,
        nameExt: _ext.text,
      );
      _applySession(updated);
      _toast('Profile saved.', ok: true);
    } catch (e) {
      _handleApiError(e);
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _savePassword() async {
    if (_newPw.text.length < 8) {
      _toast('New password must be at least 8 characters.');
      return;
    }
    if (_newPw.text != _confirmPw.text) {
      _toast('New passwords do not match.');
      return;
    }
    setState(() => _savingPassword = true);
    try {
      await _api.changePassword(
        baseUrl: _session.baseUrl,
        token: _session.token,
        currentPassword: _currentPw.text,
        newPassword: _newPw.text,
      );
      _currentPw.clear();
      _newPw.clear();
      _confirmPw.clear();
      _toast('Password changed.', ok: true);
    } catch (e) {
      _handleApiError(e);
    } finally {
      if (mounted) setState(() => _savingPassword = false);
    }
  }

  // ── UI ─────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const NexamAppBar(
        title: 'Edit profile',
        subtitle: 'Synced with your web account',
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          _photoCard(),
          const SizedBox(height: 20),
          _sectionLabel('NAME'),
          const SizedBox(height: 10),
          _nameCard(),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed:
                  _savingProfile || !_profileDirty ? null : _saveProfile,
              child: _savingProfile
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save changes'),
            ),
          ),
          const SizedBox(height: 26),
          _sectionLabel('PASSWORD'),
          const SizedBox(height: 10),
          _passwordCard(),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _savingPassword ? null : _savePassword,
              child: _savingPassword
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Change password'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _photoCard() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 22),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(
        children: [
          Stack(
            children: [
              SessionAvatar(session: _session, diameter: 92),
              Positioned(
                right: 0,
                bottom: 0,
                child: GestureDetector(
                  onTap: _avatarBusy ? null : _photoActions,
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.card, width: 2.5),
                    ),
                    child: _avatarBusy
                        ? const Padding(
                            padding: EdgeInsets.all(6),
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.photo_camera_rounded,
                            size: 15, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _session.fullName,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppTheme.textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            _session.email,
            style: TextStyle(
              fontSize: 12.5,
              color: AppTheme.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String label) => Text(
        label,
        style: AppTheme.micro(),
      );

  Widget _nameCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(
        children: [
          _field(_first, 'First name', required: true),
          const SizedBox(height: 12),
          _field(_middle, 'Middle name (optional)'),
          const SizedBox(height: 12),
          _field(_last, 'Last name', required: true),
          const SizedBox(height: 12),
          _field(_ext, 'Name extension (optional)',
              hint: 'Jr., III…'),
        ],
      ),
    );
  }

  Widget _passwordCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(
        children: [
          _field(_currentPw, 'Current password', obscure: true),
          const SizedBox(height: 12),
          _field(_newPw, 'New password (8+ characters)', obscure: true),
          const SizedBox(height: 12),
          _field(_confirmPw, 'Confirm new password', obscure: true),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? hint,
    bool obscure = false,
    bool required = false,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        labelText: required ? '$label *' : label,
        hintText: hint,
      ),
    );
  }
}

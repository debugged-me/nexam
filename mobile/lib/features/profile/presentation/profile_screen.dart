import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/session_avatar.dart';
import '../../auth/domain/instructor_session.dart';
import 'edit_profile_screen.dart';

/// Profile tab — identity card (avatar, name, email, role), the server
/// the app is talking to, edit-profile entry, and sign-out.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.session,
    required this.onLogout,
    required this.onSessionChanged,
    required this.onSessionExpired,
  });

  final InstructorSession session;
  final VoidCallback onLogout;
  final ValueChanged<InstructorSession> onSessionChanged;
  final VoidCallback onSessionExpired;

  String get _serverHost {
    final uri = Uri.tryParse(session.baseUrl);
    return uri?.host ?? session.baseUrl;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: NexamAppBar(
        title: 'Profile',
        subtitle: 'Your instructor account',
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => EditProfileScreen(
                    session: session,
                    onSessionChanged: onSessionChanged,
                    onSessionExpired: onSessionExpired,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.edit_outlined, size: 16),
            label: const Text('Edit'),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          _identityCard(),
          const SizedBox(height: 16),
          _infoCard(),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: onLogout,
            icon: const Icon(Icons.logout_rounded,
                size: 18, color: AppTheme.error),
            label: const Text('Sign out',
                style: TextStyle(color: AppTheme.error)),
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                  color: AppTheme.error.withValues(alpha: 0.4)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _identityCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppTheme.cardBorder),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        children: [
          SessionAvatar(session: session, diameter: 64),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.fullName.isEmpty
                      ? 'Instructor'
                      : session.fullName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: AppTheme.textDark,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  session.email,
                  softWrap: true,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.textMuted,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.tintBlue,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    session.role.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(
        children: [
          _infoRow(
            icon: Icons.dns_outlined,
            label: 'Server',
            value: _serverHost,
            first: true,
          ),
          _infoRow(
            icon: Icons.mail_outline_rounded,
            label: 'Email',
            value: session.email,
          ),
          _infoRow(
            icon: Icons.badge_outlined,
            label: 'Role',
            value: session.role,
          ),
          _infoRow(
            icon: Icons.info_outline_rounded,
            label: 'App',
            value: 'Nexam OMR companion',
            last: true,
          ),
        ],
      ),
    );
  }

  Widget _infoRow({
    required IconData icon,
    required String label,
    required String value,
    bool first = false,
    bool last = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(
                bottom: BorderSide(color: AppTheme.cardBorder),
              ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.textFaint),
          const SizedBox(width: 12),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13.5,
              color: AppTheme.textMuted,
            ),
          ),
          const Spacer(),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              softWrap: true,
              textAlign: TextAlign.end,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppTheme.textDark,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/session_avatar.dart';
import '../../auth/domain/instructor_session.dart';
import 'appearance_screen.dart';
import 'edit_profile_screen.dart';

/// Profile tab — identity hero, then grouped settings rows mirroring the
/// web's account and appearance pages: edit profile (name, photo,
/// password), theme, server info, and sign-out.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.session,
    required this.themeMode,
    required this.onThemeModeChanged,
    required this.onStartTour,
    required this.onLogout,
    required this.onSessionChanged,
    required this.onSessionExpired,
  });

  final InstructorSession session;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;
  final VoidCallback onStartTour;
  final VoidCallback onLogout;
  final ValueChanged<InstructorSession> onSessionChanged;
  final VoidCallback onSessionExpired;

  String get _serverHost {
    final uri = Uri.tryParse(session.baseUrl);
    return uri?.host ?? session.baseUrl;
  }

  String get _themeLabel => switch (themeMode) {
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
        ThemeMode.system => 'System',
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const NexamAppBar(
        title: 'Profile',
        subtitle: 'Account & preferences',
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          _hero(),
          const SizedBox(height: 24),
          _section('Account'),
          const SizedBox(height: 8),
          _card([
            _navRow(
              icon: Icons.person_outline_rounded,
              title: 'Edit profile',
              subtitle: 'Name, photo & password',
              first: true,
              last: true,
              onTap: () {
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
            ),
          ]),
          const SizedBox(height: 20),
          _section('Appearance'),
          const SizedBox(height: 8),
          _card([
            _navRow(
              icon: Icons.contrast_rounded,
              title: 'Theme',
              value: _themeLabel,
              first: true,
              last: true,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AppearanceScreen(
                      themeMode: themeMode,
                      onThemeModeChanged: onThemeModeChanged,
                    ),
                  ),
                );
              },
            ),
          ]),
          const SizedBox(height: 20),
          _section('Help'),
          const SizedBox(height: 8),
          _card([
            _navRow(
              icon: Icons.help_outline_rounded,
              title: 'Take a tour',
              subtitle: 'A quick walk through the app',
              first: true,
              last: true,
              onTap: onStartTour,
            ),
          ]),
          const SizedBox(height: 20),
          _section('About'),
          const SizedBox(height: 8),
          _card([
            _infoRow(
              icon: Icons.dns_rounded,
              label: 'Server',
              value: _serverHost,
              first: true,
            ),
            _infoRow(
              icon: Icons.badge_rounded,
              label: 'Role',
              value: session.role,
            ),
            _infoRow(
              icon: Icons.info_outline_rounded,
              label: 'App',
              value: 'nexam companion',
              last: true,
            ),
          ]),
          const SizedBox(height: 20),
          _card([
            _navRow(
              icon: Icons.logout_rounded,
              title: 'Sign out',
              destructive: true,
              first: true,
              last: true,
              onTap: onLogout,
            ),
          ]),
        ],
      ),
    );
  }

  /// Dark hero card — avatar ring, name, email, role chip. Uses the same
  /// brand ink as the splash so it reads as the app's own header, not a
  /// data row.
  Widget _hero() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
      decoration: BoxDecoration(
        color: AppTheme.ink,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.35),
                width: 1.6,
              ),
            ),
            child: SessionAvatar(session: session, diameter: 76),
          ),
          const SizedBox(height: 14),
          Text(
            session.fullName.isEmpty ? 'Instructor' : session.fullName,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            session.email,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              color: Colors.white.withValues(alpha: 0.62),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.22),
              ),
            ),
            child: Text(
              session.role.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.9,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String label) => Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(
          label.toUpperCase(),
          style: AppTheme.micro(),
        ),
      );

  /// Grouped card — rows pass first/last to drop the rounding seams.
  Widget _card(List<Widget> rows) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(children: rows),
    );
  }

  /// Tappable settings row — tinted icon tile, title, optional subtitle,
  /// trailing value + chevron.
  Widget _navRow({
    required IconData icon,
    required String title,
    String? subtitle,
    String? value,
    bool destructive = false,
    bool first = false,
    bool last = false,
    required VoidCallback onTap,
  }) {
    final accent = destructive ? AppTheme.error : AppTheme.primary;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.vertical(
          top: first ? const Radius.circular(AppTheme.radiusMd) : Radius.zero,
          bottom:
              last ? const Radius.circular(AppTheme.radiusMd) : Radius.zero,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            border: last
                ? null
                : Border(bottom: BorderSide(color: AppTheme.cardBorder)),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: destructive
                      ? AppTheme.error.withValues(alpha: 0.12)
                      : AppTheme.tintBlue,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 17, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: destructive ? AppTheme.error : AppTheme.textDark,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 1),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (value != null) ...[
                const SizedBox(width: 12),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_right_rounded,
                size: 19,
                color: AppTheme.textFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Read-only info row (server, role, app).
  Widget _infoRow({
    required IconData icon,
    required String label,
    required String value,
    bool first = false,
    bool last = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(bottom: BorderSide(color: AppTheme.cardBorder)),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppTheme.tintBlue,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 17, color: AppTheme.primary),
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.textDark,
            ),
          ),
          const Spacer(),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              softWrap: true,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 13,
                color: AppTheme.textMuted,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

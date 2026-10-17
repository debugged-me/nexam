import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';

/// Appearance — the same three-way theme choice the web offers
/// (light / dark / system). The pick applies instantly and is saved to
/// the account (users.theme via PUT /auth/appearance), so it follows the
/// instructor across web and mobile.
class AppearanceScreen extends StatelessWidget {
  const AppearanceScreen({
    super.key,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;

  static const _options = [
    (
      mode: ThemeMode.light,
      label: 'Light',
      icon: Icons.wb_sunny_outlined,
    ),
    (
      mode: ThemeMode.dark,
      label: 'Dark',
      icon: Icons.dark_mode_outlined,
    ),
    (
      mode: ThemeMode.system,
      label: 'System',
      icon: Icons.settings_suggest_outlined,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const NexamAppBar(
        title: 'Appearance',
        subtitle: 'Synced with your web account',
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          Text('THEME', style: AppTheme.micro()),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final option in _options) ...[
                Expanded(
                  child: _ThemeCard(
                    option: option,
                    selected: themeMode == option.mode,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onThemeModeChanged(option.mode);
                    },
                  ),
                ),
                if (option != _options.last) const SizedBox(width: 10),
              ],
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.tintBlue,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.sync_rounded, size: 17, color: AppTheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'This choice is saved to your account and also applies '
                    'to the nexam web app.',
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.45,
                      color: AppTheme.textMuted,
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
}

/// One selectable theme card — mini window mock + label, like the web
/// appearance page's theme shots.
class _ThemeCard extends StatelessWidget {
  const _ThemeCard({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final ({
    ThemeMode mode,
    String label,
    IconData icon,
  }) option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = selected ? AppTheme.primary : AppTheme.cardBorder;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: borderColor,
            width: selected ? 1.6 : 1,
          ),
          boxShadow: selected ? AppTheme.cardShadow : null,
        ),
        child: Column(
          children: [
            _ThemeShot(mode: option.mode),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  option.icon,
                  size: 14,
                  color: selected ? AppTheme.primary : AppTheme.textMuted,
                ),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    option.label,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: selected ? AppTheme.primary : AppTheme.textDark,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A tiny app-window preview — a header bar, sidebar and text lines in
/// light or dark chrome; "system" splits the two.
class _ThemeShot extends StatelessWidget {
  const _ThemeShot({required this.mode});

  final ThemeMode mode;

  static const _lBg = Color(0xFFF6F8FA);
  static const _lCard = Color(0xFFFFFFFF);
  static const _lLine = Color(0xFFE8EBEF);
  static const _dBg = Color(0xFF14161A);
  static const _dCard = Color(0xFF1B1E23);
  static const _dLine = Color(0xFF2C3138);

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.25,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(9),
        child: mode == ThemeMode.system
            ? Row(
                children: [
                  Expanded(child: _shot(false)),
                  Expanded(child: _shot(true)),
                ],
              )
            : _shot(mode == ThemeMode.dark),
      ),
    );
  }

  Widget _shot(bool dark) {
    final bg = dark ? _dBg : _lBg;
    final card = dark ? _dCard : _lCard;
    final line = dark ? _dLine : _lLine;
    return Container(
      color: bg,
      padding: const EdgeInsets.all(7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: card,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 10,
                  decoration: BoxDecoration(
                    color: card,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 5,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: line,
                          borderRadius: BorderRadius.circular(2.5),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        height: 5,
                        width: 26,
                        decoration: BoxDecoration(
                          color: line,
                          borderRadius: BorderRadius.circular(2.5),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        height: 8,
                        width: 22,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2383E2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

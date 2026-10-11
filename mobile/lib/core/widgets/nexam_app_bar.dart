import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The app's universal top bar: brand-aware title on the left, an
/// iOS-style back chevron whenever the route can pop, and trailing
/// actions. Use on every screen for a consistent header.
class NexamAppBar extends StatelessWidget implements PreferredSizeWidget {
  const NexamAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
    this.showLogo = false,
    this.onBack,
  });

  final String title;
  final String? subtitle;

  /// Trailing widgets (e.g. icon buttons) rendered right-aligned.
  final List<Widget> actions;

  /// Show the nexam mark next to the title (dashboard/root use).
  final bool showLogo;

  /// Custom back behavior; defaults to [Navigator.maybePop].
  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 6);

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return SafeArea(
      bottom: false,
      child: Container(
        height: preferredSize.height,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          border: Border(
            bottom: BorderSide(color: AppTheme.cardBorder),
          ),
        ),
        child: Row(
          children: [
            if (canPop)
              IconButton(
                onPressed: onBack ?? () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_ios_new_rounded,
                    size: 19, color: AppTheme.textDark),
                tooltip: 'Back',
              )
            else
              const SizedBox(width: 12),
            if (showLogo) ...[
              Image.asset('assets/icons/nexam_logo.png',
                  width: 26, height: 26),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                      color: AppTheme.textDark,
                    ),
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppTheme.textMuted,
                      ),
                    ),
                ],
              ),
            ),
            ...actions,
            const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }
}

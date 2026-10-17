import 'package:flutter/material.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';

import '../theme/app_theme.dart';

/// Guided tour — the mobile counterpart of the web's driver.js guide.
///
/// Same contract: MANUAL START ONLY. Nothing calls [AppTour.show] except
/// the two explicit entry points (the dashboard help icon and the
/// Profile → Take a tour row); no lifecycle hook or persisted flag may
/// ever auto-start it. Steps only highlight — they never tap or drive.
///
/// [AppTourKeys] are GlobalKeys owned by MainShell and threaded into the
/// dashboard and nav bar. A key whose widget isn't mounted (loading,
/// empty state) is skipped, like the web's `resolveSteps` filter.
class AppTourKeys {
  AppTourKeys();

  final dashboardHero = GlobalKey();
  final dashboardStats = GlobalKey();
  final dashboardRecent = GlobalKey();
  final navHome = GlobalKey();
  final navScans = GlobalKey();
  final navScanFab = GlobalKey();
  final navExams = GlobalKey();
  final navProfile = GlobalKey();
}

class AppTour {
  AppTour._();

  static void show(BuildContext context, {required AppTourKeys keys}) {
    final steps = <({GlobalKey? target, String title, String body})>[
      (
        target: null,
        title: 'Welcome to nexam',
        body: 'Scan, grade, and review OMR answer sheets from your phone. '
            'Here’s a 30-second tour of the workspace.',
      ),
      (
        target: keys.dashboardHero,
        title: 'Your grading desk',
        body: 'Sheets waiting for your review show up here, with the '
            'primary scan action one tap away.',
      ),
      (
        target: keys.dashboardStats,
        title: 'Live counts',
        body: 'Exams, scans, and sheets needing review — tap a number '
            'to jump straight to that list.',
      ),
      (
        target: keys.dashboardRecent,
        title: 'Recent scans',
        body: 'The newest graded sheets. Tap one to open the item ledger '
            'and correct ambiguous marks.',
      ),
      (
        target: keys.navScanFab,
        title: 'Scan a sheet',
        body: 'Point the camera at the sheet’s QR code first, then '
            'capture the answer bubbles — nexam does the rest.',
      ),
      (
        target: keys.navScans,
        title: 'Scans archive',
        body: 'Every sheet you’ve graded, filterable by review state. '
            'Offline captures queue in the outbox and sync themselves. '
            'Use the printer icon to print the records.',
      ),
      (
        target: keys.navExams,
        title: 'Exams & documents',
        body: 'Your exam library — open one to print the exam papers, '
            'answer keys, OMR sheets, or the TOS report.',
      ),
      (
        target: keys.navProfile,
        title: 'Profile & settings',
        body: 'Account details, theme, and this tour — replay it '
            'anytime from the Help section.',
      ),
    ];

    // Only keep steps whose target is actually on screen (the welcome
    // step has none — it's a centered card on a zero-size spot, so the
    // overlay just dims behind it). The counter counts rendered steps
    // so skipped targets can't leave gaps like "5 / 8".
    final rendered = [
      for (final step in steps)
        if (step.target == null || step.target!.currentContext != null)
          step,
    ];
    final targets = <TargetFocus>[
      for (var i = 0; i < rendered.length; i++)
        _focus(
          rendered[i].target,
          rendered[i].title,
          rendered[i].body,
          i + 1,
          rendered.length,
          size: MediaQuery.of(context).size,
        ),
    ];

    if (targets.isEmpty) return;
    TutorialCoachMark(
      targets: targets,
      colorShadow: const Color(0xFF0C0C0E),
      opacityShadow: 0.55,
      paddingFocus: 8,
      pulseEnable: false,
      textSkip: 'SKIP',
      textStyleSkip: TextStyle(
        fontFamily: AppTheme.fontUi,
        fontSize: 12.5,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: Colors.white.withValues(alpha: 0.75),
      ),
      alignSkip: Alignment.bottomLeft,
      onSkip: () => true,
    ).show(context: context);
  }

  static TargetFocus _focus(
    GlobalKey? target,
    String title,
    String body,
    int index,
    int total, {
    required Size size,
  }) {
    return TargetFocus(
      identify: 'step-$index',
      keyTarget: target,
      targetPosition: target == null
          ? TargetPosition(Size.zero, size.center(Offset.zero))
          : null,
      shape: ShapeLightFocus.RRect,
      radius: 14,
      contents: [
        TargetContent(
          align: ContentAlign.bottom,
          child: _TourCard(
            index: index,
            total: total,
            title: title,
            body: body,
          ),
        ),
      ],
    );
  }
}

/// The popover card — branded like the web's tour head: logo, kicker,
/// title, body, and a step counter. Tap advances to the next step.
class _TourCard extends StatelessWidget {
  const _TourCard({
    required this.index,
    required this.total,
    required this.title,
    required this.body,
  });

  final int index;
  final int total;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.cardBorder),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Image.asset('assets/icons/nexam_logo.png',
                  width: 20, height: 20),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  'nexam guide',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: AppTheme.textMuted,
                  ),
                ),
              ),
              Text(
                '$index / $total',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textFaint,
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            title,
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
              color: AppTheme.textDark,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            body,
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: AppTheme.textMuted,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tap anywhere to continue',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: AppTheme.textFaint,
            ),
          ),
        ],
      ),
    );
  }
}

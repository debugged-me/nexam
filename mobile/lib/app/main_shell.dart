import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme/app_theme.dart';
import '../core/widgets/session_avatar.dart';
import '../features/auth/domain/instructor_session.dart';
import '../features/exams/presentation/exams_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/scanner/presentation/dashboard_screen.dart';
import '../features/scanner/presentation/scan_flow.dart';
import '../features/scanner/presentation/scans_screen.dart';

/// App shell — bottom navigation between Home, Scans, a raised center
/// Scan action, Exams, and Profile. Tabs keep their own state via
/// IndexedStack.
class MainShell extends StatefulWidget {
  const MainShell({
    super.key,
    required this.session,
    required this.onLogout,
    required this.onSessionExpired,
    required this.onSessionChanged,
  });

  final InstructorSession session;
  final VoidCallback onLogout;
  final VoidCallback onSessionExpired;

  /// Fired when the profile is edited — the app persists the updated
  /// session and rebuilds so every screen sees the new data.
  final ValueChanged<InstructorSession> onSessionChanged;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _tab = 0;

  /// Pending-review count — fed by the Scans tab each time it loads.
  int _flagged = 0;

  void _startScan() {
    HapticFeedback.mediumImpact();
    launchScanFlow(
      context,
      session: widget.session,
      onSessionExpired: widget.onSessionExpired,
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(
        session: widget.session,
        onLogout: widget.onLogout,
        onSessionExpired: widget.onSessionExpired,
        onNavigate: (i) => setState(() => _tab = i),
      ),
      ScansScreen(
        session: widget.session,
        onSessionExpired: widget.onSessionExpired,
        onLoaded: (scans) {
          final count = scans
              .where((s) =>
                  s['needs_review'] == 1 || s['needs_review'] == true)
              .length;
          if (mounted && count != _flagged) {
            setState(() => _flagged = count);
          }
        },
      ),
      ExamsScreen(
        session: widget.session,
        onSessionExpired: widget.onSessionExpired,
      ),
      ProfileScreen(
        session: widget.session,
        onLogout: widget.onLogout,
        onSessionChanged: widget.onSessionChanged,
        onSessionExpired: widget.onSessionExpired,
      ),
    ];

    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: _NavBar(
        index: _tab,
        flagged: _flagged,
        session: widget.session,
        onTap: (i) {
          if (i == _tab) return;
          HapticFeedback.selectionClick();
          setState(() => _tab = i);
        },
        onScan: _startScan,
      ),
    );
  }
}

/// Custom bottom bar — four items with a raised center action, the
/// Cash-App-style "primary button floating in the nav" pattern.
class _NavBar extends StatelessWidget {
  const _NavBar({
    required this.index,
    required this.flagged,
    required this.session,
    required this.onTap,
    required this.onScan,
  });

  final int index;
  final int flagged;
  final InstructorSession session;
  final ValueChanged<int> onTap;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: AppTheme.cardBorder),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 68,
          child: Row(
            children: [
              _item(
                index: 0,
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
                label: 'Home',
              ),
              _item(
                index: 1,
                icon: Icons.document_scanner_outlined,
                activeIcon: Icons.document_scanner_rounded,
                label: 'Scans',
                badge: flagged,
              ),
              // Raised center action.
              Expanded(
                child: Center(
                  child: Transform.translate(
                    offset: const Offset(0, -10),
                    child: GestureDetector(
                      onTap: onScan,
                      child: Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          gradient: AppTheme.accentGradient,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary
                                  .withValues(alpha: 0.35),
                              blurRadius: 14,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.qr_code_scanner_rounded,
                          color: Colors.white,
                          size: 26,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              _item(
                index: 2,
                icon: Icons.assignment_outlined,
                activeIcon: Icons.assignment_rounded,
                label: 'Exams',
              ),
              _profileItem(index: 3),
            ],
          ),
        ),
      ),
    );
  }

  /// The Profile tab shows the instructor's actual photo — ringed in
  /// brand blue while the tab is active.
  Widget _profileItem({required int index}) {
    final selected = this.index == index;
    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 32,
              height: 32,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected
                      ? AppTheme.primary
                      : Colors.transparent,
                  width: 1.8,
                ),
              ),
              child: SessionAvatar(session: session, diameter: 26),
            ),
            const SizedBox(height: 3),
            Text(
              'Profile',
              style: TextStyle(
                fontSize: 11,
                fontWeight:
                    selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? AppTheme.primary
                    : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _item({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    int badge = 0,
  }) {
    final selected = this.index == index;
    final color =
        selected ? AppTheme.primary : AppTheme.textMuted;
    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Badge(
              isLabelVisible: badge > 0,
              label: Text(
                '$badge',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
              backgroundColor: AppTheme.warning,
              child: Icon(
                selected ? activeIcon : icon,
                size: 23,
                color: color,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight:
                    selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

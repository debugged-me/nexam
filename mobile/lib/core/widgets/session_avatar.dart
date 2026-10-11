import 'package:flutter/material.dart';

import '../../features/auth/domain/instructor_session.dart';
import '../theme/app_theme.dart';

/// Circular profile photo for the signed-in instructor — streams the
/// authenticated avatar endpoint and falls back to a name initial on
/// a dark disc when no photo exists or the fetch fails.
class SessionAvatar extends StatelessWidget {
  const SessionAvatar({
    super.key,
    required this.session,
    this.diameter = 34,
  });

  final InstructorSession session;
  final double diameter;

  @override
  Widget build(BuildContext context) {
    final name = session.fullName.trim();
    final initial = Text(
      name.isEmpty ? '?' : name.characters.first.toUpperCase(),
      style: TextStyle(
        fontSize: diameter * 0.38,
        fontWeight: FontWeight.w800,
        color: Colors.white,
      ),
    );

    return Container(
      width: diameter,
      height: diameter,
      decoration: const BoxDecoration(
        color: AppTheme.ink,
        shape: BoxShape.circle,
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: session.hasAvatar
          ? Image.network(
              '${session.baseUrl}/api/auth/avatar?v=${session.avatarV}',
              headers: {'authorization': 'Bearer ${session.token}'},
              width: diameter,
              height: diameter,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => initial,
              loadingBuilder: (_, child, progress) =>
                  progress == null ? child : initial,
            )
          : initial,
    );
  }
}

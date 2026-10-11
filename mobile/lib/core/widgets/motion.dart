import 'package:flutter/material.dart';

/// Fade+slide entrance for list rows — [index] staggers the delay so
/// rows cascade in instead of popping as a wall.
class StaggerIn extends StatelessWidget {
  const StaggerIn({
    super.key,
    required this.index,
    required this.child,
    this.step = 35,
    this.duration = 260,
  });

  final int index;
  final Widget child;

  /// Milliseconds between each row's start.
  final int step;

  /// Per-row animation length in milliseconds.
  final int duration;

  @override
  Widget build(BuildContext context) {
    final delay = Duration(milliseconds: (index * step).clamp(0, 350));
    return _DelayedFadeSlide(delay: delay, duration: duration, child: child);
  }
}

class _DelayedFadeSlide extends StatefulWidget {
  const _DelayedFadeSlide({
    required this.delay,
    required this.duration,
    required this.child,
  });

  final Duration delay;
  final int duration;
  final Widget child;

  @override
  State<_DelayedFadeSlide> createState() => _DelayedFadeSlideState();
}

class _DelayedFadeSlideState extends State<_DelayedFadeSlide>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: widget.duration),
  );

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curve = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(curve),
        child: widget.child,
      ),
    );
  }
}

/// Number that counts up from zero on first build — stat tiles, scores.
class CountUp extends StatelessWidget {
  const CountUp(
    this.value, {
    super.key,
    required this.style,
    this.duration = const Duration(milliseconds: 550),
  });

  final int value;
  final TextStyle style;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: 0, end: value),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => Text('$v', style: style),
    );
  }
}

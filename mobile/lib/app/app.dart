import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/theme/app_theme.dart';
import '../features/auth/data/auth_api.dart';
import '../features/auth/data/session_store.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import 'main_shell.dart';

/// Root widget — manages the auth state and routes between the login
/// screen and the dashboard.
class NexamOmrApp extends StatefulWidget {
  const NexamOmrApp({super.key});

  @override
  State<NexamOmrApp> createState() => _NexamOmrAppState();
}

class _NexamOmrAppState extends State<NexamOmrApp> {
  AuthController? _controller;
  bool _bootstrapping = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final controller = AuthController(
      api: AuthApi(),
      store: SessionStore(prefs),
    );
    await controller.bootstrap();

    if (mounted) {
      setState(() {
        _controller = controller;
        _bootstrapping = false;
      });
    }
  }

  void _onLoginSuccess() {
    setState(() {});
  }

  void _onLogout() async {
    await _controller?.logout();
    if (mounted) setState(() {});
  }

  /// Any API call that returns 401 lands here — drop the session and
  /// return to the login screen.
  void _onSessionExpired() {
    _onLogout();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'nexam',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(),
      darkTheme: AppTheme.buildDark(),
      themeMode: ThemeMode.system,
      // Sync the static palette flag with the resolved theme so widget
      // code reading AppTheme.* getters sees the active mode's colors.
      builder: (context, child) {
        AppTheme.brightness = Theme.of(context).brightness;
        return child ?? const SizedBox.shrink();
      },
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    if (_bootstrapping) {
      // Branded splash while the saved session is verified.
      return Scaffold(
        backgroundColor: AppTheme.ink,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 68,
                height: 68,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.16),
                  ),
                ),
                child: Image.asset('assets/icons/nexam_logo.png'),
              ),
              const SizedBox(height: 18),
              Text(
                'nexam',
                style: AppTheme.display(26,
                    weight: FontWeight.w700, color: Colors.white),
              ),
              const SizedBox(height: 26),
              const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: Colors.white70,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final controller = _controller;
    if (controller == null) {
      // Bootstrap failed to build the controller — offer a retry.
      return Scaffold(
        body: Center(
          child: OutlinedButton(
            onPressed: () {
              setState(() => _bootstrapping = true);
              _bootstrap();
            },
            child: const Text('Retry'),
          ),
        ),
      );
    }
    if (!controller.isAuthenticated) {
      return LoginScreen(
        controller: controller,
        onLoginSuccess: _onLoginSuccess,
      );
    }

    return MainShell(
      session: controller.session!,
      onLogout: _onLogout,
      onSessionExpired: _onSessionExpired,
      onSessionChanged: (updated) async {
        await controller.applySession(updated);
        if (mounted) setState(() {});
      },
    );
  }
}

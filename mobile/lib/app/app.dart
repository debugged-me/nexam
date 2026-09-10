import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/theme/app_theme.dart';
import '../features/auth/data/auth_api.dart';
import '../features/auth/data/session_store.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/scanner/presentation/dashboard_screen.dart';

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

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nexam OMR',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(),
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    if (_bootstrapping) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final controller = _controller;
    if (controller == null || !controller.isAuthenticated) {
      return LoginScreen(onLoginSuccess: _onLoginSuccess);
    }

    return DashboardScreen(
      session: controller.session!,
      onLogout: _onLogout,
    );
  }
}

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_theme.dart';
import '../data/auth_api.dart';
import '../data/session_store.dart';
import 'auth_controller.dart';

/// Login screen — the instructor enters the server address and their
/// Nexam credentials. On success the app navigates to the dashboard.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLoginSuccess});

  final VoidCallback onLoginSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final AuthController _controller;
  final _formKey = GlobalKey<FormState>();
  final _serverController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _controller = AuthController(
      api: AuthApi(),
      store: SessionStore(
        // SharedPreferences not yet available in initState — we'll
        // initialize it in didChangeDependencies.
        _placeholderPrefs,
      ),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _initStore();
  }

  Future<void> _initStore() async {
    final prefs = await SharedPreferences.getInstance();
    final store = SessionStore(prefs);
    _controller = AuthController(api: AuthApi(), store: store);
    final savedUrl = store.readBaseUrl();
    if (savedUrl.isNotEmpty && _serverController.text.isEmpty) {
      _serverController.text = savedUrl;
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _serverController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await _controller.login(
      baseUrl: _serverController.text,
      email: _emailController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;

    if (success) {
      widget.onLoginSuccess();
    } else if (_controller.error != null) {
      _showError(_controller.error!);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo / title
                    Icon(Icons.qr_code_scanner, size: 64, color: AppTheme.primary),
                    const SizedBox(height: 16),
                    Text(
                      'Nexam OMR',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textDark,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Scan answer sheets, sync scores',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
                    ),
                    const SizedBox(height: 32),

                    // Server address
                    TextFormField(
                      controller: _serverController,
                      decoration: const InputDecoration(
                        labelText: 'Server Address',
                        hintText: 'http://192.168.1.100:3000',
                        prefixIcon: Icon(Icons.dns),
                      ),
                      keyboardType: TextInputType.url,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Server address is required.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Email
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.email),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Email is required.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password
                    TextFormField(
                      controller: _passwordController,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock),
                        suffixIcon: IconButton(
                          icon: Icon(_obscurePassword
                              ? Icons.visibility_off
                              : Icons.visibility),
                          onPressed: () =>
                              setState(() => _obscurePassword = !_obscurePassword),
                        ),
                      ),
                      obscureText: _obscurePassword,
                      validator: (v) {
                        if (v == null || v.isEmpty) {
                          return 'Password is required.';
                        }
                        return null;
                      },
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 24),

                    // Login button
                    ElevatedButton(
                      onPressed: _controller.isLoading ? null : _submit,
                      child: _controller.isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Sign In'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Placeholder until SharedPreferences is initialized in didChangeDependencies.
// This is replaced immediately after the first frame.
final _placeholderPrefs = _PlaceholderPrefs();

class _PlaceholderPrefs implements SharedPreferences {
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

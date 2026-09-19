import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import 'auth_controller.dart';

/// Login screen — the instructor enters the server address and their
/// Nexam credentials. On success the app navigates to the dashboard.
///
/// The screen uses the SHARED [AuthController] owned by the app root —
/// previously it created its own, so a successful login never reached the
/// app's auth state and the user stayed stuck on this screen.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.controller,
    required this.onLoginSuccess,
  });

  /// The app-level auth controller — login() here populates the session
  /// that [NexamOmrApp] checks for routing.
  final AuthController controller;
  final VoidCallback onLoginSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serverController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill the server address used last time.
    final saved = widget.controller.savedBaseUrl;
    if (saved.isNotEmpty) _serverController.text = saved;
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
    setState(() => _submitting = true);

    final success = await widget.controller.login(
      baseUrl: _serverController.text,
      email: _emailController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (success) {
      widget.onLoginSuccess();
    } else if (widget.controller.error != null) {
      _showError(widget.controller.error!);
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
                    const Icon(Icons.qr_code_scanner, size: 64, color: AppTheme.primary),
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
                    const Text(
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
                      onPressed: _submitting ? null : _submit,
                      child: _submitting
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

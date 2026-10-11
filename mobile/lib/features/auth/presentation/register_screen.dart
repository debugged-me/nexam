import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../data/auth_api.dart';
import 'verify_email_screen.dart';

/// Create-account screen — collects the fields /api/auth/register requires,
/// then pushes the OTP verification screen with the returned verifyToken.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.baseUrl});

  final String baseUrl;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstController = TextEditingController();
  final _lastController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _api = AuthApi();

  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _firstController.dispose();
    _lastController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final data = await _api.register(
        baseUrl: widget.baseUrl,
        firstName: _firstController.text,
        lastName: _lastController.text,
        email: _emailController.text,
        password: _passwordController.text,
      );
      if (!mounted) return;
      final verified = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => VerifyEmailScreen(
            baseUrl: widget.baseUrl,
            verifyToken: data['verifyToken'] as String? ?? '',
            email:
                data['email'] as String? ?? _emailController.text.trim(),
          ),
        ),
      );
      if (!mounted) return;
      if (verified == true) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() =>
          _error = 'Could not create the account. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Required' : null;

  /// Same white pill field style the login screen uses.
  InputDecoration _pillDecoration({String? hint, IconData? icon, Widget? suffix}) {
    final shape = OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.cardBorder),
    );
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      prefixIcon: icon == null ? null : Icon(icon, size: 19),
      suffixIcon: suffix,
      border: shape,
      enabledBorder: shape,
      focusedBorder: shape.copyWith(
        borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
      ),
      errorBorder: shape.copyWith(
        borderSide: const BorderSide(color: AppTheme.error),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 7),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppTheme.textDark,
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: const NexamAppBar(title: 'Sign up'),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: Form(
                key: _formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    Text(
                      'Create your account',
                      style: AppTheme.display(26,
                          weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Register as an instructor to scan and grade.',
                      style: TextStyle(
                          fontSize: 13.5, color: AppTheme.textMuted),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              _label('First name'),
                              TextFormField(
                                controller: _firstController,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [
                                  AutofillHints.givenName
                                ],
                                validator: _required,
                                decoration:
                                    _pillDecoration(hint: 'Clark Steven'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              _label('Last name'),
                              TextFormField(
                                controller: _lastController,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [
                                  AutofillHints.familyName
                                ],
                                validator: _required,
                                decoration:
                                    _pillDecoration(hint: 'Edong'),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _label('Email Address'),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      validator: (v) {
                        final value = v?.trim() ?? '';
                        if (value.isEmpty) return 'Email is required.';
                        if (!value.contains('@')) {
                          return 'Enter a valid email address.';
                        }
                        return null;
                      },
                      decoration: _pillDecoration(
                        hint: 'Enter your email',
                        icon: Icons.mail_outline_rounded,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _label('Password'),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      autofillHints: const [AutofillHints.newPassword],
                      validator: (v) {
                        final value = v ?? '';
                        if (value.isEmpty) return 'Password is required.';
                        if (value.length < 8) {
                          return 'At least 8 characters.';
                        }
                        return null;
                      },
                      decoration: _pillDecoration(
                        hint: 'At least 8 characters',
                        icon: Icons.lock_outline_rounded,
                        suffix: IconButton(
                          splashRadius: 20,
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 19,
                          ),
                        ),
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      _ErrorBanner(message: _error!),
                    ],
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Create account'),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Already have an account? ',
                          style: TextStyle(
                              fontSize: 13.5,
                              color: AppTheme.textMuted),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: const Text(
                            'Log in',
                            style: TextStyle(
                              fontSize: 13.5,
                              color: AppTheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
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

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border:
            Border.all(color: AppTheme.error.withValues(alpha: 0.30)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          fontSize: 13,
          color: AppTheme.error,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

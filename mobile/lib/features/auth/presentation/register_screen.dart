import 'package:flutter/material.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/pill_field.dart';
import '../../../core/widgets/states.dart';
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
  /// Matches the web register form's extension options.
  static const _nameExtensions = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

  final _formKey = GlobalKey<FormState>();
  final _firstController = TextEditingController();
  final _lastController = TextEditingController();
  final _middleController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _api = AuthApi();

  String _nameExt = '';
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _firstController.dispose();
    _lastController.dispose();
    _middleController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
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
        middleName: _middleController.text,
        nameExt: _nameExt,
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
                              pillFieldLabel('First name'),
                              TextFormField(
                                controller: _firstController,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [
                                  AutofillHints.givenName
                                ],
                                validator: _required,
                                decoration:
                                    pillFieldDecoration(hint: 'Clark Steven'),
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
                              pillFieldLabel('Last name'),
                              TextFormField(
                                controller: _lastController,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [
                                  AutofillHints.familyName
                                ],
                                validator: _required,
                                decoration:
                                    pillFieldDecoration(hint: 'Edong'),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              pillFieldLabel('Middle Name (optional)'),
                              TextFormField(
                                controller: _middleController,
                                textInputAction: TextInputAction.next,
                                autofillHints: const [
                                  AutofillHints.middleName
                                ],
                                decoration: pillFieldDecoration(),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              pillFieldLabel('Ext. (optional)'),
                              DropdownButtonFormField<String>(
                                initialValue: _nameExt,
                                items: _nameExtensions
                                    .map(
                                      (e) => DropdownMenuItem(
                                        value: e,
                                        child: Text(
                                            e.isEmpty ? '—' : e),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (v) => setState(
                                    () => _nameExt = v ?? ''),
                                decoration: pillFieldDecoration(),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    pillFieldLabel('Email Address'),
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
                      decoration: pillFieldDecoration(
                        hint: 'Enter your email',
                        icon: Icons.mail_outline_rounded,
                      ),
                    ),
                    const SizedBox(height: 16),
                    pillFieldLabel('Password'),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.newPassword],
                      validator: (v) {
                        final value = v ?? '';
                        if (value.isEmpty) return 'Password is required.';
                        if (value.length < 8) {
                          return 'At least 8 characters.';
                        }
                        return null;
                      },
                      decoration: pillFieldDecoration(
                        hint: 'At least 8 characters',
                        icon: Icons.lock_outline_rounded,
                        suffix: IconButton(
                          splashRadius: 20,
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                            size: 19,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    pillFieldLabel('Confirm Password'),
                    TextFormField(
                      controller: _confirmController,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      autofillHints: const [AutofillHints.newPassword],
                      validator: (v) {
                        if (v == null || v.isEmpty) {
                          return 'Confirm your password.';
                        }
                        if (v != _passwordController.text) {
                          return 'Passwords do not match.';
                        }
                        return null;
                      },
                      decoration: pillFieldDecoration(
                        hint: 'Re-enter password',
                        icon: Icons.lock_outline_rounded,
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      InlineBanner(message: _error!),
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

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../data/auth_api.dart';

/// Password reset flow: step 1 sends the code via /api/auth/forgot, step 2
/// completes /api/auth/reset with the emailed code + new password.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.baseUrl});

  final String baseUrl;

  @override
  State<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _api = AuthApi();

  bool _codeSent = false;
  bool _busy = false;
  bool _obscure = true;
  String? _resetToken;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool get _emailValid => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
      .hasMatch(_emailController.text.trim());

  Future<void> _sendCode() async {
    if (_busy) return;
    setState(() {
      _error = null;
      _notice = null;
    });
    if (!_emailValid) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    setState(() => _busy = true);
    try {
      final data = await _api.forgotPassword(
        baseUrl: widget.baseUrl,
        email: _emailController.text,
      );
      if (!mounted) return;
      setState(() {
        _resetToken = data['resetToken'] as String?;
        _codeSent = true;
        _notice = data['message'] as String? ??
            'If an account exists for that email, a reset code has been sent.';
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not send the code right now.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_busy) return;
    setState(() {
      _error = null;
      _notice = null;
    });
    final code = _codeController.text.trim();
    final password = _passwordController.text;
    if (code.length != 6) {
      setState(() =>
          _error = 'Enter the 6-character code from your email.');
      return;
    }
    if (password.length < 8) {
      setState(
          () => _error = 'Password must be at least 8 characters.');
      return;
    }
    if (password != _confirmController.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    final token = _resetToken;
    if (token == null || token.isEmpty) {
      setState(() => _error =
          'Request a new reset code first — this reset session is missing.');
      return;
    }
    setState(() => _busy = true);
    try {
      await _api.resetPassword(
        baseUrl: widget.baseUrl,
        resetToken: token,
        code: code,
        password: password,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Password reset! Sign in with your new password.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Reset failed. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _pillDecoration(
      {String? hint, IconData? icon, Widget? suffix}) {
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
        borderSide:
            const BorderSide(color: AppTheme.primary, width: 1.5),
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
      appBar: const NexamAppBar(title: 'Reset password'),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    _codeSent
                        ? 'Enter reset code'
                        : 'Forgot password?',
                    style: AppTheme.display(26,
                        weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _codeSent
                        ? 'We emailed you a 6-character code. Enter it with your new password.'
                        : 'Enter your account email and we\'ll send a reset code.',
                    style: const TextStyle(
                        fontSize: 13.5, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 24),
                  _label('Email Address'),
                  TextFormField(
                    controller: _emailController,
                    enabled: !_codeSent,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: _codeSent
                        ? TextInputAction.done
                        : TextInputAction.send,
                    onFieldSubmitted: (_) => _sendCode(),
                    autofillHints: const [AutofillHints.email],
                    decoration: _pillDecoration(
                      hint: 'Enter your email',
                      icon: Icons.mail_outline_rounded,
                    ),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: 16),
                    _label('Reset code'),
                    TextFormField(
                      controller: _codeController,
                      textAlign: TextAlign.center,
                      textCapitalization:
                          TextCapitalization.characters,
                      maxLength: 6,
                      keyboardType: TextInputType.visiblePassword,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                            RegExp(r'[0-9A-Za-z]')),
                      ],
                      style: AppTheme.display(20,
                              weight: FontWeight.w700)
                          .copyWith(letterSpacing: 8),
                      decoration: _pillDecoration(hint: '——————')
                          .copyWith(
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _label('New password'),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.newPassword],
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
                    const SizedBox(height: 16),
                    _label('Confirm password'),
                    TextFormField(
                      controller: _confirmController,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _reset(),
                      decoration: _pillDecoration(
                        hint: 'Repeat the new password',
                        icon: Icons.lock_outline_rounded,
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    _Banner(message: _error!, isError: true),
                  ],
                  if (_notice != null) ...[
                    const SizedBox(height: 14),
                    _Banner(message: _notice!, isError: false),
                  ],
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: _busy
                          ? null
                          : (_codeSent ? _reset : _sendCode),
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : Text(_codeSent
                              ? 'Reset password'
                              : 'Send code'),
                    ),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: 14),
                    Center(
                      child: GestureDetector(
                        onTap: _busy ? null : _sendCode,
                        child: const Text(
                          'Resend code',
                          style: TextStyle(
                            fontSize: 13.5,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppTheme.error : AppTheme.success;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(
        message,
        style: TextStyle(
            fontSize: 13, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

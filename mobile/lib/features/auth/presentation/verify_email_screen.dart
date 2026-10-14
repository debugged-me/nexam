import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nexam_app_bar.dart';
import '../../../core/widgets/pill_field.dart';
import '../../../core/widgets/states.dart';
import '../data/auth_api.dart';

/// OTP screen after registration — enters the 6-char email code and calls
/// /api/auth/verify. Pops with `true` on success so the caller can unwind.
class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({
    super.key,
    required this.baseUrl,
    required this.verifyToken,
    required this.email,
  });

  final String baseUrl;
  final String verifyToken;
  final String email;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _codeController = TextEditingController();
  final _api = AuthApi();

  bool _busy = false;
  bool _resending = false;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_busy) return;
    final code = _codeController.text.trim();
    setState(() {
      _error = null;
      _notice = null;
    });
    if (code.length != 6) {
      setState(() =>
          _error = 'Enter the 6-character code from your email.');
      return;
    }
    setState(() => _busy = true);
    try {
      await _api.verifyEmail(
        baseUrl: widget.baseUrl,
        verifyToken: widget.verifyToken,
        code: code,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Verification failed. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    if (_resending) return;
    setState(() {
      _error = null;
      _notice = null;
      _resending = true;
    });
    try {
      await _api.resendVerification(
        baseUrl: widget.baseUrl,
        verifyToken: widget.verifyToken,
      );
      if (!mounted) return;
      setState(
          () => _notice = 'A new code is on its way to your inbox.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not resend the code right now.');
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: const NexamAppBar(title: 'Verify email'),
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
                    'Check your email',
                    style:
                        AppTheme.display(26, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'We sent a 6-character verification code to ${widget.email}.',
                    style: TextStyle(
                        fontSize: 13.5, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 24),
                  pillFieldLabel('Verification code'),
                  TextFormField(
                    controller: _codeController,
                    textAlign: TextAlign.center,
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 6,
                    keyboardType: TextInputType.visiblePassword,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                          RegExp(r'[0-9A-Za-z]')),
                    ],
                    onFieldSubmitted: (_) => _verify(),
                    style: AppTheme.display(20,
                            weight: FontWeight.w700)
                        .copyWith(letterSpacing: 8),
                    decoration: pillFieldDecoration(
                      hint: 'A1B2C3',
                      contentPadding:
                          const EdgeInsets.symmetric(vertical: 18),
                    ).copyWith(counterText: ''),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    InlineBanner(message: _error!, isError: true),
                  ],
                  if (_notice != null) ...[
                    const SizedBox(height: 14),
                    InlineBanner(message: _notice!, isError: false),
                  ],
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: _busy ? null : _verify,
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Verify'),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Didn't get the code? ",
                        style: TextStyle(
                            fontSize: 13.5,
                            color: AppTheme.textMuted),
                      ),
                      GestureDetector(
                        onTap: _resending ? null : _resend,
                        child: Text(
                          _resending ? 'Sending…' : 'Resend',
                          style: TextStyle(
                            fontSize: 13.5,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Center(
                    child: Text(
                      'You can sign in once your account is approved.',
                      textAlign: TextAlign.center,
                      style: AppTheme.body(size: 12.5),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/network/server_address.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pill_field.dart';
import 'auth_controller.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

/// Login — a single clean screen: brand mark, headline, and the form.
/// The instructor's Nexam web credentials work here unchanged; the API
/// address lives in a bottom sheet instead of a form field.
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
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  late String _baseUrl;
  bool _obscurePassword = true;
  bool _submitting = false;

  /// The web client ID the server reports for Google sign-in — also the
  /// serverClientId the SDK mints ID tokens against. Empty hides the button.
  String _googleClientId = '';

  @override
  void initState() {
    super.initState();
    final saved = widget.controller.savedBaseUrl;
    _baseUrl = initialServerUrl(saved: saved, platform: defaultTargetPlatform);
    _loadGoogleConfig();
  }

  /// Whether the server has Google sign-in configured — best-effort, so a
  /// failure just hides the button rather than blocking the form.
  Future<void> _loadGoogleConfig() async {
    final id = await widget.controller.googleClientId(_baseUrl);
    if (mounted && id.isNotEmpty) setState(() => _googleClientId = id);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String get _serverHost {
    final uri = Uri.tryParse(_baseUrl);
    return uri?.host ?? _baseUrl;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _submitting = true);

    final success = await widget.controller.login(
      baseUrl: _baseUrl,
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

  /// Google SSO — the SDK mints an ID token whose audience is the server's
  /// web client ID; the API verifies it and applies the same approval rules
  /// as password sign-in. A cancelled sheet is silent, not an error.
  Future<void> _submitGoogle() async {
    FocusScope.of(context).unfocus();
    setState(() => _submitting = true);

    bool success = false;
    try {
      await GoogleSignIn.instance.initialize(serverClientId: _googleClientId);
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        throw StateError('Google did not return a sign-in token.');
      }
      success = await widget.controller.loginWithGoogle(
        baseUrl: _baseUrl,
        idToken: idToken,
      );
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled &&
          e.code != GoogleSignInExceptionCode.interrupted) {
        _showError('Google sign-in failed. Please try again.');
      }
    } catch (_) {
      _showError('Google sign-in failed. Please try again.');
    }

    if (!mounted) return;
    setState(() => _submitting = false);

    if (success) {
      widget.onLoginSuccess();
    } else if (widget.controller.error != null) {
      _showError(widget.controller.error!);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  /// The API address is a "settings" concern, not a credential — collect it
  /// in a modal sheet the user only opens when the default is wrong.
  Future<void> _editServer() async {
    final controller = TextEditingController(text: _baseUrl);
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 12,
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.cardBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Server address',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Where the Nexam API is running — your computer’s IP on the same Wi-Fi, e.g. http://192.168.1.5:3000',
              style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                hintText: 'http://192.168.1.5:3000',
                prefixIcon: Icon(Icons.dns_rounded),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () =>
                  Navigator.of(sheetContext).pop(controller.text.trim()),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (result != null && result.isNotEmpty) {
      setState(() => _baseUrl = result);
    }
  }

  /// White pill field — label above a rounded white input, shared
  /// decoration from `pill_field.dart`.
  Widget _labeledField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    required String hint,
    bool obscure = false,
    Widget? suffix,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    Iterable<String>? autofillHints,
    String? Function(String?)? validator,
    ValueChanged<String>? onSubmitted,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        pillFieldLabel(label),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          validator: validator,
          onFieldSubmitted: onSubmitted,
          decoration: pillFieldDecoration(
            hint: hint,
            icon: icon,
            suffix: suffix,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight:
                      MediaQuery.of(context).size.height -
                      MediaQuery.of(context).padding.top -
                      MediaQuery.of(context).padding.bottom -
                      60,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Spacer(),
                    // Full-width wordmark banner — always white behind
                    // the dark-navy mark so it stays legible in dark mode.
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.cardBorder),
                        boxShadow: AppTheme.cardShadow,
                      ),
                      child: Image.asset(
                        'assets/icons/nexam_banner.png',
                        fit: BoxFit.fitWidth,
                        semanticLabel: 'nexam — AI Exam Builder',
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Welcome back!',
                      textAlign: TextAlign.center,
                      style: AppTheme.display(27, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      'Best way to manage your scans.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13.5,
                        color: AppTheme.textMuted,
                      ),
                    ),
                    const SizedBox(height: 28),
                    Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _labeledField(
                            label: 'Email Address',
                            controller: _emailController,
                            icon: Icons.mail_outline_rounded,
                            hint: 'Enter your email',
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.email],
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Email is required.'
                                : null,
                          ),
                          const SizedBox(height: 14),
                          _labeledField(
                            label: 'Password',
                            controller: _passwordController,
                            icon: Icons.lock_outline_rounded,
                            hint: 'Enter your password',
                            obscure: _obscurePassword,
                            suffix: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_rounded
                                    : Icons.visibility_rounded,
                                size: 19,
                              ),
                              onPressed: () => setState(
                                () => _obscurePassword = !_obscurePassword,
                              ),
                            ),
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.password],
                            validator: (v) => (v == null || v.isEmpty)
                                ? 'Password is required.'
                                : null,
                            onSubmitted: (_) => _submit(),
                          ),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      ForgotPasswordScreen(baseUrl: _baseUrl),
                                ),
                              ),
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                minimumSize: const Size(0, 32),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: Text(
                                'Forgot password?',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(double.infinity, 54),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            onPressed: _submitting ? null : _submit,
                            child: _submitting
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Log In'),
                          ),
                          if (_googleClientId.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: Divider(color: AppTheme.cardBorder),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  child: Text(
                                    'or',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Divider(color: AppTheme.cardBorder),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppTheme.textDark,
                                minimumSize: const Size(double.infinity, 54),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                side: BorderSide(color: AppTheme.cardBorder),
                              ),
                              onPressed: _submitting ? null : _submitGoogle,
                              child: const Text(
                                'Continue with Google',
                                style: TextStyle(fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const Spacer(),

                    // Bottom link — in the scroll flow, not an overlay:
                    // a keyboard-shrunk viewport scrolls it below the fold
                    // instead of pinning it over the password field.
                    Padding(
                      padding: const EdgeInsets.only(top: 24, bottom: 14),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            "Don't have an account? ",
                            style: TextStyle(
                              fontSize: 12.5,
                              color: AppTheme.textMuted,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    RegisterScreen(baseUrl: _baseUrl),
                              ),
                            ),
                            child: Text(
                              'Sign up',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: AppTheme.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Server access — a settings concern, tucked into the
            // corner gear instead of competing with the form.
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                onPressed: _editServer,
                icon: Icon(
                  Icons.dns_rounded,
                  size: 20,
                  color: AppTheme.textMuted,
                ),
                tooltip: 'Server: $_serverHost',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

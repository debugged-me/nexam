import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
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

  /// Sensible dev default: the Android emulator reaches the host machine
  /// through 10.0.2.2; everything else (web included) can try localhost
  /// first. Whatever the user last used still wins via [SessionStore].
  static String get _platformDefaultUrl =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000';

  @override
  void initState() {
    super.initState();
    final saved = widget.controller.savedBaseUrl;
    _baseUrl = saved.isNotEmpty ? saved : _platformDefaultUrl;
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
      backgroundColor: Colors.white,
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
            const Text(
              'Server address',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
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
                prefixIcon: Icon(Icons.dns_outlined),
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

  /// White pill field from the reference — a small label sits above a
  /// rounded white input with a leading icon.
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
    final shape = OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: AppTheme.cardBorder),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 7),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.textDark,
            ),
          ),
        ),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          validator: validator,
          onFieldSubmitted: onSubmitted,
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: Colors.white,
            prefixIcon: Icon(icon, size: 19),
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
            contentPadding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 16),
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
                  minHeight: MediaQuery.of(context).size.height -
                      MediaQuery.of(context).padding.top -
                      MediaQuery.of(context).padding.bottom -
                      60,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 56,
                        height: 56,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius:
                              BorderRadius.circular(17),
                          border:
                              Border.all(color: AppTheme.cardBorder),
                          boxShadow: AppTheme.cardShadow,
                        ),
                        child: Image.asset(
                            'assets/icons/nexam_logo.png'),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Welcome back!',
                      textAlign: TextAlign.center,
                      style: AppTheme.display(27,
                          weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 5),
                    const Text(
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
                        crossAxisAlignment:
                            CrossAxisAlignment.stretch,
                        children: [
                          _labeledField(
                            label: 'Email Address',
                            controller: _emailController,
                            icon: Icons.mail_outline_rounded,
                            hint: 'Enter your email',
                            keyboardType:
                                TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [
                              AutofillHints.email
                            ],
                            validator: (v) =>
                                (v == null || v.trim().isEmpty)
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
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 19,
                              ),
                              onPressed: () => setState(() =>
                                  _obscurePassword =
                                      !_obscurePassword),
                            ),
                            textInputAction: TextInputAction.done,
                            autofillHints: const [
                              AutofillHints.password
                            ],
                            validator: (v) => (v == null || v.isEmpty)
                                ? 'Password is required.'
                                : null,
                            onSubmitted: (_) => _submit(),
                          ),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () =>
                                  Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      ForgotPasswordScreen(
                                          baseUrl: _baseUrl),
                                ),
                              ),
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 4),
                                minimumSize: const Size(0, 32),
                                tapTargetSize:
                                    MaterialTapTargetSize
                                        .shrinkWrap,
                              ),
                              child: const Text(
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
                              minimumSize:
                                  const Size(double.infinity, 54),
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(16),
                              ),
                            ),
                            onPressed:
                                _submitting ? null : _submit,
                            child: _submitting
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child:
                                        CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Log In'),
                          ),
                          const SizedBox(height: 22),
                          Row(
                            children: [
                              const Expanded(
                                  child: Divider(height: 1)),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(
                                        horizontal: 12),
                                child: Text(
                                  'Connection',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppTheme.textMuted
                                        .withValues(alpha: 0.8),
                                  ),
                                ),
                              ),
                              const Expanded(
                                  child: Divider(height: 1)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // Server pill — same shape as the
                          // reference's secondary pill buttons.
                          OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              minimumSize:
                                  const Size(double.infinity, 50),
                              side: const BorderSide(
                                  color: AppTheme.cardBorder),
                              backgroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(999),
                              ),
                            ),
                            onPressed: _editServer,
                            child: Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration:
                                      const BoxDecoration(
                                    color: AppTheme.success,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    _serverHost,
                                    overflow:
                                        TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: AppTheme.textMuted,
                                      fontWeight:
                                          FontWeight.w500,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Text(
                                  'Change',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    color: AppTheme.primary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom link — the reference's "Don't have an account? Sign up".
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
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
                        child: const Text(
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
              ),
            ),
          ],
        ),
      ),
    );
  }
}

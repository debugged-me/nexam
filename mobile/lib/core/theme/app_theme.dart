import 'package:flutter/material.dart';

/// App-wide theme — a native mobile fintech look: deep navy ink, a vivid
/// electric-blue accent, soft gray surfaces, generous corner radii, and
/// quiet shadows. Screen files reference these constants by name, so keep
/// them stable when retuning.
class AppTheme {
  AppTheme._();

  // ── Typography ───────────────────────────────────────────────────────────
  /// Sora — the single family the web platform uses for display and body.
  /// The web's "Google Sans"/"Inter" aliases resolve to Sora, so one
  /// family here reproduces the platform look exactly.
  static const String fontUi = 'Sora';
  static const String fontDisplay = 'Sora';

  /// Tabular-figure text style for big numbers — digits align like a
  /// bank ledger instead of jumping around.
  static TextStyle display(
    double size, {
    FontWeight weight = FontWeight.w700,
    Color color = textDark,
    double letterSpacing = -0.6,
  }) =>
      TextStyle(
        fontFamily: fontDisplay,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
        height: 1.08,
      );

  // ── Brand palette — mirrored from web tokens.css ─────────────────────────
  static const Color primary = Color(0xFF2383E2);   // --action-600
  static const Color primaryLight = Color(0xFF4FA1EC); // --action-400
  static const Color primaryDark = Color(0xFF1B6EC2);  // --action-700

  /// Near-black brand ink — hero cards, splash, dark camera UI.
  static const Color ink = Color(0xFF141413);     // --brand
  static const Color inkSoft = Color(0xFF3D3D3A); // --brand-soft

  static const Color surface = Color(0xFFF6F8FA);   // --surface-2
  static const Color surfaceAlt = Color(0xFFEDF0F4); // --surface-3
  static const Color cardBorder = Color(0xFFE8EBEF); // --line
  static const Color textDark = Color(0xFF26292E);   // --ink
  static const Color textMuted = Color(0xFF4E545B);  // --ink-2
  static const Color textFaint = Color(0xFF959BA3);  // --ink-faint

  // ── Semantic colors (monday-tuned, same as web) ──────────────────────────
  static const Color success = Color(0xFF23A265); // --green-600
  static const Color warning = Color(0xFFB07D1E); // --amber-600
  static const Color error = Color(0xFFDC4445);   // --red-600
  static const Color info = Color(0xFF2383E2);

  // ── Washed icon-tile tints (web status washes) ───────────────────────────
  static const Color tintBlue = Color(0xFFE8F1FC);   // --action-50
  static const Color tintGreen = Color(0xFFE9F6EF);  // --green-50
  static const Color tintAmber = Color(0xFFFBF1DC);  // --amber-50
  static const Color tintViolet = Color(0xFFF3EFFF); // --purple-50

  // ── Radius scale ─────────────────────────────────────────────────────────
  static const double radiusSm = 10;
  static const double radiusMd = 16;
  static const double radiusLg = 22;

  /// Blue gradient hero — matches the web dashboard's blue hero card.
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryDark, primary],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [primary, primaryLight],
  );

  static List<BoxShadow> cardShadow = [
    BoxShadow(
      color: ink.withValues(alpha: 0.06),
      blurRadius: 18,
      offset: const Offset(0, 6),
    ),
  ];

  static ThemeData build() {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      surface: surface,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme.copyWith(
        primary: primary,
        surface: surface,
      ),
      scaffoldBackgroundColor: surface,
      fontFamily: fontUi,
      fontFamilyFallback: const [fontDisplay],
      textTheme: const TextTheme(
        displayLarge: TextStyle(
            fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -1.1),
        displayMedium: TextStyle(
            fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.9),
        headlineMedium: TextStyle(
            fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.6),
        titleLarge: TextStyle(
            fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.4),
        titleMedium: TextStyle(
            fontSize: 15.5, fontWeight: FontWeight.w700, letterSpacing: -0.2),
        titleSmall: TextStyle(
            fontSize: 13.5, fontWeight: FontWeight.w600, letterSpacing: -0.1),
        bodyLarge: TextStyle(
            fontSize: 15.5, fontWeight: FontWeight.w400, letterSpacing: -0.1),
        bodyMedium: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w400, letterSpacing: -0.05),
        bodySmall: TextStyle(
            fontSize: 12.5, fontWeight: FontWeight.w400),
        labelLarge: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: -0.1),
        labelMedium: TextStyle(
            fontSize: 12, fontWeight: FontWeight.w600),
      ).apply(
        bodyColor: textDark,
        displayColor: textDark,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textDark,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: const BorderSide(color: cardBorder),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceAlt,
        labelStyle: const TextStyle(color: textMuted, fontSize: 14),
        hintStyle: const TextStyle(color: textFaint, fontSize: 14),
        floatingLabelStyle: const TextStyle(color: primary, fontSize: 13),
        prefixIconColor: textFaint,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: error),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: primary.withValues(alpha: 0.45),
          minimumSize: const Size(double.infinity, 54),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.1,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          minimumSize: const Size(double.infinity, 50),
          side: const BorderSide(color: cardBorder),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: cardBorder,
        thickness: 1,
        space: 0,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
      ),
      progressIndicatorTheme:
          const ProgressIndicatorThemeData(color: primary),
    );
  }
}

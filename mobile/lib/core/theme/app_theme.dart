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

  /// Active brightness — set from MaterialApp's builder each time the
  /// theme resolves. Static palette getters below read it, so widgets can
  /// keep using `AppTheme.textDark` and stay mode-aware.
  static Brightness brightness = Brightness.light;
  static bool get _dark => brightness == Brightness.dark;

  // Light/dark palette pairs — light values are the original constants;
  // dark values mirror tokens.css [data-theme="dark"] overrides.
  static const Color _lPrimary = Color(0xFF2383E2);
  static const Color _dPrimary = Color(0xFF4A9FEF);   // --action-600 dark
  static const Color _lCard = Color(0xFFFFFFFF);
  static const Color _dCard = Color(0xFF1B1E23);      // --surface dark
  static const Color _lSurface = Color(0xFFF6F8FA);
  static const Color _dSurface = Color(0xFF14161A);   // --canvas dark
  static const Color _lSurfaceAlt = Color(0xFFEDF0F4);
  static const Color _dSurfaceAlt = Color(0xFF22262C);// --surface-2 dark
  static const Color _lLine = Color(0xFFE8EBEF);
  static const Color _dLine = Color(0xFF2C3138);      // --line dark
  static const Color _lInk1 = Color(0xFF26292E);
  static const Color _dInk1 = Color(0xFFE5E7EA);      // --ink dark
  static const Color _lInk2 = Color(0xFF4E545B);
  static const Color _dInk2 = Color(0xFFBFC5CC);      // --ink-2 dark
  static const Color _lInk3 = Color(0xFF959BA3);
  static const Color _dInk3 = Color(0xFF707781);      // --ink-faint dark
  static const Color _lSuccess = Color(0xFF23A265);
  static const Color _dSuccess = Color(0xFF3FB97A);   // --green-600 dark
  static const Color _lWarning = Color(0xFFB07D1E);
  static const Color _dWarning = Color(0xFFE0A83F);   // --amber-600 dark
  static const Color _lError = Color(0xFFDC4445);
  static const Color _dError = Color(0xFFE85D5E);     // --red-600 dark
  static const Color _lTintBlue = Color(0xFFE8F1FC);
  static const Color _dTintBlue = Color(0xFF152740);  // --action-50 dark
  static const Color _lTintGreen = Color(0xFFE9F6EF);
  static const Color _dTintGreen = Color(0xFF132A1F); // --green-50 dark
  static const Color _lTintAmber = Color(0xFFFBF1DC);
  static const Color _dTintAmber = Color(0xFF2F2510); // --amber-50 dark
  static const Color _lTintViolet = Color(0xFFF3EFFF);
  static const Color _dTintViolet = Color(0xFF221C36);// --purple-50 dark

  /// Tabular-figure text style for big numbers — digits align like a
  /// bank ledger instead of jumping around.
  static TextStyle display(
    double size, {
    FontWeight weight = FontWeight.w700,
    Color? color,
    double letterSpacing = -0.6,
  }) =>
      TextStyle(
        fontFamily: fontDisplay,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        color: color ?? textDark,
        fontFeatures: const [FontFeature.tabularFigures()],
        height: 1.08,
      );

  /// Uppercase micro-label — section headers ("ITEM LEDGER"), stat
  /// captions, chart titles. Default color is muted, never faint — at
  /// this size faint text fails contrast.
  static TextStyle micro({Color? color}) => TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.3,
        color: color ?? textMuted,
      );

  /// Semibold label — field labels, chip text, nav captions.
  static TextStyle label({
    double size = 13,
    Color? color,
    FontWeight weight = FontWeight.w600,
  }) =>
      TextStyle(fontSize: size, fontWeight: weight, color: color ?? textDark);

  /// Standard body text.
  static TextStyle body({
    double size = 13.5,
    Color? color,
    FontWeight weight = FontWeight.w400,
    double? height,
  }) =>
      TextStyle(
        fontSize: size,
        fontWeight: weight,
        color: color ?? textMuted,
        height: height,
      );

  /// Row title — names/titles inside ledger rows.
  static TextStyle rowTitle({double size = 14, Color? color}) =>
      TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.1,
        color: color ?? textDark,
      );

  // ── Brand palette — mirrored from web tokens.css ─────────────────────────
  // Dark values mirror tokens.css [data-theme="dark"] overrides: the action
  // blue is brightened so fills read on dark surfaces.
  static Color get primary => _dark ? _dPrimary : _lPrimary;
  static const Color primaryLight = Color(0xFF4FA1EC); // --action-400
  static const Color primaryDark = Color(0xFF1B6EC2);  // --action-700

  /// Near-black brand ink — hero cards, splash, dark camera UI. Stays
  /// literal: it is a graphic color, not a surface token.
  static const Color ink = Color(0xFF141413);     // --brand
  static const Color inkSoft = Color(0xFF3D3D3A); // --brand-soft

  /// Raised card surface — white in light, --surface in dark.
  static Color get card => _dark ? _dCard : _lCard;
  static Color get surface => _dark ? _dSurface : _lSurface;
  static Color get surfaceAlt => _dark ? _dSurfaceAlt : _lSurfaceAlt;
  static Color get cardBorder => _dark ? _dLine : _lLine;
  static Color get textDark => _dark ? _dInk1 : _lInk1;
  static Color get textMuted => _dark ? _dInk2 : _lInk2;
  static Color get textFaint => _dark ? _dInk3 : _lInk3;

  // ── Semantic colors (monday-tuned, same as web) ──────────────────────────
  static Color get success => _dark ? _dSuccess : _lSuccess;
  static Color get warning => _dark ? _dWarning : _lWarning;
  static Color get error => _dark ? _dError : _lError;
  static Color get info => primary;

  // ── Washed icon-tile tints (web status washes → their dark counterparts) ──
  static Color get tintBlue => _dark ? _dTintBlue : _lTintBlue;
  static Color get tintGreen => _dark ? _dTintGreen : _lTintGreen;
  static Color get tintAmber => _dark ? _dTintAmber : _lTintAmber;
  static Color get tintViolet => _dark ? _dTintViolet : _lTintViolet;

  // ── Radius scale ─────────────────────────────────────────────────────────
  static const double radiusSm = 10;
  static const double radiusMd = 16;
  static const double radiusLg = 22;

  /// Blue gradient hero — matches the web dashboard's blue hero card.
  /// Stays vivid in dark mode: it is artwork, not a surface.
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryDark, _lPrimary],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [_lPrimary, primaryLight],
  );

  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: _dark ? Colors.black.withValues(alpha: 0.4) : ink.withValues(alpha: 0.06),
          blurRadius: 18,
          offset: const Offset(0, 6),
        ),
      ];

  static ThemeData build() => _build(Brightness.light);
  static ThemeData buildDark() => _build(Brightness.dark);

  static ThemeData _build(Brightness b) {
    // Resolve against the requested brightness — the static flag tracks the
    // *applied* theme and is still the previous mode while this runs.
    final d = b == Brightness.dark;
    final primary = d ? _dPrimary : _lPrimary;
    final card = d ? _dCard : _lCard;
    final surface = d ? _dSurface : _lSurface;
    final surfaceAlt = d ? _dSurfaceAlt : _lSurfaceAlt;
    final line = d ? _dLine : _lLine;
    final ink1 = d ? _dInk1 : _lInk1;
    final ink2 = d ? _dInk2 : _lInk2;
    final ink3 = d ? _dInk3 : _lInk3;
    final error = d ? _dError : _lError;

    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      surface: surface,
      brightness: b,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: b,
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
        bodyColor: ink1,
        displayColor: ink1,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: ink1,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: ink1,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: BorderSide(color: line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceAlt,
        labelStyle: TextStyle(color: ink2, fontSize: 14.5),
        hintStyle: TextStyle(color: ink3, fontSize: 14.5),
        floatingLabelStyle: TextStyle(color: primary, fontSize: 13),
        prefixIconColor: ink3,
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
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: error),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
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
          side: BorderSide(color: line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: line,
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
          ProgressIndicatorThemeData(color: primary),
    );
  }
}

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The auth/form visual language: a bold label above a white pill input.
/// Shared by login, register, verify, and forgot-password so the fields
/// can't drift apart.
InputDecoration pillFieldDecoration({
  String? hint,
  IconData? icon,
  Widget? suffix,
  EdgeInsetsGeometry? contentPadding,
}) {
  final shape = OutlineInputBorder(
    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
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
    focusedErrorBorder: shape.copyWith(
      borderSide: const BorderSide(color: AppTheme.error, width: 1.5),
    ),
    contentPadding: contentPadding ??
        const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );
}

/// The bold label that sits above a pill field.
Widget pillFieldLabel(String text) => Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 7),
      child: Text(text, style: AppTheme.label()),
    );

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock to portrait orientation for stable scanning.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Swallow uncaught async errors to prevent red-screen crashes.
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('FlutterError.onError: ${details.exception}');
  };

  runApp(const NexamOmrApp());
}

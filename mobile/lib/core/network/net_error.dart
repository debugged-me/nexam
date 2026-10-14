import 'dart:async';

import 'package:http/http.dart' as http;

import 'net_error_stub.dart'
    if (dart.library.io) 'net_error_io.dart' as platform;

/// True when [error] means the request never got a usable response —
/// socket/HTTP failures on native, browser network failures on web (the
/// `http` package surfaces those as [http.ClientException]), and request
/// timeouts (a stalled connection counts as unreachable for offline
/// queuing — the sheet must never hang the submit flow).
bool isNetworkError(Object error) =>
    error is http.ClientException ||
    error is TimeoutException ||
    platform.isIoNetworkError(error);

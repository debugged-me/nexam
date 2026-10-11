import 'dart:io';

/// Native implementation — socket and HTTP-layer failures count as
/// network errors.
bool isIoNetworkError(Object error) =>
    error is SocketException || error is HttpException;

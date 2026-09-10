/// Network-level exception thrown by all API calls.
///
/// Carries enough context for the UI to distinguish a transient network
/// failure (retry) from an authentication failure (re-login) or a
/// validation error (show the message).
class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.isNetworkError = false,
    this.statusCode,
  });

  final String message;
  final bool isNetworkError;

  /// HTTP status behind the failure, when there was one. Lets a caller tell
  /// an expired session (401) apart from a transient network blip.
  final int? statusCode;

  bool get isSessionExpired => statusCode == 401;

  /// Failures for which retrying the exact same write is safe and useful.
  bool get isRetryable =>
      isNetworkError ||
      statusCode == 408 ||
      statusCode == 429 ||
      (statusCode != null && statusCode! >= 500);

  @override
  String toString() => message;
}

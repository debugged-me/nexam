/// Web/default implementation — `dart:io` doesn't exist here, so there are
/// no IO-only network exception types to match.
bool isIoNetworkError(Object error) => false;

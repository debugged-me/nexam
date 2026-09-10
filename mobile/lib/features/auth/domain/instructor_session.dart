/// Authenticated instructor session.
class InstructorSession {
  const InstructorSession({
    required this.baseUrl,
    required this.token,
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
  });

  final String baseUrl;
  final String token;
  final String id;
  final String fullName;
  final String email;
  final String role;

  factory InstructorSession.fromApi(Map<String, dynamic> data,
      {required String baseUrl, String? fallbackToken}) {
    final user = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
    return InstructorSession(
      baseUrl: baseUrl,
      token: data['token'] as String? ?? fallbackToken ?? '',
      id: user['id'] as String? ?? '',
      fullName: user['full_name'] as String? ?? '',
      email: user['email'] as String? ?? '',
      role: user['role'] as String? ?? 'instructor',
    );
  }

  Map<String, dynamic> toJson() => {
        'baseUrl': baseUrl,
        'token': token,
        'id': id,
        'fullName': fullName,
        'email': email,
        'role': role,
      };

  factory InstructorSession.fromStorage(Map<String, dynamic> data) {
    return InstructorSession(
      baseUrl: data['baseUrl'] as String? ?? '',
      token: data['token'] as String? ?? '',
      id: data['id'] as String? ?? '',
      fullName: data['fullName'] as String? ?? '',
      email: data['email'] as String? ?? '',
      role: data['role'] as String? ?? 'instructor',
    );
  }

  @override
  String toString() => 'InstructorSession($email @ $baseUrl)';
}

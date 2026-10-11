/// Authenticated instructor session.
class InstructorSession {
  const InstructorSession({
    required this.baseUrl,
    required this.token,
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.firstName = '',
    this.middleName = '',
    this.lastName = '',
    this.nameExt = '',
    this.hasAvatar = false,
    this.avatarV = 0,
  });

  final String baseUrl;
  final String token;
  final String id;
  final String fullName;
  final String email;
  final String role;

  /// Name parts — editable on the web account page and the app's
  /// Edit profile screen via PUT /api/auth/me.
  final String firstName;
  final String middleName;
  final String lastName;
  final String nameExt;

  /// Whether the instructor uploaded a profile photo (web account page).
  final bool hasAvatar;

  /// Avatar cache version — bump in the URL when the photo changes.
  final int avatarV;

  factory InstructorSession.fromApi(Map<String, dynamic> data,
      {required String baseUrl, String? fallbackToken}) {
    final user = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
    return InstructorSession(
      baseUrl: baseUrl,
      // MySQL ids come back as ints — toString() them instead of casting
      // (an `as String?` cast throws a TypeError on a numeric id and the
      // login surface would report a bogus "unexpected error").
      token: data['token']?.toString() ?? fallbackToken ?? '',
      id: user['id']?.toString() ?? '',
      fullName: user['full_name']?.toString() ?? '',
      email: user['email']?.toString() ?? '',
      role: user['role']?.toString() ?? 'instructor',
      firstName: user['first_name']?.toString() ?? '',
      middleName: user['middle_name']?.toString() ?? '',
      lastName: user['last_name']?.toString() ?? '',
      nameExt: user['name_ext']?.toString() ?? '',
      hasAvatar:
          user['has_avatar'] == true || user['has_avatar'] == 1,
      avatarV:
          int.tryParse(user['avatar_v']?.toString() ?? '') ?? 0,
    );
  }

  InstructorSession copyWith({
    String? fullName,
    String? firstName,
    String? middleName,
    String? lastName,
    String? nameExt,
    bool? hasAvatar,
    int? avatarV,
  }) {
    return InstructorSession(
      baseUrl: baseUrl,
      token: token,
      id: id,
      fullName: fullName ?? this.fullName,
      email: email,
      role: role,
      firstName: firstName ?? this.firstName,
      middleName: middleName ?? this.middleName,
      lastName: lastName ?? this.lastName,
      nameExt: nameExt ?? this.nameExt,
      hasAvatar: hasAvatar ?? this.hasAvatar,
      avatarV: avatarV ?? this.avatarV,
    );
  }

  Map<String, dynamic> toJson() => {
        'baseUrl': baseUrl,
        'token': token,
        'id': id,
        'fullName': fullName,
        'email': email,
        'role': role,
        'firstName': firstName,
        'middleName': middleName,
        'lastName': lastName,
        'nameExt': nameExt,
        'hasAvatar': hasAvatar,
        'avatarV': avatarV,
      };

  factory InstructorSession.fromStorage(Map<String, dynamic> data) {
    return InstructorSession(
      baseUrl: data['baseUrl'] as String? ?? '',
      token: data['token'] as String? ?? '',
      id: data['id'] as String? ?? '',
      fullName: data['fullName'] as String? ?? '',
      email: data['email'] as String? ?? '',
      role: data['role'] as String? ?? 'instructor',
      firstName: data['firstName'] as String? ?? '',
      middleName: data['middleName'] as String? ?? '',
      lastName: data['lastName'] as String? ?? '',
      nameExt: data['nameExt'] as String? ?? '',
      hasAvatar: data['hasAvatar'] == true,
      avatarV: data['avatarV'] is int ? data['avatarV'] as int : 0,
    );
  }

  @override
  String toString() => 'InstructorSession($email @ $baseUrl)';
}

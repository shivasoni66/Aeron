import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../core/constants.dart';
import '../models/auth_user.dart';
import 'secure_storage_service.dart';

class CitizenAuthTokens {
  final String accessToken;
  final String? refreshToken;
  final int expiresInSeconds;
  final CitizenAuthUser user;

  CitizenAuthTokens({
    required this.accessToken,
    this.refreshToken,
    required this.expiresInSeconds,
    required this.user,
  });

  factory CitizenAuthTokens.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return CitizenAuthTokens(
      accessToken: data['accessToken'] as String? ?? '',
      refreshToken: data['refreshToken'] as String?,
      expiresInSeconds: data['expiresInSeconds'] as int? ?? 900,
      user: CitizenAuthUser.fromJson(
        data['user'] as Map<String, dynamic>? ?? {},
      ),
    );
  }
}

class CitizenAuthService extends ChangeNotifier {
  static final CitizenAuthService _instance = CitizenAuthService._internal();
  factory CitizenAuthService() => _instance;
  CitizenAuthService._internal();

  final SecureStorageService _storage = SecureStorageService();

  CitizenAuthUser? _currentUser;
  bool _isLoading = true;

  CitizenAuthUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;

  /// Initialize session from secure storage.
  Future<void> initialize() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _storage.getAccessToken();
      if (token != null) {
        final profileOk = await _fetchProfile(token);
        if (!profileOk) {
          // Token may be expired; try rotating refresh token
          await refresh();
        }
      } else {
        _currentUser = null;
      }
    } catch (_) {
      _currentUser = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Public Citizen Registration.
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final uri = Uri.parse('${AppConstants.apiBaseUrl}/auth/register');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'FLUTTER',
        },
        body: jsonEncode({
          'name': name.trim(),
          'email': email.trim().toLowerCase(),
          'password': password,
          'clientType': 'FLUTTER',
        }),
      );

      final json = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode == 201) {
        // Automatically login on successful registration
        await login(email: email, password: password);
        return {'success': true, 'message': 'Account created successfully'};
      } else {
        return {
          'success': false,
          'message': json['message'] as String? ?? 'Registration failed',
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  /// Mobile Login with Secure Storage of JWT and Refresh Token.
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final uri = Uri.parse('${AppConstants.apiBaseUrl}/auth/login');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'FLUTTER',
        },
        body: jsonEncode({
          'email': email.trim().toLowerCase(),
          'password': password,
          'clientType': 'FLUTTER',
        }),
      );

      final json = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode == 200) {
        final tokens = CitizenAuthTokens.fromJson(json);

        // Security check: Must be a citizen or admin account
        if (tokens.user.role != 'citizen' && tokens.user.role != 'admin') {
          return {
            'success': false,
            'message': 'This application is restricted to Citizen accounts. Please use Manager or Admin GCS.',
          };
        }

        await _storage.saveTokens(
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
        await _storage.saveCachedUser(tokens.user);

        _currentUser = tokens.user;
        notifyListeners();
        return {'success': true};
      } else {
        return {
          'success': false,
          'message': json['message'] as String? ?? 'Invalid email or password',
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  /// Rotate single-use refresh token.
  Future<bool> refresh() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) {
        await logout();
        return false;
      }

      final uri = Uri.parse('${AppConstants.apiBaseUrl}/auth/refresh');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'FLUTTER',
        },
        body: jsonEncode({
          'refreshToken': refreshToken,
          'clientType': 'FLUTTER',
        }),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final tokens = CitizenAuthTokens.fromJson(json);

        await _storage.saveTokens(
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
        _currentUser = tokens.user;
        notifyListeners();
        return true;
      } else {
        await logout();
        return false;
      }
    } catch (_) {
      await logout();
      return false;
    }
  }

  /// Fetch authoritative profile from backend.
  Future<bool> _fetchProfile(String token) async {
    try {
      final uri = Uri.parse('${AppConstants.apiBaseUrl}/citizen/profile');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'X-Client-Platform': 'FLUTTER',
        },
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final data = json['data'] as Map<String, dynamic>;
        _currentUser = CitizenAuthUser.fromJson(data);
        await _storage.saveCachedUser(_currentUser!);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Reload current profile stats.
  Future<void> reloadProfile() async {
    final token = await _storage.getAccessToken();
    if (token != null) {
      await _fetchProfile(token);
      notifyListeners();
    }
  }

  /// Revoke current session.
  Future<void> logout() async {
    try {
      final token = await _storage.getAccessToken();
      final refreshToken = await _storage.getRefreshToken();

      if (token != null && refreshToken != null) {
        final uri = Uri.parse('${AppConstants.apiBaseUrl}/auth/logout');
        await http.post(
          uri,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
            'X-Client-Platform': 'FLUTTER',
          },
          body: jsonEncode({'refreshToken': refreshToken}),
        );
      }
    } catch (_) {}

    await _storage.clearAll();
    _currentUser = null;
    notifyListeners();
  }

  /// Revoke all active sessions.
  Future<void> logoutAll() async {
    try {
      final token = await _storage.getAccessToken();
      if (token != null) {
        final uri = Uri.parse('${AppConstants.apiBaseUrl}/auth/logout-all');
        await http.post(
          uri,
          headers: {
            'Authorization': 'Bearer $token',
            'X-Client-Platform': 'FLUTTER',
          },
        );
      }
    } catch (_) {}

    await _storage.clearAll();
    _currentUser = null;
    notifyListeners();
  }
}

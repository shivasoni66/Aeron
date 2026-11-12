import 'dart:convert';
import 'dart:io';
import '../core/constants.dart';

class ApiClient {
  final HttpClient _httpClient = HttpClient();

  Future<Map<String, dynamic>> checkHealth() async {
    try {
      final uri = Uri.parse('${AppConstants.apiBaseUrl}/health');
      final request = await _httpClient.getUrl(uri);
      final response = await request.close();

      if (response.statusCode == 200) {
        final body = await response.transform(utf8.decoder).join();
        return jsonDecode(body) as Map<String, dynamic>;
      } else {
        return {'status': 'error', 'statusCode': response.statusCode};
      }
    } catch (e) {
      return {'status': 'offline', 'error': e.toString()};
    }
  }

  void dispose() {
    _httpClient.close();
  }
}


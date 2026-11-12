import 'package:flutter/material.dart';
import '../../models/notification_item.dart';
import '../../services/citizen_api_service.dart';
import '../../theme/app_colors.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _apiService = CitizenApiService();
  List<CitizenNotification> _notifications = [];
  bool _isLoading = true;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.getNotifications(limit: 30);
      if (mounted) {
        setState(() {
          _notifications = res['notifications'] as List<CitizenNotification>;
          _unreadCount = res['unreadCount'] as int;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _apiService.markAllNotificationsRead();
      _loadNotifications();
    } catch (_) {}
  }

  Future<void> _markRead(String id) async {
    try {
      await _apiService.markNotificationRead(id);
      _loadNotifications();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        title: const Text(
          'NOTIFICATIONS',
          style: TextStyle(
            fontFamily: 'Space Mono',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text(
                'Mark all read',
                style: TextStyle(color: AppColors.primaryAccent, fontSize: 12),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primaryAccent))
          : _notifications.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none, size: 48, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text(
                        'NO NOTIFICATIONS YET',
                        style: TextStyle(
                          fontFamily: 'Space Mono',
                          fontSize: 12,
                          color: AppColors.textMuted,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Updates about your submitted reports will appear here.',
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primaryAccent,
                  backgroundColor: AppColors.surfaceHigh,
                  onRefresh: _loadNotifications,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _notifications.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 8),
                    itemBuilder: (ctx, idx) {
                      final notif = _notifications[idx];
                      return InkWell(
                        onTap: () => _markRead(notif.id),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: notif.isRead ? AppColors.surfaceLow : AppColors.surfaceHigh,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: notif.isRead
                                  ? AppColors.surfaceHighest
                                  : AppColors.primaryAccent.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsets.only(top: 5, right: 10),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: notif.isRead ? Colors.transparent : AppColors.primaryAccent,
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          notif.title,
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: notif.isRead ? FontWeight.normal : FontWeight.bold,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        Text(
                                          _formatDate(notif.createdAt),
                                          style: const TextStyle(
                                            fontFamily: 'Space Mono',
                                            fontSize: 10,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      notif.message,
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  String _formatDate(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${dt.day}/${dt.month}';
    }
  }
}


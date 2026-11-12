import 'package:flutter/material.dart';
import '../../models/citizen_report.dart';
import '../../services/citizen_api_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/create_report_bottom_sheet.dart';
import 'report_detail_screen.dart';

class MyReportsScreen extends StatefulWidget {
  const MyReportsScreen({super.key});

  @override
  State<MyReportsScreen> createState() => _MyReportsScreenState();
}

class _MyReportsScreenState extends State<MyReportsScreen> {
  final _apiService = CitizenApiService();
  List<CitizenReport> _reports = [];
  bool _isLoading = true;
  String? _selectedStatus;
  String _searchQuery = '';

  final List<String> _statusFilters = [
    'ALL',
    'SUBMITTED',
    'MUNICIPAL_REVIEW',
    'INSPECTION_SCHEDULED',
    'AERIAL_VERIFIED',
    'RESOLVED',
  ];

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  Future<void> _loadReports() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.getMyReports(
        status: _selectedStatus == 'ALL' ? null : _selectedStatus,
        search: _searchQuery.isEmpty ? null : _searchQuery,
      );
      if (mounted) {
        setState(() {
          _reports = res['reports'] as List<CitizenReport>;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        title: const Text(
          'MY SUBMITTED REPORTS',
          style: TextStyle(
            fontFamily: 'Space Mono',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle, color: AppColors.primaryAccent),
            onPressed: () => CreateReportBottomSheet.show(context, onReportSubmitted: (_) => _loadReports()),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Bar
          Container(
            color: AppColors.surfaceLowest,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              children: [
                // Search Field
                TextField(
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: AppColors.surfaceHigh,
                    hintText: 'Search by report ID or keywords...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textMuted),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(9999), borderSide: BorderSide.none),
                  ),
                  onChanged: (val) {
                    _searchQuery = val;
                    _loadReports();
                  },
                ),
                const SizedBox(height: 10),

                // Horizontal Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _statusFilters.map((filter) {
                      final isSelected = (_selectedStatus == null && filter == 'ALL') || _selectedStatus == filter;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          selected: isSelected,
                          label: Text(filter.replaceAll('_', ' ')),
                          labelStyle: TextStyle(
                            fontFamily: 'Space Mono',
                            fontSize: 9,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected ? AppColors.onPrimaryAccent : AppColors.textPrimary,
                          ),
                          selectedColor: AppColors.primaryAccent,
                          backgroundColor: AppColors.surfaceHigh,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(9999),
                            side: BorderSide(
                              color: isSelected ? AppColors.primaryAccent : AppColors.surfaceHighest,
                            ),
                          ),
                          onSelected: (_) {
                            setState(() => _selectedStatus = filter == 'ALL' ? null : filter);
                            _loadReports();
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Report List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primaryAccent))
                : _reports.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.assignment_outlined, size: 48, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              const Text(
                                'NO REPORTS FOUND',
                                style: TextStyle(
                                  fontFamily: 'Space Mono',
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'You have not submitted any civic reports matching this filter.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('SUBMIT NEW REPORT', style: TextStyle(fontSize: 11)),
                                onPressed: () => CreateReportBottomSheet.show(context, onReportSubmitted: (_) => _loadReports()),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.primaryAccent,
                        backgroundColor: AppColors.surfaceHigh,
                        onRefresh: _loadReports,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                          itemCount: _reports.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 10),
                          itemBuilder: (ctx, idx) {
                            final report = _reports[idx];
                            return InkWell(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => ReportDetailScreen(report: report)),
                              ),
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceLow,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: AppColors.surfaceHighest),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          report.reportId,
                                          style: const TextStyle(
                                            fontFamily: 'Space Mono',
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.primaryAccent,
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceHigh,
                                            borderRadius: BorderRadius.circular(9999),
                                          ),
                                          child: Text(
                                            report.statusLabel,
                                            style: const TextStyle(
                                              fontFamily: 'Space Mono',
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      report.description,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            const Icon(Icons.timeline, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 4),
                                            Text(
                                              'Stage ${report.currentStage}/6',
                                              style: const TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.textMuted),
                                            ),
                                          ],
                                        ),
                                        Text(
                                          '${report.submittedAt.day}/${report.submittedAt.month}/${report.submittedAt.year}',
                                          style: const TextStyle(fontFamily: 'Space Mono', fontSize: 10, color: AppColors.textMuted),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}


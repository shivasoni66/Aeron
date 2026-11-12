import 'package:flutter/material.dart';
import '../../models/mission_outcome.dart';
import '../../services/citizen_api_service.dart';
import '../../theme/app_colors.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _apiService = CitizenApiService();
  List<PublicMissionOutcome> _outcomes = [];
  bool _isLoading = true;
  String? _selectedCategory;
  String _searchQuery = '';

  final List<Map<String, String>> _categories = [
    {'key': '', 'label': 'ALL FINDINGS'},
    {'key': 'CIVIC_INFRASTRUCTURE', 'label': 'CIVIL INFRA'},
    {'key': 'PUBLIC_SAFETY', 'label': 'ZONE SAFETY'},
    {'key': 'ENVIRONMENTAL_AUDIT', 'label': 'ECO AUDIT'},
  ];

  @override
  void initState() {
    super.initState();
    _loadOutcomes();
  }

  Future<void> _loadOutcomes() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.getPublicOutcomes(
        category: _selectedCategory,
        search: _searchQuery.isEmpty ? null : _searchQuery,
      );
      if (mounted) {
        setState(() {
          _outcomes = res['outcomes'] as List<PublicMissionOutcome>;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showOutcomeDetails(PublicMissionOutcome outcome) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppColors.surfaceContainer,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.surfaceHighest, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    outcome.outcomeId,
                    style: const TextStyle(
                      fontFamily: 'Space Mono',
                      fontSize: 13,
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
                      outcome.categoryLabel,
                      style: const TextStyle(fontFamily: 'Space Mono', fontSize: 9, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                outcome.summary,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 12),
              const Text(
                'MUNICIPAL FINDINGS & AUDIT NOTES:',
                style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 6),
              Text(
                outcome.findings,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('CLOSE DOSSIER', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLowest,
        title: const Text(
          'EXPLORE PUBLIC FINDINGS',
          style: TextStyle(
            fontFamily: 'Space Mono',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter & Search bar
          Container(
            color: AppColors.surfaceLowest,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              children: [
                TextField(
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: AppColors.surfaceHigh,
                    hintText: 'Search verified aerial findings...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textMuted),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(9999), borderSide: BorderSide.none),
                  ),
                  onChanged: (val) {
                    _searchQuery = val;
                    _loadOutcomes();
                  },
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _categories.map((cat) {
                      final isSelected = (_selectedCategory == null && cat['key'] == '') || _selectedCategory == cat['key'];
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          selected: isSelected,
                          label: Text(cat['label']!),
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
                            setState(() => _selectedCategory = cat['key']!.isEmpty ? null : cat['key']);
                            _loadOutcomes();
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Outcomes List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primaryAccent))
                : _outcomes.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.travel_explore, size: 48, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              const Text(
                                'NO PUBLIC FINDINGS DISCLOSED',
                                style: TextStyle(
                                  fontFamily: 'Space Mono',
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'Only officially reviewed and published outcomes are disclosed here.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.primaryAccent,
                        backgroundColor: AppColors.surfaceHigh,
                        onRefresh: _loadOutcomes,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                          itemCount: _outcomes.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 14),
                          itemBuilder: (ctx, idx) {
                            final item = _outcomes[idx];
                            return InkWell(
                              onTap: () => _showOutcomeDetails(item),
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceLow,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: AppColors.surfaceHighest),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Header banner
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                      color: AppColors.surfaceHigh,
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.verified, size: 14, color: AppColors.primaryAccent),
                                              const SizedBox(width: 6),
                                              Text(
                                                '#${item.outcomeId} // ${item.categoryLabel}',
                                                style: const TextStyle(
                                                  fontFamily: 'Space Mono',
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.primaryAccent,
                                                ),
                                              ),
                                            ],
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppColors.primaryAccent.withValues(alpha: 0.15),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Text(
                                              'CONFIRMED',
                                              style: TextStyle(
                                                fontFamily: 'Space Mono',
                                                fontSize: 8,
                                                fontWeight: FontWeight.bold,
                                                color: AppColors.primaryAccent,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.summary,
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            item.findings,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                          ),
                                          const SizedBox(height: 12),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Row(
                                                children: [
                                                  const Icon(Icons.flight, size: 12, color: AppColors.textMuted),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    item.missionTitle,
                                                    style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                                  ),
                                                ],
                                              ),
                                              const Row(
                                                children: [
                                                  Text(
                                                    'VIEW REPORT',
                                                    style: TextStyle(
                                                      fontFamily: 'Space Mono',
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.bold,
                                                      color: AppColors.primaryAccent,
                                                    ),
                                                  ),
                                                  Icon(Icons.chevron_right, size: 14, color: AppColors.primaryAccent),
                                                ],
                                              ),
                                            ],
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
          ),
        ],
      ),
    );
  }
}


import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../core/constants.dart';
import '../models/citizen_report.dart';
import '../services/citizen_api_service.dart';
import '../services/location_service.dart';
import '../theme/app_colors.dart';

class CreateReportBottomSheet extends StatefulWidget {
  final Function(CitizenReport report)? onReportSubmitted;

  const CreateReportBottomSheet({super.key, this.onReportSubmitted});

  static Future<void> show(BuildContext context, {Function(CitizenReport report)? onReportSubmitted}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CreateReportBottomSheet(onReportSubmitted: onReportSubmitted),
    );
  }

  @override
  State<CreateReportBottomSheet> createState() => _CreateReportBottomSheetState();
}

class _CreateReportBottomSheetState extends State<CreateReportBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _descController = TextEditingController();
  final _locationService = LocationService();
  final _apiService = CitizenApiService();

  String _selectedCategory = AppConstants.catRoadStructural;
  double _longitude = LocationService.defaultLongitude;
  double _latitude = LocationService.defaultLatitude;
  bool _isAcquiringGps = false;
  String _locationStatusText = 'Sector 04 Municipal Datum [ATTACHED]';

  XFile? _selectedImage;
  String? _uploadedMediaId;
  bool _isUploadingPhoto = false;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _acquireGpsLocation();
  }

  @override
  void dispose() {
    _descController.dispose();
    super.dispose();
  }

  Future<void> _acquireGpsLocation() async {
    setState(() => _isAcquiringGps = true);
    final result = await _locationService.acquireObservationLocation();
    if (mounted) {
      setState(() {
        _isAcquiringGps = false;
        _longitude = result.longitude;
        _latitude = result.latitude;
        _locationStatusText = '${result.formattedCoordinates} (${result.isAccurateGps ? "Device GPS" : "Ref Datum"})';
      });
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );

      if (picked != null) {
        setState(() {
          _selectedImage = picked;
          _isUploadingPhoto = true;
          _errorMessage = null;
        });

        // Stage photo upload to backend
        try {
          final bytes = await picked.readAsBytes();
          final base64String = base64Encode(bytes);
          final res = await _apiService.uploadEvidence(
            base64Image: base64String,
            contentType: 'image/jpeg',
            fileName: picked.name,
          );
          if (mounted) {
            setState(() {
              _uploadedMediaId = res['_id'] as String? ?? res['mediaId'] as String?;
              _isUploadingPhoto = false;
            });
          }
        } catch (e) {
          if (mounted) {
            setState(() {
              _isUploadingPhoto = false;
              // Even if upload staging fails (e.g. offline dev), keep the local preview
              _errorMessage = 'Photo attached locally. Server upload note: $e';
            });
          }
        }
      }
    } catch (_) {}
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_isSubmitting) return; // Prevent duplicate submission

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final report = await _apiService.submitReport(
        category: _selectedCategory,
        description: _descController.text,
        longitude: _longitude,
        latitude: _latitude,
        mediaAssets: _uploadedMediaId != null ? [_uploadedMediaId!] : null,
      );

      if (mounted) {
        setState(() => _isSubmitting = false);
        Navigator.of(context).pop();

        if (widget.onReportSubmitted != null) {
          widget.onReportSubmitted!(report);
        }

        _showSuccessDialog(report);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  void _showSuccessDialog(CitizenReport report) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: AppColors.primaryAccent, size: 24),
            const SizedBox(width: 8),
            const Text(
              'REPORT DISPATCHED',
              style: TextStyle(
                fontFamily: 'Space Mono',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'REPORT ID:',
                    style: TextStyle(fontFamily: 'Space Mono', fontSize: 11, color: AppColors.textMuted),
                  ),
                  Text(
                    report.reportId,
                    style: const TextStyle(
                      fontFamily: 'Space Mono',
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primaryAccent,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your civic issue report has been logged in the municipal inspection triage queue. Stage 1 of 6 is underway.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            const Row(
              children: [
                Icon(Icons.military_tech, size: 14, color: AppColors.primaryAccent),
                SizedBox(width: 4),
                Text(
                  '+25 Verified Civic Pts allocated upon public works closeout',
                  style: TextStyle(
                    fontFamily: 'Space Mono',
                    fontSize: 10,
                    color: AppColors.primaryAccent,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('DISMISS', style: TextStyle(color: AppColors.primaryAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      decoration: const BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceHighest,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Title row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.report_problem_outlined, color: AppColors.primaryAccent, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'SUBMIT CIVIC REPORT',
                          style: TextStyle(
                            fontFamily: 'Space Mono',
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textMuted, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const Text(
                  'Report municipal hazards or infrastructure anomalies. Verified submissions schedule aerial inspection.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),

                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.errorContainer.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.error.withValues(alpha: 0.5)),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(fontSize: 11, color: AppColors.error),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Category Selection
                const Text(
                  'MISSION CATEGORY',
                  style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildCategoryChip(AppConstants.catRoadStructural, 'Road & Structural', Icons.handyman),
                    _buildCategoryChip(AppConstants.catCrowdSafety, 'Crowd Safety', Icons.groups),
                    _buildCategoryChip(AppConstants.catMicroClimateEco, 'Micro-Climate', Icons.thermostat),
                    _buildCategoryChip(AppConstants.catSearchRescue, 'Search & Rescue', Icons.crisis_alert),
                  ],
                ),
                const SizedBox(height: 16),

                // Description
                const Text(
                  'HAZARD DESCRIPTION',
                  style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _descController,
                  maxLines: 3,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: AppColors.surfaceHigh,
                    hintText: 'e.g. Deep pothole fissure on 80ft Outer Ring Road near crosswalk...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.primaryAccent, width: 1.5),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().length < 5) return 'Description must be at least 5 characters';
                    if (v.trim().length > 1000) return 'Description cannot exceed 1000 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Location Geotag Card
                const Text(
                  'OBSERVATION GEOTAG',
                  style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceHigh,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surfaceHighest),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.my_location,
                        color: _isAcquiringGps ? AppColors.textMuted : AppColors.primaryAccent,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _locationStatusText,
                              style: const TextStyle(fontFamily: 'Space Mono', fontSize: 11, color: AppColors.textPrimary),
                            ),
                            const Text(
                              'Submitted device location (observation coordinate)',
                              style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: _isAcquiringGps
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryAccent))
                            : const Icon(Icons.refresh, size: 18, color: AppColors.primaryAccent),
                        onPressed: _isAcquiringGps ? null : _acquireGpsLocation,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Photographic Evidence Card
                const Text(
                  'PHOTOGRAPHIC EVIDENCE (OPTIONAL)',
                  style: TextStyle(fontFamily: 'Space Mono', fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceHigh,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surfaceHighest),
                  ),
                  child: _selectedImage == null
                      ? Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.camera_alt_outlined, size: 16),
                                label: const Text('Camera', style: TextStyle(fontSize: 12)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.primaryAccent,
                                  side: BorderSide(color: AppColors.primaryAccent.withValues(alpha: 0.5)),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () => _pickImage(ImageSource.camera),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.photo_library_outlined, size: 16),
                                label: const Text('Gallery', style: TextStyle(fontSize: 12)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.primaryAccent,
                                  side: BorderSide(color: AppColors.primaryAccent.withValues(alpha: 0.5)),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () => _pickImage(ImageSource.gallery),
                              ),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            const Icon(Icons.image, color: AppColors.primaryAccent, size: 24),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _selectedImage!.name,
                                    style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    _isUploadingPhoto ? 'Uploading staging payload...' : 'Evidence attached (+25 Verified XP)',
                                    style: const TextStyle(fontSize: 10, color: AppColors.primaryAccent),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                              onPressed: () => setState(() {
                                _selectedImage = null;
                                _uploadedMediaId = null;
                              }),
                            ),
                          ],
                        ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryAccent,
                    foregroundColor: AppColors.onPrimaryAccent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9999)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimaryAccent),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.send, size: 18),
                            SizedBox(width: 8),
                            Text(
                              'SUBMIT CIVIC REPORT',
                              style: TextStyle(
                                fontFamily: 'Space Mono',
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChip(String categoryKey, String label, IconData icon) {
    final isSelected = _selectedCategory == categoryKey;

    return ChoiceChip(
      selected: isSelected,
      onSelected: (_) => setState(() => _selectedCategory = categoryKey),
      avatar: Icon(icon, size: 16, color: isSelected ? AppColors.onPrimaryAccent : AppColors.primaryAccent),
      label: Text(label),
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        color: isSelected ? AppColors.onPrimaryAccent : AppColors.textPrimary,
      ),
      selectedColor: AppColors.primaryAccent,
      backgroundColor: AppColors.surfaceHigh,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(9999),
        side: BorderSide(color: isSelected ? AppColors.primaryAccent : AppColors.surfaceHighest),
      ),
    );
  }
}


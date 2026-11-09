import { z } from 'zod';

export const CreateMissionSchema = z.object({
  missionType: z.enum([
    'CIVIC_ISSUE_VERIFICATION',
    'CROWD_SAFETY',
    'MICRO_CLIMATE',
    'SUBTERRANEAN_SEARCH_RESCUE'
  ], {
    errorMap: () => ({ message: 'Invalid mission category. Must be one of the 4 approved types.' })
  }),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters'),
  assignedDrones: z.array(z.string()).optional(),
  assignedManager: z.string().optional(),
  plannedStart: z.string().datetime().optional().or(z.date().optional()),
  operationalArea: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.any()
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const UpdateMissionSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ABORTED']).optional(),
  stage: z.number().int().min(1).max(8).optional(),
  stageLabel: z.string().trim().optional(),
  assignedDrones: z.array(z.string()).optional(),
  assignedManager: z.string().optional(),
  operationalArea: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.any()
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateMissionEventSchema = z.object({
  eventType: z.string().trim().min(2, 'Event type is required').max(50),
  description: z.string().trim().min(3, 'Event description is required'),
  source: z.string().trim().optional().default('MANAGER_WEB'),
  metadata: z.record(z.unknown()).optional()
});

export const UpdateIncidentSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  description: z.string().trim().min(3).optional(),
  assignedManager: z.string().optional(),
  resolutionNotes: z.string().trim().optional()
});

export const ReviewOutcomeSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: "Review decision must be either 'APPROVED' or 'REJECTED'" })
  }),
  findings: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export const PublishOutcomeSchema = z.object({
  notes: z.string().trim().optional()
});


import mongoose, { Model, Schema } from 'mongoose';
import { MissionType } from './Mission.js';

export type LocationAccuracyStatus = 'EXACT' | 'ESTIMATED' | 'APPROXIMATE' | 'UNAVAILABLE';
export type ObservationVerificationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface IObservation {
  observationId: string;
  missionId: string;
  sessionId?: string;
  missionType: MissionType;
  droneId: string;
  category: string;
  confidence: number;
  detectedAt: Date;
  evidenceImageUrl: string;
  cropImageUrl?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dronePosition: {
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
  };
  estimatedTargetPosition?: {
    latitude: number;
    longitude: number;
  } | null;
  locationAccuracyStatus: LocationAccuracyStatus;
  gpsQuality?: {
    fixType?: string;
    satellites?: number;
    hdop?: number;
  };
  telemetryTimeDiffMs?: number;
  metrics?: Record<string, unknown>;
  modelInfo: {
    name: string;
    version: string;
    framework?: string;
  };
  verificationStatus: ObservationVerificationStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const ObservationSchema = new Schema<IObservation>(
  {
    observationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    missionId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    sessionId: {
      type: String,
      trim: true
    },
    missionType: {
      type: String,
      required: true,
      enum: [
        'CIVIC_ISSUE_VERIFICATION',
        'CROWD_SAFETY',
        'MICRO_CLIMATE',
        'SUBTERRANEAN_SEARCH_RESCUE'
      ],
      index: true
    },
    droneId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    detectedAt: {
      type: Date,
      required: true,
      index: true
    },
    evidenceImageUrl: {
      type: String,
      required: true
    },
    cropImageUrl: {
      type: String
    },
    boundingBox: {
      x: { type: Number },
      y: { type: Number },
      width: { type: Number },
      height: { type: Number }
    },
    dronePosition: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      altitude: { type: Number },
      heading: { type: Number }
    },
    estimatedTargetPosition: {
      latitude: { type: Number },
      longitude: { type: Number }
    },
    locationAccuracyStatus: {
      type: String,
      enum: ['EXACT', 'ESTIMATED', 'APPROXIMATE', 'UNAVAILABLE'],
      required: true,
      default: 'APPROXIMATE'
    },
    gpsQuality: {
      fixType: { type: String },
      satellites: { type: Number },
      hdop: { type: Number }
    },
    telemetryTimeDiffMs: {
      type: Number,
      default: 0
    },
    metrics: {
      type: Schema.Types.Mixed,
      default: {}
    },
    modelInfo: {
      name: { type: String, required: true },
      version: { type: String, required: true },
      framework: { type: String, default: 'Ultralytics YOLO' }
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      required: true,
      default: 'PENDING',
      index: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    reviewNotes: {
      type: String,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'observations',
    timestamps: true
  }
);

ObservationSchema.index({ missionType: 1, detectedAt: -1 });
ObservationSchema.index({ missionId: 1, detectedAt: -1 });
ObservationSchema.index({ verificationStatus: 1, missionType: 1 });

export const Observation: Model<IObservation> =
  mongoose.models.Observation || mongoose.model<IObservation>('Observation', ObservationSchema);

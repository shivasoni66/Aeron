import mongoose, { Model, Schema } from 'mongoose';
import { IGeoJSONPolygon, IGeoJSONMultiPolygon } from './types.js';

export type MissionType =
  | 'CIVIC_ISSUE_VERIFICATION'
  | 'CROWD_SAFETY'
  | 'MICRO_CLIMATE'
  | 'SUBTERRANEAN_SEARCH_RESCUE';

export type MissionStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ABORTED';

export interface IMission {
  missionId: string;
  missionType: MissionType;
  title: string;
  description: string;
  status: MissionStatus;
  stage: number;
  stageLabel: string;
  createdBy: mongoose.Types.ObjectId;
  assignedManager?: mongoose.Types.ObjectId;
  assignedDrones: mongoose.Types.ObjectId[];
  plannedStart?: Date;
  actualStart?: Date;
  completedAt?: Date;
  operationalArea?: IGeoJSONPolygon | IGeoJSONMultiPolygon;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const GeoPolygonSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  { _id: false }
);

const MissionSchema = new Schema<IMission>(
  {
    missionId: {
      type: String,
      required: [true, 'Mission ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    missionType: {
      type: String,
      required: [true, 'Mission type is required'],
      enum: {
        values: [
          'CIVIC_ISSUE_VERIFICATION',
          'CROWD_SAFETY',
          'MICRO_CLIMATE',
          'SUBTERRANEAN_SEARCH_RESCUE'
        ],
        message: '{VALUE} is not one of the 4 approved AERON mission types'
      }
    },
    title: {
      type: String,
      required: [true, 'Mission title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Mission description is required'],
      trim: true
    },
    status: {
      type: String,
      required: [true, 'Mission status is required'],
      enum: {
        values: ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ABORTED'],
        message: '{VALUE} is not a valid mission status'
      },
      default: 'PLANNED'
    },
    stage: {
      type: Number,
      min: [1, 'Stage must be between 1 and 8'],
      max: [8, 'Stage must be between 1 and 8'],
      default: 1
    },
    stageLabel: {
      type: String,
      default: 'STAGE 1/8: MISSION PLANNING',
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator User reference is required'],
      index: true
    },
    assignedManager: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    assignedDrones: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Drone'
      }
    ],
    plannedStart: {
      type: Date
    },
    actualStart: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    operationalArea: {
      type: GeoPolygonSchema
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'missions',
    timestamps: true
  }
);

// Indexes
MissionSchema.index({ missionType: 1, status: 1 });
MissionSchema.index({ assignedManager: 1, status: 1 });
MissionSchema.index({ operationalArea: '2dsphere' });

export const Mission: Model<IMission> =
  mongoose.models.Mission || mongoose.model<IMission>('Mission', MissionSchema);

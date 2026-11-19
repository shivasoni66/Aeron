import mongoose, { Model, Schema } from 'mongoose';
import { MissionType } from './Mission.js';

export type OperatingMode = 'STANDARD' | 'MEGA_MISSION';
export type SessionStatus = 'IDLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type PipelineHealth = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'STOPPED' | 'UNAVAILABLE';

export interface IPipelineState {
  missionId?: string;
  status: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'STOPPED';
  pipelineHealth: PipelineHealth;
  lastInferenceAt?: Date;
  details?: string;
  modelName?: string;
}

export interface IEnvironmentalServiceState {
  status: 'ONLINE' | 'OFFLINE' | 'STALE' | 'NOT_CONNECTED';
  lastReadingAt?: Date;
  sensorCount?: number;
  details?: string;
}

export interface IMissionSession {
  sessionId: string;
  operatingMode: OperatingMode;
  status: SessionStatus;
  activeMissionId?: string | null;
  activeMissionType?: MissionType | null;
  sessionStartedAt?: Date | null;
  sessionEndedAt?: Date | null;
  childSessions: {
    civic: IPipelineState;
    crowd: IPipelineState;
    sar: IPipelineState;
  };
  environmentalService: IEnvironmentalServiceState;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const PipelineStateSchema = new Schema(
  {
    missionId: { type: String, trim: true },
    status: {
      type: String,
      enum: ['IDLE', 'ACTIVE', 'PAUSED', 'STOPPED'],
      default: 'IDLE'
    },
    pipelineHealth: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'FAILED', 'STOPPED', 'UNAVAILABLE'],
      default: 'STOPPED'
    },
    lastInferenceAt: { type: Date },
    details: { type: String },
    modelName: { type: String }
  },
  { _id: false }
);

const EnvironmentalServiceSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'STALE', 'NOT_CONNECTED'],
      default: 'NOT_CONNECTED'
    },
    lastReadingAt: { type: Date },
    sensorCount: { type: Number, default: 0 },
    details: { type: String, default: 'Environmental sensor monitoring initialized in standby' }
  },
  { _id: false }
);

const MissionSessionSchema = new Schema<IMissionSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    operatingMode: {
      type: String,
      enum: ['STANDARD', 'MEGA_MISSION'],
      required: true,
      default: 'STANDARD'
    },
    status: {
      type: String,
      enum: ['IDLE', 'ACTIVE', 'PAUSED', 'COMPLETED'],
      required: true,
      default: 'IDLE'
    },
    activeMissionId: {
      type: String,
      trim: true,
      default: null
    },
    activeMissionType: {
      type: String,
      enum: [
        'CIVIC_ISSUE_VERIFICATION',
        'CROWD_SAFETY',
        'MICRO_CLIMATE',
        'SUBTERRANEAN_SEARCH_RESCUE',
        null
      ],
      default: null
    },
    sessionStartedAt: {
      type: Date,
      default: null
    },
    sessionEndedAt: {
      type: Date,
      default: null
    },
    childSessions: {
      civic: {
        type: PipelineStateSchema,
        default: () => ({ status: 'IDLE', pipelineHealth: 'STOPPED', details: 'Awaiting activation' })
      },
      crowd: {
        type: PipelineStateSchema,
        default: () => ({ status: 'IDLE', pipelineHealth: 'STOPPED', details: 'Awaiting activation' })
      },
      sar: {
        type: PipelineStateSchema,
        default: () => ({ status: 'IDLE', pipelineHealth: 'STOPPED', details: 'Awaiting activation' })
      }
    },
    environmentalService: {
      type: EnvironmentalServiceSchema,
      default: () => ({ status: 'NOT_CONNECTED', details: 'Sensor reading in standby' })
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'mission_sessions',
    timestamps: true
  }
);

MissionSessionSchema.index({ status: 1, operatingMode: 1 });
MissionSessionSchema.index({ activeMissionId: 1 });

export const MissionSession: Model<IMissionSession> =
  mongoose.models.MissionSession || mongoose.model<IMissionSession>('MissionSession', MissionSessionSchema);

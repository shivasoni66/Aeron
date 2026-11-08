import mongoose, { Model, Schema } from 'mongoose';
import { IGeoJSONPoint } from './types.js';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';

export interface IIncident {
  incidentId: string;
  missionId?: mongoose.Types.ObjectId;
  incidentType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  location?: IGeoJSONPoint;
  isConfidential: boolean; // For SAR survivor data protection
  assignedManager?: mongoose.Types.ObjectId;
  reportedAt: Date;
  resolvedAt?: Date;
  evidenceAssets?: mongoose.Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

const GeoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coords: number[]) =>
          Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0] >= -180 &&
          coords[0] <= 180 &&
          coords[1] >= -90 &&
          coords[1] <= 90,
        message: 'Coordinates must be [longitude (-180..180), latitude (-90..90)]'
      }
    }
  },
  { _id: false }
);

const IncidentSchema = new Schema<IIncident>(
  {
    incidentId: {
      type: String,
      required: [true, 'Incident ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      index: true
    },
    incidentType: {
      type: String,
      required: [true, 'Incident type is required'],
      trim: true,
      uppercase: true
    },
    severity: {
      type: String,
      required: [true, 'Severity level is required'],
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid severity level'
      },
      default: 'MEDIUM'
    },
    status: {
      type: String,
      required: [true, 'Incident status is required'],
      enum: {
        values: ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'],
        message: '{VALUE} is not a valid incident status'
      },
      default: 'OPEN'
    },
    description: {
      type: String,
      required: [true, 'Incident description is required'],
      trim: true
    },
    location: {
      type: GeoPointSchema
    },
    isConfidential: {
      type: Boolean,
      default: false
    },
    assignedManager: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    reportedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    resolvedAt: {
      type: Date
    },
    evidenceAssets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset'
      }
    ]
  },
  {
    collection: 'incidents',
    timestamps: true
  }
);

// Indexes
IncidentSchema.index({ severity: 1, status: 1 });
IncidentSchema.index({ missionId: 1, reportedAt: -1 });
IncidentSchema.index({ location: '2dsphere' });

export const Incident: Model<IIncident> =
  mongoose.models.Incident || mongoose.model<IIncident>('Incident', IncidentSchema);

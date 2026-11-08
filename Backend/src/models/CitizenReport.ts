import mongoose, { Model, Schema } from 'mongoose';
import { IGeoJSONPoint } from './types.js';

export type CitizenReportCategory =
  | 'ROAD_STRUCTURAL'
  | 'CROWD_SAFETY'
  | 'MICRO_CLIMATE_ECO'
  | 'SEARCH_RESCUE';

export type CitizenReportStatus =
  | 'SUBMITTED'
  | 'MUNICIPAL_REVIEW'
  | 'INSPECTION_SCHEDULED'
  | 'AERIAL_VERIFIED'
  | 'PUBLIC_WORKS_ASSIGNED'
  | 'RESOLVED'
  | 'REJECTED';

export interface ICitizenReport {
  reportId: string;
  citizenId: mongoose.Types.ObjectId;
  category: CitizenReportCategory;
  description: string;
  location: IGeoJSONPoint;
  mediaAssets?: mongoose.Types.ObjectId[];
  status: CitizenReportStatus;
  currentStage: number;
  earnedPoints: number;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  duplicateOf?: mongoose.Types.ObjectId;
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
        message: 'Report location coordinates must be [longitude (-180..180), latitude (-90..90)]'
      }
    }
  },
  { _id: false }
);

const CitizenReportSchema = new Schema<ICitizenReport>(
  {
    reportId: {
      type: String,
      required: [true, 'Report ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporting Citizen ID is required'],
      index: true
    },
    category: {
      type: String,
      required: [true, 'Report category is required'],
      enum: {
        values: [
          'ROAD_STRUCTURAL',
          'CROWD_SAFETY',
          'MICRO_CLIMATE_ECO',
          'SEARCH_RESCUE'
        ],
        message: '{VALUE} is not a valid report category'
      }
    },
    description: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    location: {
      type: GeoPointSchema,
      required: [true, 'Valid geographic Point location is required for civic intake']
    },
    mediaAssets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset'
      }
    ],
    status: {
      type: String,
      required: [true, 'Report status is required'],
      enum: {
        values: [
          'SUBMITTED',
          'MUNICIPAL_REVIEW',
          'INSPECTION_SCHEDULED',
          'AERIAL_VERIFIED',
          'PUBLIC_WORKS_ASSIGNED',
          'RESOLVED',
          'REJECTED'
        ],
        message: '{VALUE} is not a valid citizen report status'
      },
      default: 'SUBMITTED'
    },
    currentStage: {
      type: Number,
      min: [1, 'Stage must be between 1 and 6'],
      max: [6, 'Stage must be between 1 and 6'],
      default: 1
    },
    earnedPoints: {
      type: Number,
      default: 25,
      min: [0, 'Points cannot be negative']
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    reviewedAt: {
      type: Date
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    duplicateOf: {
      type: Schema.Types.ObjectId,
      ref: 'CitizenReport'
    }
  },
  {
    collection: 'citizenreports',
    timestamps: true
  }
);

// Indexes
CitizenReportSchema.index({ citizenId: 1, submittedAt: -1 });
CitizenReportSchema.index({ status: 1, category: 1 });
CitizenReportSchema.index({ location: '2dsphere' });

export const CitizenReport: Model<ICitizenReport> =
  mongoose.models.CitizenReport ||
  mongoose.model<ICitizenReport>('CitizenReport', CitizenReportSchema);

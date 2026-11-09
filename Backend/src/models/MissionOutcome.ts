import mongoose, { Model, Schema } from 'mongoose';

export type OutcomeType =
  | 'CIVIC_INFRASTRUCTURE'
  | 'PUBLIC_SAFETY'
  | 'ENVIRONMENTAL_AUDIT'
  | 'RESCUE_OPERATION';

export type OutcomeReviewStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED';

export interface IMissionOutcome {
  outcomeId: string;
  missionId: mongoose.Types.ObjectId;
  outcomeType: OutcomeType;
  summary: string;
  findings: string;
  evidenceAssets?: mongoose.Types.ObjectId[];
  reviewStatus: OutcomeReviewStatus;
  isPublic: boolean;
  isConfidential?: boolean;
  confidentialReason?: string;
  publicSummary?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const MissionOutcomeSchema = new Schema<IMissionOutcome>(
  {
    outcomeId: {
      type: String,
      required: [true, 'Outcome ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: [true, 'Associated Mission ID is required'],
      index: true
    },
    outcomeType: {
      type: String,
      required: [true, 'Outcome type is required'],
      enum: {
        values: [
          'CIVIC_INFRASTRUCTURE',
          'PUBLIC_SAFETY',
          'ENVIRONMENTAL_AUDIT',
          'RESCUE_OPERATION'
        ],
        message: '{VALUE} is not a valid outcome type'
      }
    },
    summary: {
      type: String,
      required: [true, 'Outcome summary is required'],
      trim: true,
      minlength: [5, 'Summary must be at least 5 characters'],
      maxlength: [200, 'Summary cannot exceed 200 characters']
    },
    findings: {
      type: String,
      required: [true, 'Detailed findings are required'],
      trim: true
    },
    evidenceAssets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset'
      }
    ],
    reviewStatus: {
      type: String,
      required: [true, 'Review status is required'],
      enum: {
        values: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED'],
        message: '{VALUE} is not a valid review status'
      },
      default: 'DRAFT'
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    isConfidential: {
      type: Boolean,
      default: false
    },
    confidentialReason: {
      type: String,
      trim: true
    },
    publicSummary: {
      type: String,
      trim: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    publishedAt: {
      type: Date
    }
  },
  {
    collection: 'missionoutcomes',
    timestamps: true
  }
);

// Indexes
MissionOutcomeSchema.index({ reviewStatus: 1, isPublic: 1 });
MissionOutcomeSchema.index({ publishedAt: -1 });

export const MissionOutcome: Model<IMissionOutcome> =
  mongoose.models.MissionOutcome ||
  mongoose.model<IMissionOutcome>('MissionOutcome', MissionOutcomeSchema);

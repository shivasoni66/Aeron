import mongoose, { Model, Schema } from 'mongoose';

export type StorageProvider = 'LOCAL' | 'S3' | 'CLOUDINARY' | 'GCS';
export type MediaType = 'IMAGE' | 'VIDEO' | 'THERMAL' | 'POINT_CLOUD' | 'DOCUMENT';
export type MediaRelatedEntity = 'CITIZEN_REPORT' | 'MISSION' | 'INCIDENT' | 'MISSION_OUTCOME';
export type MediaSource = 'CITIZEN_UPLOAD' | 'DRONE_PAYLOAD' | 'OPERATOR_CAPTURE';

export interface IMediaAsset {
  mediaId: string;
  storageProvider: StorageProvider;
  storageKey: string;
  mediaType: MediaType;
  contentType: string;
  fileSize: number;
  checksum?: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  relatedEntityType: MediaRelatedEntity;
  relatedEntityId?: mongoose.Types.ObjectId;
  source: MediaSource;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
  {
    mediaId: {
      type: String,
      required: [true, 'Media ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    storageProvider: {
      type: String,
      required: [true, 'Storage provider is required'],
      enum: {
        values: ['LOCAL', 'S3', 'CLOUDINARY', 'GCS'],
        message: '{VALUE} is not an authorized storage provider'
      },
      default: 'LOCAL'
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key / path is required'],
      trim: true
    },
    mediaType: {
      type: String,
      required: [true, 'Media type is required'],
      enum: {
        values: ['IMAGE', 'VIDEO', 'THERMAL', 'POINT_CLOUD', 'DOCUMENT'],
        message: '{VALUE} is not a valid media type'
      }
    },
    contentType: {
      type: String,
      required: [true, 'MIME Content-Type is required'],
      trim: true
    },
    fileSize: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      min: [1, 'File size must be greater than zero']
    },
    checksum: {
      type: String,
      trim: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader User reference is required'],
      index: true
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    relatedEntityType: {
      type: String,
      required: [true, 'Related entity type is required'],
      enum: {
        values: ['CITIZEN_REPORT', 'MISSION', 'INCIDENT', 'MISSION_OUTCOME'],
        message: '{VALUE} is not a valid entity reference type'
      }
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      required: false,
      index: true
    },
    source: {
      type: String,
      required: [true, 'Media source is required'],
      enum: {
        values: ['CITIZEN_UPLOAD', 'DRONE_PAYLOAD', 'OPERATOR_CAPTURE'],
        message: '{VALUE} is not a valid media source'
      }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'mediaassets',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
MediaAssetSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
MediaAssetSchema.index({ uploadedBy: 1, uploadedAt: -1 });

export const MediaAsset: Model<IMediaAsset> =
  mongoose.models.MediaAsset ||
  mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);

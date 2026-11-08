import mongoose, { Model, Schema } from 'mongoose';

export type RefreshTokenStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED';

export interface IRefreshToken {
  tokenId: string;
  tokenHash: string;
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  familyId: string;
  status: RefreshTokenStatus;
  createdAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
  replacedByTokenId?: string;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenId: {
      type: String,
      required: [true, 'Token ID is required'],
      unique: true,
      trim: true
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      trim: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      index: true
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID reference is required']
    },
    familyId: {
      type: String,
      required: [true, 'Token family ID is required'],
      index: true
    },
    status: {
      type: String,
      required: [true, 'Token status is required'],
      enum: {
        values: ['ACTIVE', 'ROTATED', 'REVOKED'],
        message: '{VALUE} is not a valid token status'
      },
      default: 'ACTIVE'
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: [true, 'Token expiration timestamp is required']
    },
    rotatedAt: {
      type: Date
    },
    replacedByTokenId: {
      type: String,
      trim: true
    }
  },
  {
    collection: 'refreshtokens',
    timestamps: false
  }
);

// Indexes
RefreshTokenSchema.index({ familyId: 1, status: 1 });
RefreshTokenSchema.index({ sessionId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL cleanup

export const RefreshToken: Model<IRefreshToken> =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

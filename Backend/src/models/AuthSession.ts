import mongoose, { Model, Schema } from 'mongoose';

export type ClientPlatform = 'WEB' | 'FLUTTER' | 'CLI';

export interface IAuthSession {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  clientType: ClientPlatform;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revocationReason?: string;
}

const AuthSessionSchema = new Schema<IAuthSession>(
  {
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      unique: true,
      trim: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      index: true
    },
    clientType: {
      type: String,
      required: [true, 'Client platform is required'],
      enum: {
        values: ['WEB', 'FLUTTER', 'CLI'],
        message: '{VALUE} is not a valid client platform'
      },
      default: 'WEB'
    },
    userAgent: {
      type: String,
      trim: true
    },
    ipAddress: {
      type: String,
      trim: true
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastUsedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: [true, 'Session expiration timestamp is required']
    },
    revokedAt: {
      type: Date
    },
    revocationReason: {
      type: String,
      trim: true
    }
  },
  {
    collection: 'authsessions',
    timestamps: false
  }
);

// Indexes
AuthSessionSchema.index({ userId: 1, revokedAt: 1 });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL cleanup

export const AuthSession: Model<IAuthSession> =
  mongoose.models.AuthSession ||
  mongoose.model<IAuthSession>('AuthSession', AuthSessionSchema);

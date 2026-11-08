import mongoose, { Model, Schema } from 'mongoose';

export type AuditSource =
  | 'ADMIN_WEB'
  | 'MANAGER_WEB'
  | 'CITIZEN_APP'
  | 'DRONE_BRIDGE'
  | 'SYSTEM';

export interface IAuditLog {
  actorId?: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId: string;
  timestamp?: Date;
  source: AuditSource;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      uppercase: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    source: {
      type: String,
      required: [true, 'Audit source is required'],
      enum: {
        values: ['ADMIN_WEB', 'MANAGER_WEB', 'CITIZEN_APP', 'DRONE_BRIDGE', 'SYSTEM'],
        message: '{VALUE} is not an authorized audit source'
      }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'auditlogs',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

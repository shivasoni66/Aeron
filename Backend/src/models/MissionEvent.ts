import mongoose, { Model, Schema } from 'mongoose';

export interface IMissionEvent {
  missionId: mongoose.Types.ObjectId;
  eventType: string;
  actorId?: mongoose.Types.ObjectId;
  eventTimestamp: Date;
  description: string;
  metadata?: Record<string, unknown>;
  source: string;
  createdAt?: Date;
}

const MissionEventSchema = new Schema<IMissionEvent>(
  {
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      required: [true, 'Associated Mission ID is required'],
      index: true
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      uppercase: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    eventTimestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    source: {
      type: String,
      default: 'SYSTEM',
      trim: true
    }
  },
  {
    collection: 'missionevents',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
MissionEventSchema.index({ missionId: 1, eventTimestamp: -1 });
MissionEventSchema.index({ eventType: 1, eventTimestamp: -1 });

export const MissionEvent: Model<IMissionEvent> =
  mongoose.models.MissionEvent ||
  mongoose.model<IMissionEvent>('MissionEvent', MissionEventSchema);

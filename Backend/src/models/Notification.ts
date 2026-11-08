import mongoose, { Model, Schema } from 'mongoose';

export type NotificationCategory =
  | 'SYSTEM'
  | 'MISSION'
  | 'INCIDENT'
  | 'CIVIC_UPDATE'
  | 'ACHIEVEMENT';

export interface INotification {
  recipientId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  category: NotificationCategory;
  readAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: mongoose.Types.ObjectId;
  createdAt?: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient User ID is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Notification category is required'],
      enum: {
        values: ['SYSTEM', 'MISSION', 'INCIDENT', 'CIVIC_UPDATE', 'ACHIEVEMENT'],
        message: '{VALUE} is not a valid notification category'
      },
      default: 'SYSTEM'
    },
    readAt: {
      type: Date
    },
    relatedEntityType: {
      type: String,
      trim: true
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId
    }
  },
  {
    collection: 'notifications',
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, readAt: 1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);

import mongoose, { Model, Schema } from 'mongoose';

export type DroneOperationalStatus = 'READY' | 'IN_FLIGHT' | 'MAINTENANCE' | 'OFFLINE';

export interface IDrone {
  droneId: string;
  displayName: string;
  model: string;
  manufacturer: string;
  flightController: string;
  hardwareIdentifiers?: Map<string, string> | Record<string, string>;
  operationalStatus: DroneOperationalStatus;
  lastTelemetryAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const DroneSchema = new Schema<IDrone>(
  {
    droneId: {
      type: String,
      required: [true, 'Drone ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true
    },
    model: {
      type: String,
      required: [true, 'Airframe model is required'],
      trim: true
    },
    manufacturer: {
      type: String,
      default: 'AERON Aerospace',
      trim: true
    },
    flightController: {
      type: String,
      required: [true, 'Flight controller specification is required'],
      trim: true
    },
    hardwareIdentifiers: {
      type: Map,
      of: String,
      default: {}
    },
    operationalStatus: {
      type: String,
      enum: {
        values: ['READY', 'IN_FLIGHT', 'MAINTENANCE', 'OFFLINE'],
        message: '{VALUE} is not a valid operational status'
      },
      default: 'READY'
    },
    lastTelemetryAt: {
      type: Date
    }
  },
  {
    collection: 'drones',
    timestamps: true
  }
);

// Indexes
DroneSchema.index({ operationalStatus: 1 });
DroneSchema.index({ lastTelemetryAt: -1 });

export const Drone: Model<IDrone> =
  mongoose.models.Drone || mongoose.model<IDrone>('Drone', DroneSchema);

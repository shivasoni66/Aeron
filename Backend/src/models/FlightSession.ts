import mongoose, { Model, Schema } from 'mongoose';
import { IGeoJSONPoint } from './types.js';

export type FlightSessionStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
export type FlightSessionSource = 'REAL' | 'SIMULATION';

export interface IFlightSession {
  flightSessionId: string;
  droneId: mongoose.Types.ObjectId;
  missionId?: mongoose.Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  status: FlightSessionStatus;
  source: FlightSessionSource;
  startLocation?: IGeoJSONPoint;
  endLocation?: IGeoJSONPoint;
  durationSeconds: number;
  summary?: string;
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

const FlightSessionSchema = new Schema<IFlightSession>(
  {
    flightSessionId: {
      type: String,
      required: [true, 'Flight session ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    droneId: {
      type: Schema.Types.ObjectId,
      ref: 'Drone',
      required: [true, 'Associated Drone reference is required'],
      index: true
    },
    missionId: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      index: true
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    endedAt: {
      type: Date
    },
    status: {
      type: String,
      required: [true, 'Flight session status is required'],
      enum: {
        values: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ABORTED'],
        message: '{VALUE} is not a valid flight session status'
      },
      default: 'PLANNED'
    },
    source: {
      type: String,
      required: [true, 'Session source is required (REAL or SIMULATION)'],
      enum: {
        values: ['REAL', 'SIMULATION'],
        message: '{VALUE} is not a valid session source'
      },
      default: 'SIMULATION'
    },
    startLocation: {
      type: GeoPointSchema
    },
    endLocation: {
      type: GeoPointSchema
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: [0, 'Duration cannot be negative']
    },
    summary: {
      type: String,
      trim: true
    }
  },
  {
    collection: 'flightsessions',
    timestamps: true
  }
);

// Indexes
FlightSessionSchema.index({ droneId: 1, startedAt: -1 });
FlightSessionSchema.index({ missionId: 1, startedAt: -1 });
FlightSessionSchema.index({ status: 1 });
FlightSessionSchema.index({ source: 1 });

export const FlightSession: Model<IFlightSession> =
  mongoose.models.FlightSession ||
  mongoose.model<IFlightSession>('FlightSession', FlightSessionSchema);

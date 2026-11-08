import mongoose, { Model, Schema } from 'mongoose';
import { IGeoJSONPoint } from './types.js';

export interface ITelemetryRecord {
  droneId: mongoose.Types.ObjectId;
  flightSessionId?: mongoose.Types.ObjectId;
  recordedAt: Date;
  receivedAt?: Date;
  source: string;
  isSimulated: boolean;
  location?: IGeoJSONPoint;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  relativeAltitude?: number;
  groundSpeed?: number;
  heading?: number;
  gpsFixType?: string;
  satellites?: number;
  hdop?: number;
  batteryVoltage?: number;
  batteryCurrent?: number;
  batteryPercentage?: number;
  flightMode?: string;
  armed: boolean;
  sensorHealth?: Record<string, unknown>;
  connectionStatus?: string;
  createdAt?: Date;
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
        message: 'Telemetry Point coordinates must be [longitude (-180..180), latitude (-90..90)]'
      }
    }
  },
  { _id: false }
);

const TelemetryRecordSchema = new Schema<ITelemetryRecord>(
  {
    droneId: {
      type: Schema.Types.ObjectId,
      ref: 'Drone',
      required: [true, 'Associated Drone reference is required'],
      index: true
    },
    flightSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'FlightSession',
      index: true
    },
    recordedAt: {
      type: Date,
      required: [true, 'Recorded timestamp is required'],
      index: true
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    source: {
      type: String,
      required: [true, 'Telemetry source is required'],
      trim: true
    },
    isSimulated: {
      type: Boolean,
      required: true,
      default: false
    },
    location: {
      type: GeoPointSchema
    },
    latitude: {
      type: Number,
      min: [-90, 'Latitude cannot be less than -90 degrees'],
      max: [90, 'Latitude cannot exceed 90 degrees']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude cannot be less than -180 degrees'],
      max: [180, 'Longitude cannot exceed 180 degrees']
    },
    altitude: {
      type: Number // Altitude MSL in meters
    },
    relativeAltitude: {
      type: Number // Altitude AGL in meters
    },
    groundSpeed: {
      type: Number,
      min: [0, 'Ground speed cannot be negative']
    },
    heading: {
      type: Number,
      min: [0, 'Heading cannot be less than 0 degrees'],
      max: [360, 'Heading cannot exceed 360 degrees']
    },
    gpsFixType: {
      type: String,
      trim: true
    },
    satellites: {
      type: Number,
      min: [0, 'Satellites visible cannot be negative']
    },
    hdop: {
      type: Number,
      min: [0, 'HDOP cannot be negative']
    },
    batteryVoltage: {
      type: Number,
      min: [0, 'Battery voltage cannot be negative']
    },
    batteryCurrent: {
      type: Number
    },
    batteryPercentage: {
      type: Number,
      min: [0, 'Battery percentage must be between 0 and 100'],
      max: [100, 'Battery percentage must be between 0 and 100']
    },
    flightMode: {
      type: String,
      trim: true
    },
    armed: {
      type: Boolean,
      required: true,
      default: false
    },
    sensorHealth: {
      type: Schema.Types.Mixed,
      default: {}
    },
    connectionStatus: {
      type: String,
      default: 'CONNECTED',
      trim: true
    }
  },
  {
    collection: 'telemetryrecords',
    timestamps: { createdAt: true, updatedAt: false } // Telemetry records are immutable once persisted
  }
);

// Pre-validate hook: auto-sync location Point if latitude and longitude are supplied
TelemetryRecordSchema.pre('validate', function (next) {
  if (
    this.latitude !== undefined &&
    this.latitude !== null &&
    this.longitude !== undefined &&
    this.longitude !== null
  ) {
    if (this.longitude >= -180 && this.longitude <= 180 && this.latitude >= -90 && this.latitude <= 90) {
      this.location = {
        type: 'Point',
        coordinates: [this.longitude, this.latitude]
      };
    }
  }
  next();
});

// Compound Indexes for fast timeseries queries and route reconstruction
TelemetryRecordSchema.index({ droneId: 1, recordedAt: -1 });
TelemetryRecordSchema.index({ flightSessionId: 1, recordedAt: 1 });
TelemetryRecordSchema.index({ location: '2dsphere' });
TelemetryRecordSchema.index({ isSimulated: 1, recordedAt: -1 });

export const TelemetryRecord: Model<ITelemetryRecord> =
  mongoose.models.TelemetryRecord ||
  mongoose.model<ITelemetryRecord>('TelemetryRecord', TelemetryRecordSchema);

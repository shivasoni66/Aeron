import mongoose, { Model, Schema } from 'mongoose';

export type DeviceType =
  | 'FLIGHT_CONTROLLER'
  | 'GPS'
  | 'CAMERA'
  | 'POWER_MODULE'
  | 'ENVIRONMENTAL_SENSOR'
  | 'OTHER';

export type InstallationStatus = 'INSTALLED' | 'NOT_INSTALLED';

export type DeviceConnectionStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'UNKNOWN'
  | 'ERROR'
  | 'AWAITING_DATA';

export interface IHardwareDevice {
  deviceId: string;
  droneId: mongoose.Types.ObjectId;
  deviceType: DeviceType;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  installationStatus: InstallationStatus;
  connectionStatus: DeviceConnectionStatus;
  lastSeenAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const HardwareDeviceSchema = new Schema<IHardwareDevice>(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    droneId: {
      type: Schema.Types.ObjectId,
      ref: 'Drone',
      required: [true, 'Parent Drone ID reference is required'],
      index: true
    },
    deviceType: {
      type: String,
      required: [true, 'Device type is required'],
      enum: {
        values: [
          'FLIGHT_CONTROLLER',
          'GPS',
          'CAMERA',
          'POWER_MODULE',
          'ENVIRONMENTAL_SENSOR',
          'OTHER'
        ],
        message: '{VALUE} is not a valid device type'
      }
    },
    manufacturer: {
      type: String,
      required: [true, 'Device manufacturer is required'],
      trim: true
    },
    model: {
      type: String,
      required: [true, 'Device model is required'],
      trim: true
    },
    serialNumber: {
      type: String,
      trim: true
    },
    installationStatus: {
      type: String,
      required: [true, 'Installation status is required'],
      enum: {
        values: ['INSTALLED', 'NOT_INSTALLED'],
        message: '{VALUE} is not a valid installation status'
      },
      default: 'INSTALLED'
    },
    connectionStatus: {
      type: String,
      required: [true, 'Connection status is required'],
      enum: {
        values: ['CONNECTED', 'DISCONNECTED', 'UNKNOWN', 'ERROR', 'AWAITING_DATA'],
        message: '{VALUE} is not a valid connection status'
      },
      default: 'UNKNOWN'
    },
    lastSeenAt: {
      type: Date
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'hardwaredevices',
    timestamps: true
  }
);

// Indexes
HardwareDeviceSchema.index({ droneId: 1, deviceType: 1 });
HardwareDeviceSchema.index({ connectionStatus: 1 });

export const HardwareDevice: Model<IHardwareDevice> =
  mongoose.models.HardwareDevice ||
  mongoose.model<IHardwareDevice>('HardwareDevice', HardwareDeviceSchema);

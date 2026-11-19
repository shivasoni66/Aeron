import mongoose, { Model, Schema } from 'mongoose';
import { IGeoJSONPoint } from './types.js';

export type DeliveryStatus =
  | 'ORDERED'
  | 'ASSIGNED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'APPROACHING'
  | 'DELIVERED'
  | 'CANCELLED';

export type DeliveryPriority = 'STANDARD' | 'URGENT' | 'CRITICAL';

export interface IDeliveryLocation {
  name?: string;
  address?: string;
  type: 'Point';
  /**
   * Coordinates in GeoJSON format: [longitude, latitude]
   * Longitude: -180.0 to 180.0
   * Latitude: -90.0 to 90.0
   */
  coordinates: [number, number];
}

export interface IDelivery {
  deliveryId: string;
  recipientId: mongoose.Types.ObjectId;
  assignedDrone?: mongoose.Types.ObjectId | null;
  assignedDroneId?: string | null;
  packageType: string;
  priority: DeliveryPriority;
  pickupLocation: IDeliveryLocation;
  destinationLocation: IDeliveryLocation;
  status: DeliveryStatus;
  dispatchedAt?: Date | null;
  deliveredAt?: Date | null;
  estimatedDeliveryAt?: Date | null;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeliveryLocationSchema = new Schema(
  {
    name: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: [true, 'Coordinates are required'],
      validate: {
        validator: (coords: number[]) =>
          Array.isArray(coords) &&
          coords.length === 2 &&
          typeof coords[0] === 'number' &&
          typeof coords[1] === 'number' &&
          !isNaN(coords[0]) &&
          !isNaN(coords[1]) &&
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

const DeliverySchema = new Schema<IDelivery>(
  {
    deliveryId: {
      type: String,
      required: [true, 'Delivery ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true
    },
    assignedDrone: {
      type: Schema.Types.ObjectId,
      ref: 'Drone',
      default: null,
      index: true
    },
    assignedDroneId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true
    },
    packageType: {
      type: String,
      required: [true, 'Package type is required'],
      trim: true
    },
    priority: {
      type: String,
      enum: {
        values: ['STANDARD', 'URGENT', 'CRITICAL'],
        message: '{VALUE} is not a valid delivery priority'
      },
      default: 'URGENT'
    },
    pickupLocation: {
      type: DeliveryLocationSchema,
      required: [true, 'Pickup location is required']
    },
    destinationLocation: {
      type: DeliveryLocationSchema,
      required: [true, 'Destination location is required']
    },
    status: {
      type: String,
      enum: {
        values: [
          'ORDERED',
          'ASSIGNED',
          'DISPATCHED',
          'IN_TRANSIT',
          'APPROACHING',
          'DELIVERED',
          'CANCELLED'
        ],
        message: '{VALUE} is not a valid delivery status'
      },
      default: 'ORDERED',
      index: true
    },
    dispatchedAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    estimatedDeliveryAt: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  },
  {
    collection: 'deliveries',
    timestamps: true
  }
);

// Performance & Query Indexes
DeliverySchema.index({ recipientId: 1, status: 1 });
DeliverySchema.index({ assignedDrone: 1, status: 1 });
DeliverySchema.index({ 'destinationLocation.coordinates': '2dsphere' });
DeliverySchema.index({ createdAt: -1 });

export const Delivery: Model<IDelivery> =
  mongoose.models.Delivery || mongoose.model<IDelivery>('Delivery', DeliverySchema);

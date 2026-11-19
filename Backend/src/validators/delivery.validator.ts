import { z } from 'zod';

const CoordinateTuple = z.tuple(
  [
    z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
    z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90')
  ],
  {
    errorMap: () => ({ message: 'Coordinates must be [longitude (-180..180), latitude (-90..90)]' })
  }
);

export const CreateDeliverySchema = z.object({
  recipientId: z
    .string()
    .trim()
    .min(1, 'Recipient ID is required')
    .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
      message: 'Recipient ID must be a valid 24-character hex ObjectId'
    }),
  packageType: z
    .string()
    .trim()
    .min(2, 'Package type must be at least 2 characters')
    .max(100, 'Package type cannot exceed 100 characters'),
  priority: z.enum(['STANDARD', 'URGENT', 'CRITICAL']).optional().default('URGENT'),
  pickupLocation: z.object({
    name: z.string().trim().max(200).optional().default('AERON Central Medical Depot'),
    address: z.string().trim().max(300).optional(),
    type: z.literal('Point').default('Point'),
    coordinates: CoordinateTuple
  }),
  destinationLocation: z.object({
    name: z.string().trim().max(200).optional(),
    address: z.string().trim().min(3, 'Destination address must be at least 3 characters').max(300),
    type: z.literal('Point').default('Point'),
    coordinates: CoordinateTuple
  }),
  assignedDrone: z.string().trim().optional(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional()
});

export const AssignDroneSchema = z.object({
  droneId: z.string().trim().min(1, 'Drone identifier (ObjectId or airframe ID) is required')
});

export const UpdateDeliveryStatusSchema = z.object({
  status: z.enum(
    [
      'ORDERED',
      'ASSIGNED',
      'DISPATCHED',
      'IN_TRANSIT',
      'APPROACHING',
      'DELIVERED',
      'CANCELLED'
    ],
    {
      errorMap: () => ({
        message:
          'Status must be one of: ORDERED, ASSIGNED, DISPATCHED, IN_TRANSIT, APPROACHING, DELIVERED, CANCELLED'
      })
    }
  ),
  notes: z.string().trim().max(1000).optional(),
  estimatedDeliveryAt: z.string().datetime().optional().or(z.date().optional())
});

import { z } from 'zod';

export const CameraStatusSchema = z.object({
  cameraId: z.string().trim().min(1, 'cameraId cannot be empty').toUpperCase(),
  droneId: z.string().trim().min(1, 'droneId cannot be empty').toUpperCase(),
  connectionStatus: z.enum([
    'NOT_INSTALLED',
    'DISCONNECTED',
    'CONNECTING',
    'CONNECTED',
    'STREAMING',
    'STALE',
    'ERROR',
    'UNKNOWN',
    'AWAITING_DATA'
  ]),
  streamStatus: z.enum(['STREAMING', 'STANDBY', 'STALE', 'OFFLINE']),
  lastFrameAt: z.string().datetime().optional().nullable(),
  source: z.enum(['REAL', 'SIMULATION']),
  resolution: z.string().trim().optional(),
  frameRate: z.number().min(0).max(60).optional(),
  errorCode: z.string().trim().optional().nullable()
});

export const CameraFrameSchema = z.object({
  cameraId: z.string().trim().min(1, 'cameraId cannot be empty').toUpperCase(),
  droneId: z.string().trim().min(1, 'droneId cannot be empty').toUpperCase(),
  capturedAt: z
    .string()
    .or(z.number())
    .transform((val) => new Date(val))
    .refine((d) => !isNaN(d.getTime()), { message: 'capturedAt must be a valid date/timestamp' }),
  source: z.enum(['REAL', 'SIMULATION']),
  contentType: z.literal('image/jpeg', {
    errorMap: () => ({ message: 'contentType must be image/jpeg' })
  }),
  frameWidth: z.number().int().min(1).max(3840),
  frameHeight: z.number().int().min(1).max(2160),
  frameSizeBytes: z.number().int().min(1).max(1048576, 'Maximum frame size is 1 MB'), // 1 MB limit
  frameData: z
    .string()
    .min(1, 'frameData base64 payload cannot be empty')
    .max(1500000, 'frameData base64 payload exceeds 1.5 MB limit')
    .refine((b64) => {
      // Basic Base64 validation and JPEG SOI/EOI check
      try {
        const buf = Buffer.from(b64, 'base64');
        return buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8; // JPEG SOI
      } catch {
        return false;
      }
    }, { message: 'frameData must be a valid base64-encoded JPEG image' }),

  // Telemetry Synchronization
  telemetryLat: z.number().min(-90).max(90).optional().nullable(),
  telemetryLon: z.number().min(-180).max(180).optional().nullable(),
  telemetryAlt: z.number().optional().nullable(),
  telemetryHeading: z.number().min(0).max(360).optional().nullable(),
  telemetryRecordedAt: z.string().datetime().optional().nullable(),
  telemetryAgeSeconds: z.number().min(0).optional().nullable()
});

export type CameraStatusInput = z.infer<typeof CameraStatusSchema>;
export type CameraFrameInput = z.infer<typeof CameraFrameSchema>;


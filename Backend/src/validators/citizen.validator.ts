import { z } from 'zod';

export const CreateCitizenReportSchema = z.object({
  category: z.enum([
    'ROAD_STRUCTURAL',
    'CROWD_SAFETY',
    'MICRO_CLIMATE_ECO',
    'SEARCH_RESCUE'
  ], {
    errorMap: () => ({ message: 'Category must be one of: ROAD_STRUCTURAL, CROWD_SAFETY, MICRO_CLIMATE_ECO, SEARCH_RESCUE' })
  }),
  description: z
    .string()
    .trim()
    .min(5, 'Issue description must be at least 5 characters')
    .max(1000, 'Issue description cannot exceed 1000 characters'),
  location: z.object({
    type: z.literal('Point', {
      errorMap: () => ({ message: "Location type must be 'Point'" })
    }),
    coordinates: z.tuple([
      z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
      z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90')
    ], {
      errorMap: () => ({ message: 'Coordinates must be [longitude, latitude] within valid geographic ranges' })
    })
  }),
  mediaAssets: z.array(z.string()).optional()
});

export const UpdateCitizenProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters').optional()
});

export const EvidenceUploadSchema = z.object({
  image: z.string().min(1, 'Image payload is required'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Supported MIME types are image/jpeg, image/png, and image/webp' })
  }).default('image/jpeg'),
  fileName: z.string().optional()
});


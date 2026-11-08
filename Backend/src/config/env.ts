import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file if available
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
    MONGODB_URI: z.string().default('mongodb://localhost:27017/aeron_dev'),
    JWT_SECRET: z.string().min(16).default('aeron_development_secret_jwt_key_at_least_16_chars'),
    JWT_ISSUER: z.string().default('aeron-auth'),
    JWT_AUDIENCE: z.string().default('aeron-client'),
    ACCESS_TOKEN_TTL_SECONDS: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('900'),
    REFRESH_TOKEN_TTL_DAYS: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('7'),
    CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  })
  .refine(
    (data) => {
      // In production, enforce minimum 32 characters for JWT_SECRET and disallow default
      if (data.NODE_ENV === 'production') {
        return (
          data.JWT_SECRET.length >= 32 &&
          !data.JWT_SECRET.includes('development')
        );
      }
      return true;
    },
    {
      message:
        'In production, JWT_SECRET must be at least 32 characters long and must not contain the word "development"',
      path: ['JWT_SECRET']
    }
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[FATAL] Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((origin) => origin.trim())
};


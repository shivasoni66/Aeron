import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file if available
dotenv.config();

/**
 * Safely strips outer wrapping quotes, BOM, assignment prefixes, and trims whitespace.
 * Prevents common misconfigurations from cloud dashboards (e.g. Render/Heroku/AWS).
 */
export const sanitizeEnvString = (val?: string): string => {
  if (!val) return '';
  let trimmed = val.trim();
  // Strip Byte Order Mark (BOM) if present
  if (trimmed.charCodeAt(0) === 0xfeff) {
    trimmed = trimmed.slice(1).trim();
  }
  // Strip accidental assignment prefixes (e.g. "export MONGODB_URI=" or "MONGODB_URI=")
  trimmed = trimmed.replace(/^(export\s+)?(MONGODB_URI|MONGO_URI)=/, '').trim();
  // Strip matching outer quotes
  trimmed = trimmed.replace(/^["'](.*)["']$/, '$1').trim();
  return trimmed;
};

export interface SafeMongoUriAudit {
  exists: boolean;
  length: number;
  scheme: 'mongodb' | 'mongodb+srv' | 'other' | 'none';
  hasSurroundingQuotes: boolean;
  hasLeadingTrailingWhitespace: boolean;
  hasAssignmentPrefix: boolean;
  isLocalhost: boolean;
  acceptedByParser: boolean;
  parserError?: string;
}

/**
 * Performs a zero-leak audit of a MongoDB connection string.
 * NEVER logs or exposes credentials, hosts, usernames, or secrets.
 */
export const auditMongoUriSafely = (rawVal?: string): SafeMongoUriAudit => {
  if (!rawVal) {
    return {
      exists: false,
      length: 0,
      scheme: 'none',
      hasSurroundingQuotes: false,
      hasLeadingTrailingWhitespace: false,
      hasAssignmentPrefix: false,
      isLocalhost: false,
      acceptedByParser: false,
      parserError: 'Value is undefined or empty'
    };
  }

  const length = rawVal.length;
  const hasLeadingTrailingWhitespace = rawVal !== rawVal.trim();
  const trimmed = rawVal.trim();
  const hasSurroundingQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  const hasAssignmentPrefix =
    /^(export\s+)?(MONGODB_URI|MONGO_URI)=/.test(trimmed);

  const sanitized = sanitizeEnvString(rawVal);

  let scheme: 'mongodb' | 'mongodb+srv' | 'other' | 'none' = 'none';
  if (sanitized.startsWith('mongodb+srv://')) {
    scheme = 'mongodb+srv';
  } else if (sanitized.startsWith('mongodb://')) {
    scheme = 'mongodb';
  } else if (sanitized.includes('://')) {
    scheme = 'other';
  }

  const isLocalhost =
    sanitized.includes('localhost') ||
    sanitized.includes('127.0.0.1') ||
    sanitized.includes('::1');

  let acceptedByParser = false;
  let parserError: string | undefined;

  if (scheme === 'mongodb' || scheme === 'mongodb+srv') {
    try {
      const parsed = new URL(sanitized);
      if (parsed.protocol === 'mongodb:' || parsed.protocol === 'mongodb+srv:') {
        acceptedByParser = true;
      } else {
        parserError = `Unsupported scheme: ${parsed.protocol}`;
      }
    } catch (e) {
      parserError = e instanceof Error ? e.message : 'URL parser rejected format';
    }
  } else {
    parserError = 'Invalid scheme: expected mongodb:// or mongodb+srv://';
  }

  return {
    exists: true,
    length,
    scheme,
    hasSurroundingQuotes,
    hasLeadingTrailingWhitespace,
    hasAssignmentPrefix,
    isLocalhost,
    acceptedByParser,
    parserError
  };
};

// Normalize process.env.MONGODB_URI before validation if present
if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = sanitizeEnvString(process.env.MONGODB_URI);
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
    MONGODB_URI: z
      .string()
      .transform((val) => sanitizeEnvString(val))
      .default('mongodb://localhost:27017/aeron_dev'),
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
    DRONE_BRIDGE_TOKEN: z.string().default('aeron_drone_bridge_secret_token_dev'),
    CAMERA_BRIDGE_TOKEN: z.string().default('aeron_camera_bridge_secret_token_dev'),
    STORAGE_PROVIDER: z.enum(['LOCAL', 'CLOUDINARY', 'S3']).default('LOCAL'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    CORS_ORIGIN: z
      .string()
      .default(
        'http://localhost:5173,http://localhost:5174,https://aeron-admin.sharprad-x.tech,https://aeron-manager.sharprad-x.tech'
      ),
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
  )
  .refine(
    (data) => {
      // In production, enforce non-empty MongoDB URI with valid scheme and reject localhost
      if (data.NODE_ENV === 'production') {
        const uri = data.MONGODB_URI;
        const hasValidScheme =
          uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
        const isLocalhost =
          uri.includes('localhost') ||
          uri.includes('127.0.0.1') ||
          uri === 'mongodb://localhost:27017/aeron_dev';

        return hasValidScheme && !isLocalhost;
      }
      return true;
    },
    {
      message:
        'In production, MONGODB_URI is required, must start with mongodb:// or mongodb+srv://, and must not point to localhost or 127.0.0.1',
      path: ['MONGODB_URI']
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


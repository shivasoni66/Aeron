import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

let currentStatus: DatabaseStatus = 'disconnected';
let lastError: string | null = null;

export const getDatabaseStatus = (): {
  status: DatabaseStatus;
  readyState: number;
  host?: string;
  name?: string;
  error?: string;
} => {
  const readyState = mongoose.connection.readyState;
  let status: DatabaseStatus = 'disconnected';

  switch (readyState) {
    case 1:
      status = 'connected';
      break;
    case 2:
      status = 'connecting';
      break;
    default:
      status = currentStatus === 'error' ? 'error' : 'disconnected';
      break;
  }

  return {
    status,
    readyState,
    host: readyState === 1 ? mongoose.connection.host : undefined,
    name: readyState === 1 ? mongoose.connection.name : undefined,
    error: lastError ?? undefined
  };
};

export const connectDatabase = async (customUri?: string): Promise<boolean> => {
  if (mongoose.connection.readyState === 1) {
    logger.info('MongoDB already connected');
    return true;
  }

  currentStatus = 'connecting';
  lastError = null;

  const targetUri = customUri || env.MONGODB_URI;

  try {
    logger.info(`Connecting to MongoDB at: ${targetUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}...`);
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    currentStatus = 'connected';
    logger.info('MongoDB connection established successfully');
    return true;
  } catch (err: unknown) {
    currentStatus = 'error';
    const message = err instanceof Error ? err.message : 'Unknown MongoDB connection error';
    lastError = message;
    logger.warn(`MongoDB connection deferred or unreachable: ${message}`);
    // Non-fatal during scaffolding so API can run in degraded/mock mode
    return false;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    logger.info('Closing MongoDB connection...');
    await mongoose.disconnect();
    currentStatus = 'disconnected';
    logger.info('MongoDB connection closed');
  }
};

mongoose.connection.on('disconnected', () => {
  currentStatus = 'disconnected';
  logger.warn('MongoDB disconnected event triggered');
});

mongoose.connection.on('error', (err) => {
  currentStatus = 'error';
  lastError = err.message;
  logger.error('MongoDB internal connection error', err);
});


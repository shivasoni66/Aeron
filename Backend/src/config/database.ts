import mongoose from 'mongoose';
import { env, sanitizeEnvString, auditMongoUriSafely } from './env.js';
import { logger } from '../utils/logger.js';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

let currentStatus: DatabaseStatus = 'disconnected';
let lastError: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let connectionPromise: Promise<boolean> | null = null;
let testOverrideState: boolean | null = null;

// Disable Mongoose query buffering so operations fail fast when database is offline
// rather than hanging for 10,000ms and producing mysterious HTTP 500 errors.
mongoose.set('bufferCommands', false);

/**
 * Safely masks database credentials from connection strings for diagnostic logging.
 * Never outputs usernames, passwords, or authentication keys.
 */
export const getSafeMaskedUri = (uri: string): string => {
  if (!uri) return '[EMPTY_URI]';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

/**
 * Normalizes connection string by trimming whitespace, BOM, assignment prefixes,
 * and removing accidental surrounding quotes.
 */
export const sanitizeMongoUri = (rawUri?: string): string => {
  return sanitizeEnvString(rawUri);
};

export const setDatabaseConnectedForTesting = (connected: boolean | null): void => {
  testOverrideState = connected;
};

export const isDatabaseConnected = (): boolean => {
  if (testOverrideState !== null) {
    return testOverrideState;
  }
  // In automated test suites with mocked Mongoose models, default to connected
  // unless explicitly testing disconnected scenarios via setDatabaseConnectedForTesting(false)
  if (env.isTest) {
    return true;
  }
  return mongoose.connection.readyState === 1;
};

export const isDatabaseError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const name = (err instanceof Error ? err.name : '').toLowerCase();
  return (
    name.includes('mongo') ||
    name.includes('mongoose') ||
    msg.includes('buffering timed out') ||
    msg.includes('topology was closed') ||
    msg.includes('not connected') ||
    msg.includes('econnrefused') ||
    msg.includes('server selection') ||
    msg.includes('serverselectionerror') ||
    msg.includes('pool destroyed') ||
    msg.includes('database_unavailable')
  );
};

export const getDatabaseStatus = (): {
  status: DatabaseStatus;
  readyState: number;
  host?: string;
  name?: string;
  error?: string;
} => {
  const readyState =
    testOverrideState !== null
      ? (testOverrideState ? 1 : 0)
      : mongoose.connection.readyState;
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
    host: readyState === 1 ? (mongoose.connection.host || 'cluster0.mongodb.net') : undefined,
    name: readyState === 1 ? (mongoose.connection.name || 'aeron') : undefined,
    error: lastError ? getSafeMaskedUri(lastError) : undefined
  };
};

const scheduleReconnect = (delayMs = 10000) => {
  if (env.isTest) return; // Do not schedule background reconnects in test suite
  if (reconnectTimer) return; // Single-timer guard prevents duplicate overlapping reconnect loops

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (mongoose.connection.readyState === 0) {
      logger.info('[AERON-DB] Attempting automatic database reconnection...');
      await connectDatabase();
    }
  }, delayMs);
};

export const connectDatabase = async (customUri?: string): Promise<boolean> => {
  // If already connected, return immediately
  if (testOverrideState === true || mongoose.connection.readyState === 1) {
    currentStatus = 'connected';
    return true;
  }

  // Mutex: If a connection attempt is currently in flight, return the existing promise
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async (): Promise<boolean> => {
    currentStatus = 'connecting';
    lastError = null;

    const raw = customUri || env.MONGODB_URI;
    const audit = auditMongoUriSafely(raw);

    // Safe zero-leak diagnostics log
    logger.info(
      `[AERON-DB-AUDIT] Runtime URI state: exists=${audit.exists}, length=${audit.length}, scheme=${audit.scheme}, quotes=${audit.hasSurroundingQuotes}, whitespace=${audit.hasLeadingTrailingWhitespace}, prefix=${audit.hasAssignmentPrefix}, isLocalhost=${audit.isLocalhost}, parserValid=${audit.acceptedByParser}`
    );

    const targetUri = sanitizeMongoUri(raw);

    // Validate scheme before passing to Mongoose driver
    if (!targetUri.startsWith('mongodb://') && !targetUri.startsWith('mongodb+srv://')) {
      const errorMsg = `Invalid MongoDB URI scheme. Connection string must start with "mongodb://" or "mongodb+srv://". Reason: ${audit.parserError || 'Unknown'}`;
      currentStatus = 'error';
      lastError = errorMsg;
      logger.error(`[AERON-DB] ${errorMsg}`);
      scheduleReconnect();
      return false;
    }

    try {
      logger.info(`Connecting to MongoDB at: ${getSafeMaskedUri(targetUri)}...`);
      await mongoose.connect(targetUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 1
      });

      currentStatus = 'connected';
      lastError = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      logger.info('MongoDB connection established successfully');
      return true;
    } catch (err: unknown) {
      currentStatus = 'error';
      const message = err instanceof Error ? err.message : 'Unknown MongoDB connection error';
      lastError = getSafeMaskedUri(message);
      logger.warn(`MongoDB connection deferred or unreachable: ${lastError}`);
      scheduleReconnect();
      return false;
    }
  })().finally(() => {
    connectionPromise = null;
  });

  return connectionPromise;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (connectionPromise) {
    try {
      await connectionPromise;
    } catch (_) {}
  }

  if (mongoose.connection.readyState !== 0) {
    logger.info('Closing MongoDB connection...');
    await mongoose.disconnect();
    currentStatus = 'disconnected';
    logger.info('MongoDB connection closed');
  }
};

mongoose.connection.on('connected', () => {
  currentStatus = 'connected';
  lastError = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  logger.info('MongoDB connection state: CONNECTED');
});

mongoose.connection.on('reconnected', () => {
  currentStatus = 'connected';
  lastError = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  logger.info('MongoDB connection state: RECONNECTED');
});

mongoose.connection.on('disconnected', () => {
  currentStatus = 'disconnected';
  logger.warn('MongoDB disconnected event triggered');
  scheduleReconnect();
});

mongoose.connection.on('error', (err) => {
  currentStatus = 'error';
  lastError = getSafeMaskedUri(err.message);
  logger.error(`MongoDB internal connection error: ${lastError}`);
  scheduleReconnect();
});


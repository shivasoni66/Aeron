import mongoose from 'mongoose';
import { AuditLog, AuditSource } from '../models/AuditLog.js';
import { logger } from './logger.js';

export interface AuditLogParams {
  action: string;
  actorId?: mongoose.Types.ObjectId | string;
  entityType: string;
  entityId: string;
  source: AuditSource;
  metadata?: Record<string, unknown>;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'secret',
  'authorization'
]);

/**
 * Sanitizes metadata to guarantee that no credentials, tokens, or hashes are logged.
 */
export const sanitizeMetadata = (data?: Record<string, unknown>): Record<string, unknown> => {
  if (!data) return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
};

/**
 * Records a security audit event in the immutable auditlogs collection.
 * Non-blocking: failures in audit recording do not crash the primary operational workflow.
 */
export const recordAuthAudit = async (params: AuditLogParams): Promise<void> => {
  // If not connected to MongoDB (e.g. running unit tests offline), do not buffer
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    const actorObjectId =
      params.actorId && mongoose.Types.ObjectId.isValid(params.actorId)
        ? new mongoose.Types.ObjectId(params.actorId)
        : undefined;

    await AuditLog.create({
      action: params.action.toUpperCase(),
      actorId: actorObjectId,
      entityType: params.entityType,
      entityId: params.entityId,
      source: params.source,
      timestamp: new Date(),
      metadata: sanitizeMetadata(params.metadata)
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`[AUDIT-LOG-FAILURE] Failed to record security audit log: ${msg}`, {
      action: params.action
    });
  }
};

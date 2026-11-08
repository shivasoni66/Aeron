import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { hashPassword, validatePasswordPolicy } from '../utils/password.js';
import { recordAuthAudit } from '../utils/audit.js';
import { logger } from '../utils/logger.js';

/**
 * AERON Initial Administrator CLI Bootstrap.
 * Requirements:
 * 1. Must NOT be accessible via HTTP endpoints.
 * 2. Only runs if ZERO administrator accounts exist.
 * 3. Never logs or displays the password.
 */
const bootstrapAdmin = async () => {
  logger.info('[BOOTSTRAP] Connecting to AERON database...');
  const connected = await connectDatabase();
  if (!connected) {
    logger.error('[BOOTSTRAP-ERROR] Failed to establish database connection');
    process.exit(1);
  }

  try {
    // 1. Enforce strict single-execution: Check if an admin already exists
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      logger.warn(
        `[BOOTSTRAP-ABORT] Security guard: ${adminCount} administrator account(s) already exist. Initial bootstrap disallowed.`
      );
      await disconnectDatabase();
      process.exit(1);
    }

    // 2. Extract configuration from environment or command line arguments
    const email =
      process.env.BOOTSTRAP_ADMIN_EMAIL ||
      process.argv.find((arg) => arg.startsWith('--email='))?.split('=')[1] ||
      'admin@aeron.gov';

    const name =
      process.env.BOOTSTRAP_ADMIN_NAME ||
      process.argv.find((arg) => arg.startsWith('--name='))?.split('=')[1] ||
      'System Administrator';

    const password =
      process.env.BOOTSTRAP_ADMIN_PASSWORD ||
      process.argv.find((arg) => arg.startsWith('--password='))?.split('=')[1];

    if (!password) {
      logger.error(
        '[BOOTSTRAP-ERROR] Admin password must be provided via BOOTSTRAP_ADMIN_PASSWORD environment variable or --password= parameter'
      );
      await disconnectDatabase();
      process.exit(1);
    }

    // 3. Enforce password complexity
    const validation = validatePasswordPolicy(password);
    if (!validation.valid) {
      logger.error(`[BOOTSTRAP-ERROR] Password policy violation: ${validation.reason}`);
      await disconnectDatabase();
      process.exit(1);
    }

    // 4. Hash password and persist first administrator
    const passwordHash = await hashPassword(password);
    const adminUser = await User.create({
      name,
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'admin',
      accountStatus: 'active'
    });

    // 5. Record immutable security audit event
    await recordAuthAudit({
      action: 'AUTH_ADMIN_BOOTSTRAP',
      actorId: adminUser._id,
      entityType: 'User',
      entityId: adminUser._id.toString(),
      source: 'SYSTEM',
      metadata: { email: adminUser.email }
    });

    logger.info(
      `[BOOTSTRAP-SUCCESS] Primary administrator provisioned successfully for ${adminUser.email}`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown bootstrap error';
    logger.error(`[BOOTSTRAP-ERROR] Failed to execute administrator bootstrap: ${msg}`);
    await disconnectDatabase();
    process.exit(1);
  }

  await disconnectDatabase();
  process.exit(0);
};

bootstrapAdmin();


import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const createCustomUsers = async () => {
  logger.info('========================================================');
  logger.info('👤 PROVISIONING CUSTOM ADMIN & MANAGER ACCOUNTS');
  logger.info('========================================================');

  const uri = process.env.MONGODB_URI || env.MONGODB_URI;
  const isConnected = await connectDatabase(uri);
  if (!isConnected) {
    logger.error('[ERROR] Failed to establish database connection to: ' + uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    process.exit(1);
  }

  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const managerPassword = process.env.MANAGER_PASSWORD;

    if (!adminPassword || !managerPassword) {
      logger.error('[SECURITY-GUARD] ADMIN_PASSWORD and MANAGER_PASSWORD must be supplied exclusively through environment variables.');
      process.exit(1);
    }

    const adminPasswordHash = await hashPassword(adminPassword);
    const managerPasswordHash = await hashPassword(managerPassword);

    // 1. Upsert Admin Account
    const adminUser = await User.findOneAndUpdate(
      { email: 'admin@gmail.com' },
      {
        $set: {
          name: 'Administrator',
          email: 'admin@gmail.com',
          passwordHash: adminPasswordHash,
          role: 'admin',
          accountStatus: 'active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    logger.info(`✅ Admin provisioned: ${adminUser.email} (Role: ${adminUser.role})`);

    // 2. Upsert Manager Account
    const managerUser = await User.findOneAndUpdate(
      { email: 'manager@gmail.com' },
      {
        $set: {
          name: 'Mission Manager',
          email: 'manager@gmail.com',
          passwordHash: managerPasswordHash,
          role: 'manager',
          accountStatus: 'active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    logger.info(`✅ Manager provisioned: ${managerUser.email} (Role: ${managerUser.role})`);

    logger.info('========================================================');
    logger.info('🎉 Both accounts successfully provisioned in MongoDB!');
    logger.info('========================================================');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[ERROR] Failed to provision accounts: ${msg}`);
  } finally {
    await disconnectDatabase();
  }
};

createCustomUsers();


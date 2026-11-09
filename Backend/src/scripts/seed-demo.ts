import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Drone } from '../models/Drone.js';
import { Mission } from '../models/Mission.js';
import { Incident } from '../models/Incident.js';
import { CitizenReport } from '../models/CitizenReport.js';
import { MissionOutcome } from '../models/MissionOutcome.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

/**
 * AERON Demonstration Environment Seeder
 * STRICT RULES:
 * 1. Refuses to run if NODE_ENV === 'production' or env.isProduction.
 * 2. All simulated records are explicitly labelled [DEMO] or [SIMULATION].
 * 3. Never mixes simulated telemetry with real hardware records.
 * 4. Deterministic and repeatable after clean reset.
 */
export const runDemoSeeder = async (): Promise<void> => {
  logger.info('========================================================');
  logger.info('🚀 AERON DEMO ENVIRONMENT SEEDER');
  logger.info('========================================================');

  // 1. Strict environment guard: Refuse production
  if (env.isProduction || process.env.NODE_ENV === 'production') {
    logger.error('[DEMO-SEED-ABORT] Seeding demo data into a production environment is strictly prohibited!');
    process.exit(1);
  }

  // Parse optional target URI from CLI flag or environment
  const uriArg = process.argv.find((a) => a.startsWith('--uri='));
  const targetUri = uriArg ? uriArg.split('=')[1] : process.env.DEMO_MONGODB_URI || env.MONGODB_URI;

  const isConnected = await connectDatabase(targetUri);
  if (!isConnected) {
    logger.error('========================================================');
    logger.error('[DEMO-SEED-BLOCKER] Failed to connect to MongoDB.');
    if (targetUri.includes('mongodb.net')) {
      logger.error('Target cluster: MongoDB Atlas (cloud.mongodb.com)');
      logger.error('Root Cause: Your client IP address is not whitelisted in MongoDB Atlas Network Access.');
      logger.error('Resolution Steps:');
      logger.error('  1. Open MongoDB Atlas Console: https://cloud.mongodb.com');
      logger.error('  2. Navigate to Security -> Network Access -> IP Access List');
      logger.error('  3. Click "Add IP Address" and add your current public IP (or 0.0.0.0/0)');
      logger.error('  4. Alternatively, pass a local development MongoDB instance:');
      logger.error('     npm run seed:demo -- --uri=mongodb://localhost:27017/aeron_demo');
    }
    logger.error('========================================================');
    process.exit(1);
  }

  try {
    logger.info('[1/6] Cleaning existing demo records...');
    const demoEmails = ['admin.demo@aeron.gov', 'manager.demo@aeron.gov', 'citizen.demo@aeron.gov'];
    await User.deleteMany({ email: { $in: demoEmails } });
    await Drone.deleteMany({ droneId: { $in: ['DRONE-SIM-01', 'AERON-PX4-BENCH01'] } });
    await Mission.deleteMany({ missionId: { $in: ['MIS-DEMO-001', 'MIS-DEMO-002', 'MIS-DEMO-003', 'MIS-DEMO-004'] } });
    await Incident.deleteMany({ incidentId: { $in: ['INC-DEMO-001', 'INC-DEMO-002', 'INC-DEMO-003'] } });
    await CitizenReport.deleteMany({ reportId: { $in: ['AER-2026-0001', 'AER-2026-0002', 'AER-2026-0003'] } });
    await MissionOutcome.deleteMany({ outcomeId: { $in: ['OUT-DEMO-001', 'OUT-DEMO-002', 'OUT-DEMO-003'] } });

    logger.info('[2/6] Seeding demonstration users...');
    const defaultPasswordHash = await hashPassword('AeronDemo@2026!Secure');

    const [adminUser, managerUser, citizenUser] = await Promise.all([
      User.create({
        name: '[DEMO] Systems Administrator',
        email: 'admin.demo@aeron.gov',
        passwordHash: defaultPasswordHash,
        role: 'admin',
        accountStatus: 'active'
      }),
      User.create({
        name: '[DEMO] Mission Director',
        email: 'manager.demo@aeron.gov',
        passwordHash: defaultPasswordHash,
        role: 'manager',
        accountStatus: 'active'
      }),
      User.create({
        name: '[DEMO] Civic Observer',
        email: 'citizen.demo@aeron.gov',
        passwordHash: defaultPasswordHash,
        role: 'citizen',
        accountStatus: 'active'
      })
    ]);

    logger.info('[3/6] Provisioning airframes...');
    const [simDrone, benchDrone] = await Promise.all([
      Drone.create({
        droneId: 'DRONE-SIM-01',
        displayName: '[SIMULATION] AERON Alpha Demo Quadcopter',
        model: 'AERON Quadcopter (Pixhawk 2.4.8 SITL)',
        manufacturer: 'AERON Aerospace (Simulated)',
        flightController: 'Pixhawk 2.4.8 (SITL)',
        operationalStatus: 'READY',
        isSimulated: true
      }),
      Drone.create({
        droneId: 'AERON-PX4-BENCH01',
        displayName: 'AERON PX4 Bench Unit',
        model: 'AERON Quadcopter (Pixhawk 2.4.8 Hardware)',
        manufacturer: 'AERON Aerospace',
        flightController: 'Pixhawk 2.4.8 (STM32F427)',
        operationalStatus: 'STANDBY',
        isSimulated: false
      })
    ]);

    logger.info('[4/6] Seeding sample telemetry time-series for DRONE-SIM-01...');
    const now = Date.now();
    const telemetryRecords = [];
    for (let i = 10; i >= 0; i--) {
      telemetryRecords.push({
        droneId: simDrone._id,
        recordedAt: new Date(now - i * 5000),
        receivedAt: new Date(now - i * 5000 + 100),
        source: 'SIMULATION',
        isSimulated: true,
        armed: false,
        flightMode: 'LOITER',
        latitude: 12.9716 + (10 - i) * 0.0001,
        longitude: 77.5946 + (10 - i) * 0.0001,
        location: {
          type: 'Point',
          coordinates: [77.5946 + (10 - i) * 0.0001, 12.9716 + (10 - i) * 0.0001]
        },
        altitude: 15.0,
        relativeAltitude: 15.0,
        groundSpeed: 2.1,
        heading: 90.0,
        batteryVoltage: 15.4 - i * 0.02,
        batteryPercentage: 92 - i,
        satellites: 12,
        gpsFixType: '3D_FIX',
        connectionStatus: 'CONNECTED'
      });
    }
    await TelemetryRecord.insertMany(telemetryRecords);

    logger.info('[5/6] Seeding demo missions across all 4 operational verticals...');
    const [m01, m02, m03, m04] = await Promise.all([
      Mission.create({
        missionId: 'MIS-DEMO-001',
        title: '[DEMO] Asphalt Fissure Survey - 8th Main Road',
        description: 'Municipal road integrity inspection and asphalt fissure documentation.',
        category: 'CIVIC_ISSUE_VERIFICATION',
        status: 'ACTIVE',
        stage: 3,
        stageLabel: 'INSPECTION_SCHEDULED',
        assignedDrones: [simDrone._id],
        createdBy: managerUser._id,
        operationalArea: {
          type: 'Polygon',
          coordinates: [
            [
              [77.5940, 12.9710],
              [77.5960, 12.9710],
              [77.5960, 12.9730],
              [77.5940, 12.9730],
              [77.5940, 12.9710]
            ]
          ]
        }
      }),
      Mission.create({
        missionId: 'MIS-DEMO-002',
        title: '[DEMO] Central Plaza Crowd Density Surveillance',
        description: 'Perimeter crowd flow and assembly density monitoring.',
        category: 'CROWD_SAFETY',
        status: 'ACTIVE',
        stage: 2,
        stageLabel: 'MISSION_INITIALIZED',
        assignedDrones: [simDrone._id],
        createdBy: managerUser._id
      }),
      Mission.create({
        missionId: 'MIS-DEMO-003',
        title: '[DEMO] Urban Heat Island Micro-Climate Mapping',
        description: 'Ambient environmental sensor survey across commercial district.',
        category: 'MICRO_CLIMATE_MONITORING',
        status: 'COMPLETED',
        stage: 8,
        stageLabel: 'OUTCOME_RESOLVED',
        assignedDrones: [simDrone._id],
        createdBy: managerUser._id
      }),
      Mission.create({
        missionId: 'MIS-DEMO-004',
        title: '[DEMO] Sector 7 Subterranean Drainage Search & Rescue Drill',
        description: 'Confidential culvert ingress drill and beacon localization drill.',
        category: 'SEARCH_AND_RESCUE',
        status: 'ACTIVE',
        stage: 4,
        stageLabel: 'AERIAL_RECON_ACTIVE',
        isConfidential: true,
        confidentialReason: 'Classified subterranean rescue coordinate survey',
        assignedDrones: [simDrone._id],
        createdBy: managerUser._id
      })
    ]);

    logger.info('[6/6] Seeding demo incidents, reports & verified public outcomes...');
    await Promise.all([
      Incident.create({
        incidentId: 'INC-DEMO-001',
        title: '[DEMO] Major Asphalt Fissure on 8th Main',
        description: 'Asphalt cracking approx 4.2m length along lane 2.',
        category: 'ROAD_STRUCTURAL',
        severity: 'MEDIUM',
        status: 'INVESTIGATING',
        missionId: m01._id,
        reportedBy: citizenUser._id,
        location: { type: 'Point', coordinates: [77.5946, 12.9716] }
      }),
      CitizenReport.create({
        reportId: 'AER-2026-0001',
        citizenId: citizenUser._id,
        title: '[DEMO] Deep road fissure near bus shelter',
        description: 'Pavement damaged and cracked, posing hazard to cyclists and two-wheelers.',
        category: 'ROAD_STRUCTURAL',
        status: 'RESOLVED',
        stage: 6,
        stageLabel: 'RESOLVED',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        earnedPoints: 50,
        linkedMissionId: m01._id
      }),
      CitizenReport.create({
        reportId: 'AER-2026-0002',
        citizenId: citizenUser._id,
        title: '[DEMO] Storm drain obstruction with plastic debris',
        description: 'Surface storm drain blocked before monsoon.',
        category: 'MICRO_CLIMATE_ECO',
        status: 'AERIAL_VERIFIED',
        stage: 4,
        stageLabel: 'AERIAL_VERIFIED',
        location: { type: 'Point', coordinates: [77.5950, 12.9720] },
        earnedPoints: 25,
        linkedMissionId: m03._id
      }),
      CitizenReport.create({
        reportId: 'AER-2026-0003',
        citizenId: citizenUser._id,
        title: '[DEMO] Hazardous sidewalk paving displacement',
        description: 'Pedestrian pavement uplifted near junction.',
        category: 'CROWD_SAFETY',
        status: 'SUBMITTED',
        stage: 1,
        stageLabel: 'SUBMITTED',
        location: { type: 'Point', coordinates: [77.5940, 12.9710] },
        earnedPoints: 25
      }),
      MissionOutcome.create({
        outcomeId: 'OUT-DEMO-001',
        missionId: m01._id,
        outcomeType: 'CIVIC_ISSUE_VERIFICATION',
        reviewStatus: 'PUBLISHED',
        isPublic: true,
        isConfidential: false,
        summary: 'Aerial inspection verified 4.2m fissure along 8th Main.',
        publicSummary: 'Aerial inspection verified 4.2m fissure along 8th Main. Municipal works crew dispatched.',
        reviewedBy: managerUser._id,
        reviewedAt: new Date(),
        publishedBy: managerUser._id,
        publishedAt: new Date()
      }),
      MissionOutcome.create({
        outcomeId: 'OUT-DEMO-002',
        missionId: m02._id,
        outcomeType: 'CROWD_SAFETY',
        reviewStatus: 'APPROVED',
        isPublic: false,
        isConfidential: false,
        summary: 'Assembly density verified under safe perimeter limit (1.2 persons/m²).',
        reviewedBy: managerUser._id,
        reviewedAt: new Date()
      }),
      MissionOutcome.create({
        outcomeId: 'OUT-DEMO-003',
        missionId: m04._id,
        outcomeType: 'SEARCH_AND_RESCUE',
        reviewStatus: 'APPROVED',
        isPublic: false,
        isConfidential: true,
        confidentialReason: 'Subterranean rescue drill telemetry containing sensitive structural ingress coordinates.',
        summary: 'Subterranean drainage ingress survey completed.',
        reviewedBy: managerUser._id,
        reviewedAt: new Date()
      })
    ]);

    logger.info('========================================================');
    logger.info('✅ DEMONSTRATION SEEDING COMPLETED SUCCESSFULLY');
    logger.info('========================================================');
    logger.info('Demo Credentials:');
    logger.info('  Admin   : admin.demo@aeron.gov   / AeronDemo@2026!Secure');
    logger.info('  Manager : manager.demo@aeron.gov / AeronDemo@2026!Secure');
    logger.info('  Citizen : citizen.demo@aeron.gov / AeronDemo@2026!Secure');
    logger.info('Airframes : DRONE-SIM-01 (Simulated), AERON-PX4-BENCH01 (Hardware)');
    logger.info('Missions  : MIS-DEMO-001 (M01), MIS-DEMO-002 (M02), MIS-DEMO-003 (M03), MIS-DEMO-004 (M04-Confidential)');
    logger.info('========================================================');
  } catch (err) {
    logger.error('[DEMO-SEED-FATAL] Failed during demo data creation:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
};

// If executed directly from CLI: run
if (process.argv[1]?.endsWith('seed-demo.ts') || process.argv[1]?.endsWith('seed-demo.js')) {
  runDemoSeeder().catch((err) => {
    console.error('Fatal unhandled seed error:', err);
    process.exit(1);
  });
}


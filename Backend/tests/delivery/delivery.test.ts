import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { Delivery } from '../../src/models/Delivery.js';
import { Drone } from '../../src/models/Drone.js';
import { User } from '../../src/models/User.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import {
  CreateDeliverySchema,
  AssignDroneSchema,
  UpdateDeliveryStatusSchema
} from '../../src/validators/delivery.validator.js';

describe('AERON Healthcare Drone Delivery — Model, Validation & Operator Suite', () => {
  const dummyRecipientId = new mongoose.Types.ObjectId();
  const dummyDroneObjectId = new mongoose.Types.ObjectId();
  const dummyManagerId = new mongoose.Types.ObjectId().toString();
  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyAdminId = new mongoose.Types.ObjectId().toString();

  const managerToken = signAccessToken(dummyManagerId, 'manager');
  const adminToken = signAccessToken(dummyAdminId, 'admin');
  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');

  // ==========================================
  // 1. DELIVERY MONGOOSE MODEL SCHEMA TESTS
  // ==========================================
  describe('Delivery Mongoose Model Validation', () => {
    it('validates a correct delivery document', () => {
      const delivery = new Delivery({
        deliveryId: 'DEL-MED001',
        recipientId: dummyRecipientId,
        packageType: 'EMERGENCY_INSULIN',
        priority: 'CRITICAL',
        pickupLocation: {
          name: 'Central Hospital Heliport',
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        },
        destinationLocation: {
          address: '45 MG Road, Ward 7, Sector 3',
          type: 'Point',
          coordinates: [77.6033, 12.9752]
        },
        status: 'ORDERED'
      });

      const err = delivery.validateSync();
      expect(err).toBeUndefined();
      expect(delivery.deliveryId).toBe('DEL-MED001');
      expect(delivery.status).toBe('ORDERED');
      expect(delivery.priority).toBe('CRITICAL');
    });

    it('rejects delivery missing required fields', () => {
      const delivery = new Delivery({});
      const err = delivery.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.deliveryId).toBeDefined();
      expect(err?.errors.recipientId).toBeDefined();
      expect(err?.errors.packageType).toBeDefined();
      expect(err?.errors.pickupLocation).toBeDefined();
      expect(err?.errors.destinationLocation).toBeDefined();
    });

    it('rejects coordinates outside valid geographic range', () => {
      const invalidLon = new Delivery({
        deliveryId: 'DEL-INV001',
        recipientId: dummyRecipientId,
        packageType: 'BLOOD_PLASMA',
        pickupLocation: {
          type: 'Point',
          coordinates: [195.0, 12.9716] // Invalid longitude > 180
        },
        destinationLocation: {
          address: 'Test Address',
          type: 'Point',
          coordinates: [77.6, 12.9]
        }
      });
      const errLon = invalidLon.validateSync();
      expect(errLon).toBeDefined();
      expect(errLon?.errors['pickupLocation.coordinates']).toBeDefined();

      const invalidLat = new Delivery({
        deliveryId: 'DEL-INV002',
        recipientId: dummyRecipientId,
        packageType: 'BLOOD_PLASMA',
        pickupLocation: {
          type: 'Point',
          coordinates: [77.5, 12.9]
        },
        destinationLocation: {
          address: 'Test Address',
          type: 'Point',
          coordinates: [77.6, -95.0] // Invalid latitude < -90
        }
      });
      const errLat = invalidLat.validateSync();
      expect(errLat).toBeDefined();
      expect(errLat?.errors['destinationLocation.coordinates']).toBeDefined();
    });

    it('rejects invalid status lifecycle value', () => {
      const delivery = new Delivery({
        deliveryId: 'DEL-STATUS001',
        recipientId: dummyRecipientId,
        packageType: 'FIRST_AID',
        pickupLocation: {
          type: 'Point',
          coordinates: [77.5, 12.9]
        },
        destinationLocation: {
          address: 'Test Address',
          type: 'Point',
          coordinates: [77.6, 12.9]
        },
        // @ts-expect-error Testing invalid status
        status: 'FLYING_SOMEWHERE'
      });

      const err = delivery.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.status).toBeDefined();
    });

    it('accepts all 7 valid delivery lifecycle states', () => {
      const validStatuses = [
        'ORDERED',
        'ASSIGNED',
        'DISPATCHED',
        'IN_TRANSIT',
        'APPROACHING',
        'DELIVERED',
        'CANCELLED'
      ] as const;

      for (const status of validStatuses) {
        const doc = new Delivery({
          deliveryId: `DEL-${status}`,
          recipientId: dummyRecipientId,
          packageType: 'TEST',
          pickupLocation: { type: 'Point', coordinates: [77.5, 12.9] },
          destinationLocation: { address: 'Test', type: 'Point', coordinates: [77.6, 12.9] },
          status
        });
        expect(doc.validateSync()).toBeUndefined();
      }
    });

    it('correctly associates assigned drone reference and airframe ID', () => {
      const delivery = new Delivery({
        deliveryId: 'DEL-DRONE01',
        recipientId: dummyRecipientId,
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01',
        packageType: 'ANTIVENOM_SERUM',
        pickupLocation: { type: 'Point', coordinates: [77.5, 12.9] },
        destinationLocation: { address: 'District Hospital', type: 'Point', coordinates: [77.6, 12.9] },
        status: 'ASSIGNED'
      });

      expect(delivery.assignedDrone).toEqual(dummyDroneObjectId);
      expect(delivery.assignedDroneId).toBe('AERON-PX4-BENCH01');
      expect(delivery.validateSync()).toBeUndefined();
    });
  });

  // ==========================================
  // 2. ZOD VALIDATOR SUITE
  // ==========================================
  describe('Delivery Zod Validators', () => {
    it('validates CreateDeliverySchema with correct payload', () => {
      const payload = {
        recipientId: new mongoose.Types.ObjectId().toString(),
        packageType: 'EMERGENCY_INSULIN',
        priority: 'CRITICAL',
        pickupLocation: {
          name: 'General Hospital Depot',
          coordinates: [77.5946, 12.9716]
        },
        destinationLocation: {
          address: '45 MG Road, Ward 7, Sector 3',
          coordinates: [77.6033, 12.9752]
        },
        notes: 'Keep chilled in cold storage module'
      };

      const parsed = CreateDeliverySchema.parse(payload);
      expect(parsed.recipientId).toBe(payload.recipientId);
      expect(parsed.priority).toBe('CRITICAL');
      expect(parsed.pickupLocation.coordinates).toEqual([77.5946, 12.9716]);
    });

    it('rejects CreateDeliverySchema when recipientId is not a 24-hex ObjectId', () => {
      const payload = {
        recipientId: 'not-a-valid-object-id',
        packageType: 'EMERGENCY_INSULIN',
        pickupLocation: { coordinates: [77.5, 12.9] },
        destinationLocation: { address: 'Address', coordinates: [77.6, 12.9] }
      };

      expect(() => CreateDeliverySchema.parse(payload)).toThrow();
    });

    it('rejects AssignDroneSchema when droneId is empty', () => {
      expect(() => AssignDroneSchema.parse({ droneId: '' })).toThrow();
      expect(AssignDroneSchema.parse({ droneId: 'AERON-PX4-BENCH01' }).droneId).toBe('AERON-PX4-BENCH01');
    });

    it('validates UpdateDeliveryStatusSchema lifecycle transitions', () => {
      expect(UpdateDeliveryStatusSchema.parse({ status: 'DISPATCHED' }).status).toBe('DISPATCHED');
      expect(UpdateDeliveryStatusSchema.parse({ status: 'DELIVERED' }).status).toBe('DELIVERED');
      expect(() => UpdateDeliveryStatusSchema.parse({ status: 'INVALID_STATUS' })).toThrow();
    });
  });

  // ==========================================
  // 3. OPERATOR APIS & RBAC INTEGRATION
  // ==========================================
  describe('Operator Delivery Endpoints & RBAC Security', () => {
    const app = createApp();

    beforeEach(() => {
      vi.restoreAllMocks();

      // Auth middleware User.findById mock
      vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
        const idStr = id?.toString();
        if (idStr === dummyManagerId) {
          return {
            _id: new mongoose.Types.ObjectId(dummyManagerId),
            email: 'manager@aeron.internal',
            name: 'Medical Logistics Manager',
            role: 'manager',
            accountStatus: 'active'
          } as any;
        }
        if (idStr === dummyAdminId) {
          return {
            _id: new mongoose.Types.ObjectId(dummyAdminId),
            email: 'admin@aeron.internal',
            name: 'Operations Admin',
            role: 'admin',
            accountStatus: 'active'
          } as any;
        }
        if (idStr === dummyCitizenId) {
          return {
            _id: new mongoose.Types.ObjectId(dummyCitizenId),
            email: 'citizen@aeron.internal',
            name: 'Patient Recipient',
            role: 'citizen',
            accountStatus: 'active'
          } as any;
        }
        return null;
      });
    });

    describe('RBAC Access Control', () => {
      it('rejects unauthenticated requests to delivery routes with 401 Unauthorized', async () => {
        const res = await request(app).get('/api/v1/manager/deliveries');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHORIZED');
      });

      it('STRICTLY BLOCKS citizens from accessing manager delivery management with 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/v1/manager/deliveries')
          .set('Authorization', `Bearer ${citizenToken}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_ROLE');
      });

      it('ALLOWS authorized manager to access delivery operations', async () => {
        vi.spyOn(Delivery, 'find').mockReturnValue({
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: () => ({
                    lean: async () => []
                  })
                })
              })
            })
          })
        } as any);
        vi.spyOn(Delivery, 'countDocuments').mockResolvedValue(0 as any);

        const res = await request(app)
          .get('/api/v1/manager/deliveries')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.deliveries).toEqual([]);
      });
    });

    describe('POST /api/v1/manager/deliveries (Create Delivery)', () => {
      it('creates delivery and returns HTTP 201 with populated relations', async () => {
        const mockCreated = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-X1Y2Z3',
          recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
          packageType: 'EMERGENCY_INSULIN',
          priority: 'URGENT',
          status: 'ORDERED',
          pickupLocation: { name: 'Central Depot', type: 'Point', coordinates: [77.59, 12.97] },
          destinationLocation: { address: 'MG Road', type: 'Point', coordinates: [77.60, 12.98] }
        };

        vi.spyOn(Delivery, 'create').mockResolvedValue(mockCreated as any);
        vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
        vi.spyOn(Delivery, 'findById').mockReturnValue({
          populate: () => ({
            populate: async () => ({
              ...mockCreated,
              recipientId: {
                _id: dummyCitizenId,
                name: 'Patient Recipient',
                email: 'citizen@aeron.internal',
                role: 'citizen'
              },
              assignedDrone: null
            })
          })
        } as any);

        const res = await request(app)
          .post('/api/v1/manager/deliveries')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            recipientId: dummyCitizenId,
            packageType: 'EMERGENCY_INSULIN',
            priority: 'URGENT',
            pickupLocation: {
              name: 'Central Depot',
              coordinates: [77.59, 12.97]
            },
            destinationLocation: {
              address: 'MG Road',
              coordinates: [77.60, 12.98]
            }
          });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('success');
        expect(res.body.data.delivery.deliveryId).toBe('DEL-X1Y2Z3');
        expect(res.body.data.delivery.recipientId.name).toBe('Patient Recipient');
      });

      it('rejects creation when recipient user does not exist in database', async () => {
        const unknownUserId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
          .post('/api/v1/manager/deliveries')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            recipientId: unknownUserId,
            packageType: 'EMERGENCY_INSULIN',
            pickupLocation: { coordinates: [77.59, 12.97] },
            destinationLocation: { address: 'MG Road', coordinates: [77.60, 12.98] }
          });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('RECIPIENT_NOT_FOUND');
      });
    });

    describe('GET /api/v1/manager/deliveries/:deliveryId', () => {
      it('returns 404 when delivery is not found', async () => {
        vi.spyOn(Delivery, 'findOne').mockReturnValue({
          populate: () => ({
            populate: async () => null
          })
        } as any);

        const res = await request(app)
          .get('/api/v1/manager/deliveries/DEL-NOTFOUND')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('DELIVERY_NOT_FOUND');
      });

      it('returns full delivery details when found', async () => {
        const mockDelivery = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-EXISTS01',
          packageType: 'BLOOD_PLASMA',
          status: 'ORDERED'
        };

        vi.spyOn(Delivery, 'findOne').mockReturnValue({
          populate: () => ({
            populate: async () => mockDelivery
          })
        } as any);

        const res = await request(app)
          .get('/api/v1/manager/deliveries/DEL-EXISTS01')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.delivery.deliveryId).toBe('DEL-EXISTS01');
      });
    });

    describe('PATCH /api/v1/manager/deliveries/:deliveryId/assign-drone', () => {
      it('rejects assignment if assigned drone is in MAINTENANCE or OFFLINE', async () => {
        const mockDelivery = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-ASSIGN01',
          status: 'ORDERED'
        };
        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);

        vi.spyOn(Drone, 'findOne').mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          droneId: 'AERON-PX4-BENCH01',
          operationalStatus: 'MAINTENANCE'
        } as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-ASSIGN01/assign-drone')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ droneId: 'AERON-PX4-BENCH01' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DRONE_NOT_ELIGIBLE');
      });

      it('successfully assigns operational drone and transitions ORDERED to ASSIGNED', async () => {
        const droneObjectId = new mongoose.Types.ObjectId();
        const mockDeliveryInstance = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-ASSIGN02',
          status: 'ORDERED',
          assignedDrone: null,
          assignedDroneId: null,
          save: vi.fn().mockResolvedValue(true)
        };

        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDeliveryInstance as any);
        vi.spyOn(Drone, 'findOne').mockResolvedValue({
          _id: droneObjectId,
          droneId: 'AERON-PX4-BENCH01',
          operationalStatus: 'READY'
        } as any);
        vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
        vi.spyOn(Delivery, 'findById').mockReturnValue({
          populate: () => ({
            populate: async () => ({
              ...mockDeliveryInstance,
              status: 'ASSIGNED',
              assignedDroneId: 'AERON-PX4-BENCH01'
            })
          })
        } as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-ASSIGN02/assign-drone')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ droneId: 'AERON-PX4-BENCH01' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(mockDeliveryInstance.assignedDrone).toEqual(droneObjectId);
        expect(mockDeliveryInstance.assignedDroneId).toBe('AERON-PX4-BENCH01');
        expect(mockDeliveryInstance.status).toBe('ASSIGNED');
        expect(mockDeliveryInstance.save).toHaveBeenCalled();
      });
    });

    describe('PATCH /api/v1/manager/deliveries/:deliveryId/status', () => {
      it('rejects invalid status lifecycle transition (e.g. ORDERED directly to DELIVERED)', async () => {
        const mockDelivery = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-TRANS01',
          status: 'ORDERED'
        };
        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-TRANS01/status')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'DELIVERED' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      });

      it('rejects dispatching when no drone is assigned', async () => {
        const mockDelivery = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-TRANS02',
          status: 'ASSIGNED',
          assignedDrone: null
        };
        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-TRANS02/status')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'DISPATCHED' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('NO_DRONE_ASSIGNED');
      });

      it('progresses to DISPATCHED and sets dispatchedAt timestamp', async () => {
        const mockDeliveryInstance: any = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-TRANS03',
          status: 'ASSIGNED',
          assignedDrone: new mongoose.Types.ObjectId(),
          dispatchedAt: null,
          save: vi.fn().mockResolvedValue(true)
        };

        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDeliveryInstance);
        vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
        vi.spyOn(Delivery, 'findById').mockReturnValue({
          populate: () => ({
            populate: async () => ({
              ...mockDeliveryInstance,
              status: 'DISPATCHED'
            })
          })
        } as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-TRANS03/status')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'DISPATCHED' });

        expect(res.status).toBe(200);
        expect(mockDeliveryInstance.status).toBe('DISPATCHED');
        expect(mockDeliveryInstance.dispatchedAt).toBeInstanceOf(Date);
        expect(mockDeliveryInstance.save).toHaveBeenCalled();
      });

      it('progresses to DELIVERED and sets deliveredAt timestamp', async () => {
        const mockDeliveryInstance: any = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-TRANS04',
          status: 'APPROACHING',
          assignedDrone: new mongoose.Types.ObjectId(),
          deliveredAt: null,
          save: vi.fn().mockResolvedValue(true)
        };

        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDeliveryInstance);
        vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
        vi.spyOn(Delivery, 'findById').mockReturnValue({
          populate: () => ({
            populate: async () => ({
              ...mockDeliveryInstance,
              status: 'DELIVERED'
            })
          })
        } as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-TRANS04/status')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'DELIVERED' });

        expect(res.status).toBe(200);
        expect(mockDeliveryInstance.status).toBe('DELIVERED');
        expect(mockDeliveryInstance.deliveredAt).toBeInstanceOf(Date);
        expect(mockDeliveryInstance.save).toHaveBeenCalled();
      });

      it('rejects transitioning from terminal DELIVERED state', async () => {
        const mockDelivery = {
          _id: new mongoose.Types.ObjectId(),
          deliveryId: 'DEL-TRANS05',
          status: 'DELIVERED'
        };
        vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);

        const res = await request(app)
          .patch('/api/v1/manager/deliveries/DEL-TRANS05/status')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'CANCELLED' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DELIVERY_ALREADY_CLOSED');
      });
    });
  });
});

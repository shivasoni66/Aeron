import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';
import { initSocketServer } from '../../src/sockets/socket.server.js';
import { User } from '../../src/models/User.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Auth — Socket.IO Handshake Authentication & Room Guard', () => {
  let httpServer: any;
  let serverPort: number;
  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyAdminId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    httpServer = createServer();
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  const createClient = (token?: string): ClientSocket => {
    return ClientIO(`http://localhost:${serverPort}`, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
  };

  it('rejects connection without authentication token', async () => {
    const client = createClient();

    const errMessage = await new Promise<string>((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    expect(errMessage).toBe('AUTHENTICATION_REQUIRED');
    client.disconnect();
  });

  it('rejects connection with tampered / invalid token', async () => {
    const client = createClient('invalid.jwt.token');

    const errMessage = await new Promise<string>((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    expect(errMessage).toBe('AUTHENTICATION_FAILED');
    client.disconnect();
  });

  it('rejects connection for suspended user account', async () => {
    const token = signAccessToken(dummyCitizenId, 'citizen');

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(dummyCitizenId),
      email: 'suspended@aeron.gov',
      role: 'citizen',
      accountStatus: 'suspended'
    } as any);

    const client = createClient(token);

    const errMessage = await new Promise<string>((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    expect(errMessage).toBe('ACCOUNT_SUSPENDED');
    client.disconnect();
  });

  it('allows active authenticated citizen to connect', async () => {
    const token = signAccessToken(dummyCitizenId, 'citizen');

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(dummyCitizenId),
      name: 'Active Citizen',
      email: 'citizen@aeron.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const client = createClient(token);

    const isConnected = await new Promise<boolean>((resolve) => {
      client.on('connect', () => resolve(true));
      client.on('connect_error', () => resolve(false));
    });

    expect(isConnected).toBe(true);
    client.disconnect();
  });

  it('STRICTLY BLOCKS citizen from joining raw telemetry room', async () => {
    const token = signAccessToken(dummyCitizenId, 'citizen');

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(dummyCitizenId),
      name: 'Active Citizen',
      email: 'citizen@aeron.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const client = createClient(token);

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
    });

    // Attempt unauthorized telemetry subscription
    const joinResult = await new Promise<any>((resolve) => {
      client.emit(
        'join_room',
        { room: 'drone:telemetry:AERON-HEX-01' },
        (res: any) => resolve(res)
      );
    });

    expect(joinResult.success).toBe(false);
    expect(joinResult.error).toContain('Citizens are strictly prohibited');

    client.disconnect();
  });

  it('ALLOWS administrator to join raw telemetry room', async () => {
    const token = signAccessToken(dummyAdminId, 'admin');

    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(dummyAdminId),
      name: 'Admin Chief',
      email: 'admin@aeron.gov',
      role: 'admin',
      accountStatus: 'active'
    } as any);

    const client = createClient(token);

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
    });

    const joinResult = await new Promise<any>((resolve) => {
      client.emit(
        'join_room',
        { room: 'drone:telemetry:AERON-HEX-01' },
        (res: any) => resolve(res)
      );
    });

    expect(joinResult.success).toBe(true);
    expect(joinResult.error).toBeUndefined();

    client.disconnect();
  });
});


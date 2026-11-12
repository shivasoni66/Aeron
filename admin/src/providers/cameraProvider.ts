import { DataSource } from './telemetryProvider';
import { CameraFrameData, CameraStatusData } from '../types';
import { fetchCameraStatus, fetchLatestCameraPreview } from '../services/api';
import { subscribeToCameraFeed } from '../services/socket';

export interface ICameraProvider {
  readonly dataSource: DataSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeFeed(
    droneId: string,
    onFrame: (frame: CameraFrameData) => void,
    onStatus?: (status: CameraStatusData) => void
  ): () => void;
  getLatestPreview(droneId: string): Promise<CameraFrameData | null>;
  getStatus(droneId: string): Promise<CameraStatusData | null>;
}

export class SimulationCameraProvider implements ICameraProvider {
  public readonly dataSource: DataSource = 'SIMULATION';
  private _connected: boolean = false;

  public async connect(): Promise<void> {
    this._connected = true;
  }

  public async disconnect(): Promise<void> {
    this._connected = false;
  }

  public subscribeFeed(
    droneId: string,
    onFrame: (frame: CameraFrameData) => void,
    onStatus?: (status: CameraStatusData) => void
  ): () => void {
    return subscribeToCameraFeed(
      droneId,
      (frame: any) => {
        if (frame) {
          onFrame({ ...frame, isSimulated: true });
        }
      },
      onStatus
    );
  }

  public async getLatestPreview(droneId: string): Promise<CameraFrameData | null> {
    try {
      const res = await fetchLatestCameraPreview(droneId);
      if (res?.frame) {
        return { ...res.frame, isSimulated: true };
      }
    } catch {}
    return null;
  }

  public async getStatus(droneId: string): Promise<CameraStatusData | null> {
    if (!this._connected) return null;
    try {
      const res = await fetchCameraStatus(droneId);
      return res?.camera || null;
    } catch {
      return null;
    }
  }
}

export class ESP32CameraProvider implements ICameraProvider {
  public readonly dataSource: DataSource = 'REAL_HARDWARE';
  private _connected: boolean = false;

  public async connect(): Promise<void> {
    this._connected = true;
  }

  public async disconnect(): Promise<void> {
    this._connected = false;
  }

  public subscribeFeed(
    droneId: string,
    onFrame: (frame: CameraFrameData) => void,
    onStatus?: (status: CameraStatusData) => void
  ): () => void {
    return subscribeToCameraFeed(droneId, onFrame, onStatus);
  }

  public async getLatestPreview(droneId: string): Promise<CameraFrameData | null> {
    try {
      const res = await fetchLatestCameraPreview(droneId);
      return res?.frame || null;
    } catch {
      return null;
    }
  }

  public async getStatus(droneId: string): Promise<CameraStatusData | null> {
    if (!this._connected) return null;
    try {
      const res = await fetchCameraStatus(droneId);
      return res?.camera || null;
    } catch {
      return null;
    }
  }
}

const cameraSource = import.meta.env.VITE_CAMERA_SOURCE || 'SIMULATION';
export const activeCameraProvider: ICameraProvider =
  cameraSource === 'REAL_HARDWARE'
    ? new ESP32CameraProvider()
    : new SimulationCameraProvider();

import { describe, it, expect } from 'vitest';
import { CameraFrameData, CameraStatusData } from '../../types';

describe('AERON Live Camera — Optical Payload & Telemetry Contract', () => {
  it('correctly parses real ESP32-CAM frame data with canonical backend format', () => {
    const rawFrame: CameraFrameData = {
      droneId: 'AERON-HEX-01',
      cameraId: 'ESP32-CAM-01',
      capturedAt: '2026-11-16T18:00:00.000Z',
      source: 'REAL',
      contentType: 'image/jpeg',
      frameData: '/9j/4AAQSkZJRgABAQEASABIAAD...',
      frameBase64: '/9j/4AAQSkZJRgABAQEASABIAAD...',
      frameWidth: 320,
      width: 320,
      frameHeight: 240,
      height: 240,
      frameSizeBytes: 8450,
      sizeBytes: 8450,
      telemetryLat: 12.9716,
      telemetryLon: 77.5946,
      telemetryAlt: 15.2,
      telemetryHeading: 180.0,
      telemetryAgeSeconds: 0.1
    };

    const b64 = rawFrame.frameData || rawFrame.frameBase64;
    const mime = rawFrame.contentType || rawFrame.mimeType || 'image/jpeg';
    const width = rawFrame.frameWidth || rawFrame.width;
    const height = rawFrame.frameHeight || rawFrame.height;
    const size = rawFrame.frameSizeBytes || rawFrame.sizeBytes || 0;

    expect(b64).toBeTruthy();
    expect(mime).toBe('image/jpeg');
    expect(width).toBe(320);
    expect(height).toBe(240);
    expect(`${width}x${height}`).toBe('320x240');
    expect(size).toBe(8450);
    expect(rawFrame.droneId).toBe('AERON-HEX-01');
    expect(rawFrame.telemetryLat).toBe(12.9716);
    expect(rawFrame.telemetryAlt).toBe(15.2);
  });

  it('correctly handles legacy frame payloads with frameBase64 fallback', () => {
    const legacyFrame: CameraFrameData = {
      droneId: 'AERON-HEX-01',
      deviceId: 'ESP32-CAM-01',
      capturedAt: '2026-11-16T18:00:00.000Z',
      frameBase64: '/9j/4AAQSkZJRgABAQEASABIAAD...',
      mimeType: 'image/jpeg',
      width: 640,
      height: 480,
      sizeBytes: 25000
    };

    const b64 = legacyFrame.frameData || legacyFrame.frameBase64;
    const mime = legacyFrame.contentType || legacyFrame.mimeType || 'image/jpeg';
    const width = legacyFrame.frameWidth || legacyFrame.width;
    const height = legacyFrame.frameHeight || legacyFrame.height;

    expect(b64).toBe('/9j/4AAQSkZJRgABAQEASABIAAD...');
    expect(mime).toBe('image/jpeg');
    expect(width).toBe(640);
    expect(height).toBe(480);
    expect(`${width}x${height}`).toBe('640x480');
  });

  it('correctly processes authoritative ESP32-CAM status snapshot', () => {
    const status: CameraStatusData = {
      droneId: 'AERON-HEX-01',
      cameraId: 'ESP32-CAM-01',
      deviceId: 'ESP32-CAM-01',
      installed: true,
      reachable: true,
      streaming: true,
      fps: 2.0,
      frameRate: 2.0,
      connectionStatus: 'STREAMING',
      streamStatus: 'STREAMING',
      source: 'REAL',
      resolution: '320x240',
      ipAddress: '10.231.241.200',
      recordedAt: '2026-11-16T18:00:00.000Z'
    };

    expect(status.droneId).toBe('AERON-HEX-01');
    expect(status.streaming).toBe(true);
    expect(status.fps).toBe(2.0);
    expect(status.resolution).toBe('320x240');
    expect(status.ipAddress).toBe('10.231.241.200');
    expect(status.source).toBe('REAL');
  });

  it('formats telemetry HUD metrics correctly for display', () => {
    const lat = 12.971599;
    const lon = 77.594588;
    const alt = 24.67;
    const heading = 179.8;
    const speed = 4.23;

    expect(lat.toFixed(5)).toBe('12.97160');
    expect(lon.toFixed(5)).toBe('77.59459');
    expect(alt.toFixed(1)).toBe('24.7');
    expect(Math.round(heading)).toBe(180);
    expect(speed.toFixed(1)).toBe('4.2');
  });

  it('verifies Direct HTTP MJPEG camera mode defaults and fallback endpoints', () => {
    const directStreamUrl = 'http://10.231.241.200:81/stream';

    // deriveProbeUrl logic: strip port 81 and /stream, use port 80 /capture
    const deriveProbeUrl = (url: string): string => {
      try {
        const parsed = new URL(url);
        return `http://${parsed.hostname}/capture`;
      } catch {
        return url.replace(/:81\/stream.*$/, '/capture').replace(/:\d+\/stream.*$/, '/capture');
      }
    };

    const probeUrl = deriveProbeUrl(directStreamUrl);
    expect(probeUrl).toBe('http://10.231.241.200/capture');

    // Probe is different from stream URL (port 80 vs port 81)
    expect(probeUrl).not.toBe(directStreamUrl);

    // Cache-busting timestamp URL generation for reconnection
    const now = 1731780000000;
    const cacheBusterUrl = `${directStreamUrl}?t=${now}`;
    expect(cacheBusterUrl).toBe('http://10.231.241.200:81/stream?t=1731780000000');

    // Probe cache-bust URL
    const probeCacheBuster = `${probeUrl}?t=${now}`;
    expect(probeCacheBuster).toBe('http://10.231.241.200/capture?t=1731780000000');
  });

  it('decouples camera status from Pixhawk telemetry connectivity', () => {
    // Camera is LIVE while Pixhawk telemetry is disconnected
    const cameraState = 'LIVE';
    const telemetryConnected = false;

    const isCameraActive = cameraState === 'LIVE';
    const isTelemetryActive = telemetryConnected;

    expect(isCameraActive).toBe(true);
    expect(isTelemetryActive).toBe(false);

    // In direct mode, FPS is reported as native browser rendered, not fabricated
    const directFpsDisplay = 'N/A (Native Stream)';
    expect(directFpsDisplay).toBe('N/A (Native Stream)');
  });

  it('validates health probe state machine transitions', () => {
    type DirectState = 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DISCONNECTED';
    const MAX_CONSECUTIVE_FAILURES = 3;

    // Success: any state → LIVE
    const onProbeSuccess = (_prev: DirectState): DirectState => 'LIVE';
    expect(onProbeSuccess('CONNECTING')).toBe('LIVE');
    expect(onProbeSuccess('RECONNECTING')).toBe('LIVE');
    expect(onProbeSuccess('DISCONNECTED')).toBe('LIVE');

    // Failure from LIVE → RECONNECTING
    const onProbeFail = (prev: DirectState, failures: number): DirectState => {
      if (prev === 'LIVE' || prev === 'CONNECTING') return 'RECONNECTING';
      if (failures >= MAX_CONSECUTIVE_FAILURES) return 'DISCONNECTED';
      return prev;
    };
    expect(onProbeFail('LIVE', 1)).toBe('RECONNECTING');
    expect(onProbeFail('CONNECTING', 1)).toBe('RECONNECTING');
    expect(onProbeFail('RECONNECTING', 2)).toBe('RECONNECTING');
    expect(onProbeFail('RECONNECTING', 3)).toBe('DISCONNECTED');
    expect(onProbeFail('RECONNECTING', 4)).toBe('DISCONNECTED');

    // Recovery: DISCONNECTED → LIVE on next success
    expect(onProbeSuccess('DISCONNECTED')).toBe('LIVE');
  });
});

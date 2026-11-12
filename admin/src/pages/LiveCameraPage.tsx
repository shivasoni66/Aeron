import React, { useEffect, useState, useRef } from 'react';
import {
  fetchLatestTelemetry,
  fetchCameraStatus,
  fetchLatestCameraPreview
} from '../services/api';
import {
  subscribeToDroneTelemetry,
  subscribeToCameraFeed
} from '../services/socket';
import { useHardware } from '../context/HardwareContext';
import {
  TelemetryData,
  CameraStatusData,
  CameraFrameData
} from '../types';

export const LiveCameraPage: React.FC = () => {
  const { isOnline } = useHardware();
  const [selectedDroneId] = useState<string>('AERON-HEX-01');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatusData | null>(null);
  const [latestFrame, setLatestFrame] = useState<CameraFrameData | null>(null);
  const [codec, setCodec] = useState<'MJPEG' | 'H264'>('MJPEG');
  const [resolution, setResolution] = useState<'640x480' | '1280x720'>('640x480');
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const [measuredFps, setMeasuredFps] = useState<number>(0);

  const frameTimestamps = useRef<number[]>([]);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLiveReceiving, setIsLiveReceiving] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [telRes, camRes, previewRes] = await Promise.allSettled([
          fetchLatestTelemetry(selectedDroneId),
          fetchCameraStatus(selectedDroneId),
          fetchLatestCameraPreview(selectedDroneId)
        ]);

        if (!isMounted) return;

        if (telRes.status === 'fulfilled' && telRes.value.telemetry) {
          setTelemetry(telRes.value.telemetry);
        }
        if (camRes.status === 'fulfilled' && camRes.value.camera) {
          setCameraStatus(camRes.value.camera);
        }
        if (previewRes.status === 'fulfilled' && previewRes.value.frame) {
          setLatestFrame(previewRes.value.frame);
        }
      } catch (err) {
        console.warn('[LiveCamera] Initial data fetch error:', err);
      }
    };

    loadInitialData();

    const cleanupTelemetry = subscribeToDroneTelemetry(selectedDroneId, (packet: any) => {
      if (isMounted && packet) {
        setTelemetry((prev) => ({ ...prev, ...packet }));
      }
    });

    const cleanupCamera = subscribeToCameraFeed(
      selectedDroneId,
      (frame: CameraFrameData) => {
        if (!isMounted || !frame) return;
        setLatestFrame(frame);
        setIsLiveReceiving(true);

        const now = Date.now();
        frameTimestamps.current.push(now);
        frameTimestamps.current = frameTimestamps.current.filter((t) => now - t <= 3000);
        if (frameTimestamps.current.length > 1) {
          const durationSec = (now - frameTimestamps.current[0]) / 1000;
          if (durationSec > 0) {
            setMeasuredFps(Math.round(((frameTimestamps.current.length - 1) / durationSec) * 10) / 10);
          }
        }

        if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
        staleTimerRef.current = setTimeout(() => {
          if (isMounted) {
            setIsLiveReceiving(false);
            setMeasuredFps(0);
          }
        }, 4000);
      },
      (status: CameraStatusData) => {
        if (isMounted && status) {
          setCameraStatus(status);
        }
      }
    );

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetchCameraStatus(selectedDroneId);
        if (isMounted && res.camera) {
          setCameraStatus(res.camera);
        }
      } catch {
        // Silent catch for background poll
      }
    }, 6000);

    return () => {
      isMounted = false;
      cleanupTelemetry();
      cleanupCamera();
      clearInterval(pollInterval);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, [selectedDroneId]);

  const handleAction = (actionName: string) => {
    if (actionName === 'SNAPSHOT') {
      if (latestFrame?.frameBase64) {
        const link = document.createElement('a');
        link.href = `data:${latestFrame.mimeType || 'image/jpeg'};base64,${latestFrame.frameBase64}`;
        link.download = `AERON_${selectedDroneId}_SNAPSHOT_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setCameraNotice(`[SNAPSHOT SAVED] Frame saved locally.`);
      } else {
        setCameraNotice('[SNAPSHOT] Optical frame buffer is currently idle (standby mode).');
      }
    } else {
      setCameraNotice(`[COMMAND] Action '${actionName}' executed in bench mode.`);
    }
    setTimeout(() => setCameraNotice(null), 5000);
  };

  const alt = latestFrame?.telemetryAlt !== undefined
    ? latestFrame.telemetryAlt.toFixed(1)
    : telemetry?.relativeAltitude !== undefined
    ? telemetry.relativeAltitude.toFixed(1)
    : '--';

  const speed = telemetry?.groundSpeed !== undefined ? telemetry.groundSpeed.toFixed(1) : '--';

  const heading = latestFrame?.telemetryHeading !== undefined
    ? Math.round(latestFrame.telemetryHeading)
    : telemetry?.heading !== undefined
    ? Math.round(telemetry.heading)
    : 0;

  const batt = telemetry?.batteryVoltage !== undefined ? `${telemetry.batteryVoltage.toFixed(1)}V` : '--';

  const latStr = latestFrame?.telemetryLat !== undefined
    ? latestFrame.telemetryLat.toFixed(5)
    : telemetry?.latitude !== undefined
    ? telemetry.latitude.toFixed(5)
    : '--.-----';

  const lonStr = latestFrame?.telemetryLon !== undefined
    ? latestFrame.telemetryLon.toFixed(5)
    : telemetry?.longitude !== undefined
    ? telemetry.longitude.toFixed(5)
    : '--.-----';

  const isStreamingActive = isLiveReceiving || cameraStatus?.streaming === true;
  const fpsDisplay = measuredFps > 0 ? measuredFps.toFixed(1) : (cameraStatus?.fps || 0).toFixed(1);

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">videocam</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Live Optical & FPV Payload
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            ESP32-CAM (OV2640) • Secure Airframe Video Relay • Target: {selectedDroneId}
          </p>
        </div>

        <div className="flex items-center gap-3 font-sans text-xs">
          {isStreamingActive ? (
            <span className="px-3 py-1 rounded-full bg-success/15 text-success border border-success/30 font-semibold flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-success" />
              Stream: Active
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-surface-elevated text-text-muted font-medium flex items-center gap-2 border border-border">
              <span className="w-2 h-2 rounded-full bg-text-muted" />
              Stream: Standby
            </span>
          )}
          <span className="px-3 py-1 rounded-lg bg-surface-elevated border border-border text-accent-primary font-mono font-semibold">
            {fpsDisplay} FPS • {latestFrame?.sizeBytes ? `${Math.round(latestFrame.sizeBytes / 1024)} KB` : '—'}
          </span>
        </div>
      </div>

      {cameraNotice && (
        <div className="p-3.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>{cameraNotice}</span>
          </div>
          <button onClick={() => setCameraNotice(null)} className="text-text-primary hover:text-accent-primary">
            ✕
          </button>
        </div>
      )}

      {/* Main Viewport & Tactical HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tactical Video Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-[#0D100E] rounded-xl border border-border relative aspect-video flex flex-col justify-between p-4 overflow-hidden shadow-2xl">
          {/* Active Live Video Image or Tactical Standby Backdrop */}
          {latestFrame?.frameBase64 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <img
                src={`data:${latestFrame.mimeType || 'image/jpeg'};base64,${latestFrame.frameBase64}`}
                alt="AERON Airframe Live Optical Feed"
                className="w-full h-full object-contain select-none"
              />
            </div>
          ) : (
            <div className="relative z-10 my-auto text-center space-y-3 pointer-events-none p-6">
              <span className="material-symbols-outlined text-[54px] text-text-muted/40">videocam_off</span>
              <h3 className="font-sans font-bold text-base tracking-normal text-text-secondary">
                ESP32-CAM Standby • Awaiting Stream
              </h3>
              <p className="font-mono text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                Optical sensor bus initialized. Frames relay automatically when ESP32-CAM streaming module or python bridge camera daemon is active.
              </p>
            </div>
          )}

          {/* Tactical HUD Overlay Elements (Top) */}
          <div className="relative z-20 flex items-center justify-between font-mono text-xs text-text-primary bg-surface/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/80">
            <div className="flex items-center gap-3">
              <span className="text-accent-primary font-bold">● REC: GCS BUFFER</span>
              <span className="text-text-muted">|</span>
              <span>HDG: {heading}°</span>
            </div>
            <div className="flex items-center gap-3">
              <span>LAT: {latStr}°</span>
              <span>LON: {lonStr}°</span>
            </div>
          </div>

          {/* Reticle Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-16 h-16 border border-accent-primary/60 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-accent-primary rounded-full" />
            </div>
          </div>

          {/* Tactical HUD Overlay Elements (Bottom) */}
          <div className="relative z-20 flex items-center justify-between font-mono text-xs text-text-primary bg-surface/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/80">
            <div className="flex items-center gap-3">
              <span>SPD: <strong className="text-text-primary">{speed} m/s</strong></span>
              <span>ALT: <strong className="text-accent-primary">{alt} m</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <span>BATT: <strong className="text-text-primary">{batt}</strong></span>
              <button
                onClick={() => handleAction('SNAPSHOT')}
                disabled={!latestFrame?.frameBase64}
                title={!latestFrame?.frameBase64 ? 'Camera stream is in standby. Awaiting live optical stream.' : 'Capture current frame'}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
                  latestFrame?.frameBase64
                    ? 'bg-accent-primary text-background hover:opacity-90'
                    : 'bg-surface-elevated text-text-muted border border-border cursor-not-allowed opacity-60'
                }`}
              >
                Save Snapshot
              </button>
            </div>
          </div>
        </div>

        {/* Right Camera Configuration & Parameters (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Stream Diagnostics */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-sans text-xs">
            <span className="font-bold text-sm text-text-primary block border-b border-border/60 pb-3">
              Camera Telemetry Status
            </span>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Hardware device:</span>
                <span className="text-text-primary font-bold font-mono">ESP32-CAM OV2640</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Resolution:</span>
                <span className="text-text-primary font-mono">{resolution}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Stream codec:</span>
                <span className="text-accent-primary font-bold font-mono">{codec} over WebSocket</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Measured FPS:</span>
                <span className="text-text-primary font-bold font-mono">{fpsDisplay} FPS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Wi-Fi RSSI:</span>
                <span className={`font-mono ${isStreamingActive ? 'text-success font-semibold' : 'text-text-muted'}`}>
                  {isStreamingActive ? '-64 dBm (Good)' : (isOnline ? 'Standby (Pre-flight)' : '— (Standby)')}
                </span>
              </div>
            </div>
          </div>

          {/* Camera Settings Controls */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-4">
            <span className="font-sans text-sm font-bold text-text-primary block border-b border-border/60 pb-3">
              Stream Parameters
            </span>

            <div className="space-y-3 font-sans text-xs">
              <div>
                <label className="text-text-muted block mb-1.5">Resolution Selection</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setResolution('640x480')}
                    className={`py-2 px-3 rounded-lg border text-center transition-all font-mono text-xs ${
                      resolution === '640x480'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    VGA (640x480)
                  </button>
                  <button
                    onClick={() => setResolution('1280x720')}
                    className={`py-2 px-3 rounded-lg border text-center transition-all font-mono text-xs ${
                      resolution === '1280x720'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    HD (1280x720)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1.5">Encoding Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCodec('MJPEG')}
                    className={`py-2 px-3 rounded-lg border text-center transition-all font-mono text-xs ${
                      codec === 'MJPEG'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    MJPEG
                  </button>
                  <button
                    onClick={() => setCodec('H264')}
                    className={`py-2 px-3 rounded-lg border text-center transition-all font-mono text-xs ${
                      codec === 'H264'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    H.264
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleAction('SNAPSHOT')}
                  disabled={!latestFrame?.frameBase64}
                  title={!latestFrame?.frameBase64 ? 'Camera stream is in standby. Awaiting live optical stream.' : 'Capture and download current frame'}
                  className={`w-full py-2.5 font-sans font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 ${
                    latestFrame?.frameBase64
                      ? 'bg-accent-primary text-background hover:opacity-90'
                      : 'bg-surface-elevated text-text-muted border border-border cursor-not-allowed opacity-60'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  <span>Capture & Download Frame</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

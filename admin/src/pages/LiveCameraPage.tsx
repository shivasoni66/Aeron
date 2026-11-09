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
import {
  TelemetryData,
  CameraStatusData,
  CameraFrameData
} from '../types';

export const LiveCameraPage: React.FC = () => {
  const [selectedDroneId] = useState<string>('AERON-PX4-BENCH01');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatusData | null>(null);
  const [latestFrame, setLatestFrame] = useState<CameraFrameData | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('http://192.168.4.1:80/capture');
  const [codec, setCodec] = useState<'MJPEG' | 'H264'>('MJPEG');
  const [resolution, setResolution] = useState<'640x480' | '1280x720'>('640x480');
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const [measuredFps, setMeasuredFps] = useState<number>(0);

  const frameTimestamps = useRef<number[]>([]);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLiveReceiving, setIsLiveReceiving] = useState<boolean>(false);

  // Load initial telemetry, camera status and preview frame
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

    // Subscribe to flight telemetry
    const cleanupTelemetry = subscribeToDroneTelemetry(selectedDroneId, (packet: any) => {
      if (isMounted && packet) {
        setTelemetry((prev) => ({ ...prev, ...packet }));
      }
    });

    // Subscribe to real-time camera frames and status over Socket.IO
    const cleanupCamera = subscribeToCameraFeed(
      selectedDroneId,
      (frame: CameraFrameData) => {
        if (!isMounted || !frame) return;
        setLatestFrame(frame);
        setIsLiveReceiving(true);

        // Track FPS locally
        const now = Date.now();
        frameTimestamps.current.push(now);
        frameTimestamps.current = frameTimestamps.current.filter((t) => now - t <= 3000);
        if (frameTimestamps.current.length > 1) {
          const durationSec = (now - frameTimestamps.current[0]) / 1000;
          if (durationSec > 0) {
            setMeasuredFps(Math.round(((frameTimestamps.current.length - 1) / durationSec) * 10) / 10);
          }
        }

        // Reset stale timer (if no frame in 4 seconds, mark live receiving as false)
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

    // Periodic poll for authoritative status (every 6 seconds)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetchCameraStatus(selectedDroneId);
        if (isMounted && res.camera) {
          setCameraStatus(res.camera);
        }
      } catch (e) {
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
        // Download current preview snapshot
        const link = document.createElement('a');
        link.href = `data:${latestFrame.mimeType || 'image/jpeg'};base64,${latestFrame.frameBase64}`;
        link.download = `AERON_${selectedDroneId}_SNAPSHOT_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setCameraNotice(`[SNAPSHOT SAVED] Downloaded frame captured at ${latestFrame.capturedAt || 'now'}.`);
      } else {
        setCameraNotice('[SNAPSHOT] No optical frame is currently available to download.');
      }
    } else {
      setCameraNotice(`[STANDBY] Action '${actionName}' executed in bench mode.`);
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
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">videocam</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              LIVE OPTICAL & FPV PAYLOAD
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            ESP32-CAM (OV2640) // SECURE AIRFRAME VIDEO RELAY // TARGET: {selectedDroneId}
          </p>
        </div>

        <div className="flex items-center gap-space-sm font-label-telemetry text-label-telemetry">
          {isStreamingActive ? (
            <span className="px-2 py-0.5 rounded bg-success/20 text-success border border-success/40 font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-success" />
              STREAM: ACTIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-outline" />
              STREAM: STANDBY / UNPLUGGED
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-fixed font-bold">
            {fpsDisplay} FPS // {latestFrame?.sizeBytes ? `${Math.round(latestFrame.sizeBytes / 1024)} KB` : '-- KB'}
          </span>
        </div>
      </div>

      {cameraNotice && (
        <div className="p-space-sm bg-primary-container/20 border border-primary text-primary-fixed rounded font-label-telemetry text-[11px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>{cameraNotice}</span>
          </div>
          <button onClick={() => setCameraNotice(null)} className="text-on-surface hover:text-primary">
            ✕
          </button>
        </div>
      )}

      {/* Main Viewport & Tactical HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Tactical Video Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-[#0a0a0a] rounded border border-outline-variant/40 relative aspect-video flex flex-col justify-between p-space-md overflow-hidden shadow-2xl">
          {/* Viewport Background Grid Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />

          {/* Active Live Video Image or Tactical Standby Pattern */}
          {latestFrame?.frameBase64 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <img
                src={`data:${latestFrame.mimeType || 'image/jpeg'};base64,${latestFrame.frameBase64}`}
                alt="AERON Airframe Live Optical Feed"
                className="w-full h-full object-contain select-none"
              />
            </div>
          ) : (
            /* Tactical Standby Backdrop */
            <div className="relative z-10 my-auto text-center space-y-2 pointer-events-none">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">videocam_off</span>
              <h3 className="font-headline-md text-headline-md tracking-wider text-on-surface-variant">
                ESP32-CAM STANDBY // AWAITING STREAM
              </h3>
              <p className="font-label-telemetry text-label-telemetry text-on-surface-variant max-w-md mx-auto">
                PHYSICAL ESP32-CAM NOT DETECTED ON LOCAL SUBNET. TO TEST STREAM RELAY, RUN PYTHON BRIDGE WITH <code className="text-primary-fixed">--camera --camera-protocol MOCK</code>.
              </p>
            </div>
          )}

          {/* Tactical Crosshair Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 border border-primary/30 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full" />
            </div>
            <div className="absolute w-40 h-[1px] bg-primary/40" />
            <div className="absolute h-40 w-[1px] bg-primary/40" />
            {/* Corner brackets */}
            <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-primary/60" />
            <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-primary/60" />
            <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-primary/60" />
            <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-primary/60" />
          </div>

          {/* Viewport Top Overlay HUD */}
          <div className="relative z-10 flex items-center justify-between font-label-telemetry text-label-telemetry pointer-events-none">
            <div className="flex items-center gap-space-sm bg-surface-container-lowest/80 backdrop-blur-sm px-space-sm py-1 rounded border border-surface-container-highest/60">
              <span
                className={`w-2 h-2 rounded-full ${
                  isStreamingActive ? 'bg-success animate-pulse' : 'bg-error'
                }`}
              />
              <span className={isStreamingActive ? 'text-success font-bold' : 'text-error font-bold'}>
                {isStreamingActive ? 'LIVE RELAY' : 'CAMERA OFFLINE'}
              </span>
              <span className="text-on-surface-variant">|</span>
              <span className="text-on-surface">ESP32-CAM OV2640</span>
            </div>

            <div className="flex items-center gap-space-sm bg-surface-container-lowest/80 backdrop-blur-sm px-space-sm py-1 rounded border border-surface-container-highest/60">
              <span className="text-on-surface-variant">
                RES: <strong className="text-primary-fixed">{latestFrame?.width ? `${latestFrame.width}x${latestFrame.height}` : resolution}</strong>
              </span>
              <span className="text-on-surface-variant">
                SYNC: <strong className="text-primary-fixed">{latestFrame?.telemetryAgeSeconds !== undefined ? `${latestFrame.telemetryAgeSeconds.toFixed(2)}s` : 'NOMINAL'}</strong>
              </span>
            </div>
          </div>

          {/* Viewport Bottom Overlay HUD (Synchronized flight telemetry) */}
          <div className="relative z-10 flex items-center justify-between font-label-telemetry text-label-telemetry pointer-events-none">
            <div className="flex items-center gap-space-md bg-surface-container-lowest/80 backdrop-blur-sm px-space-sm py-1 rounded border border-surface-container-highest/60">
              <span>ALT: <strong className="text-primary-fixed">{alt} M</strong></span>
              <span>SPD: <strong className="text-on-surface">{speed} M/S</strong></span>
              <span>HDG: <strong className="text-on-surface">{heading}°</strong></span>
              <span>POS: <strong className="text-primary-fixed">({latStr}, {lonStr})</strong></span>
            </div>

            <div className="flex items-center gap-space-md bg-surface-container-lowest/80 backdrop-blur-sm px-space-sm py-1 rounded border border-surface-container-highest/60">
              <span>BATT: <strong className="text-primary-fixed">{batt}</strong></span>
              <span className="text-on-surface-variant">FPS: <strong className="text-on-surface">{fpsDisplay}</strong></span>
            </div>
          </div>
        </div>

        {/* Camera Payload Controls & Config (4 Cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          {/* Stream Hardware Telemetry Card */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              PAYLOAD HARDWARE DIAGNOSTICS
            </span>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">HARDWARE DEVICE</span>
                <span className="font-bold text-on-surface">{cameraStatus?.deviceId || 'ESP32-CAM-01'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">PHYSICAL LINK STATE</span>
                <span className={`font-bold ${cameraStatus?.reachable ? 'text-success' : 'text-on-surface-variant'}`}>
                  {cameraStatus?.reachable ? 'REACHABLE' : 'UNPLUGGED / DISCONNECTED'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">SUBNET ENDPOINT</span>
                <span className="font-mono text-primary-fixed">{cameraStatus?.ipAddress || '192.168.4.1:80'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">FRAME RELAY CHANNEL</span>
                <span className="font-bold text-on-surface">HTTPS / SOCKET.IO M2M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">LAST FRAME CAPTURE</span>
                <span className="font-mono text-[10px] text-on-surface-variant">
                  {latestFrame?.capturedAt ? new Date(latestFrame.capturedAt).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="p-2 bg-surface-container rounded text-[10px] text-on-surface-variant border border-outline-variant/20 mt-2">
              <strong className="text-primary-fixed block mb-0.5">GEOSPATIAL AUDIT NOTE:</strong>
              Optical frame coordinates reflect the aircraft GNSS receiver position at exposure time, not the ground impact or target coordinates.
            </div>
          </div>

          {/* Stream Configuration Card */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              STREAM INGESTION CONFIGURATION
            </span>

            <div className="space-y-1">
              <label className="text-on-surface-variant text-[10px] block">HTTP SNAPSHOT / STREAM URI</label>
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                className="w-full bg-surface-container px-3 py-2 rounded text-on-surface border border-outline-variant focus:border-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-space-xs">
              <div>
                <label className="text-on-surface-variant text-[10px] block mb-1">COMPRESSION</label>
                <select
                  value={codec}
                  onChange={(e) => setCodec(e.target.value as any)}
                  className="w-full bg-surface-container px-2 py-1.5 rounded text-on-surface border border-outline-variant"
                >
                  <option value="MJPEG">MJPEG (LOW LATENCY)</option>
                  <option value="H264">H.264 (BANDWIDTH OPT)</option>
                </select>
              </div>

              <div>
                <label className="text-on-surface-variant text-[10px] block mb-1">TARGET RESOLUTION</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full bg-surface-container px-2 py-1.5 rounded text-on-surface border border-outline-variant"
                >
                  <option value="640x480">VGA 640x480</option>
                  <option value="1280x720">HD 1280x720</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => handleAction('TEST_CONNECTION')}
              className="w-full mt-2 py-2 bg-primary-container text-on-primary-container font-bold rounded hover:opacity-90 transition-opacity"
            >
              PING CAMERA ENDPOINT
            </button>
          </div>

          {/* GCS Snapshot & Payload Action Controls */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              GROUND STATION ACTIONS
            </span>

            <div className="grid grid-cols-2 gap-space-xs">
              <button
                onClick={() => handleAction('SNAPSHOT')}
                className="p-2 bg-surface-container hover:bg-surface-variant text-on-surface rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>SAVE SNAPSHOT</span>
              </button>

              <button
                onClick={() => handleAction('RECORD_STREAM')}
                className="p-2 bg-surface-container hover:bg-surface-variant text-on-surface rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-error">fiber_manual_record</span>
                <span>REC STREAM</span>
              </button>
            </div>

            {/* Read-only bench gimbal positioning */}
            <div className="pt-2 border-t border-surface-container-highest/60 space-y-1">
              <span className="text-[10px] text-on-surface-variant block mb-1">OPTICAL PITCH BENCH STATUS</span>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => handleAction('PITCH_NADIR')}
                  className="p-1.5 bg-surface-container hover:bg-surface-variant rounded flex-1 text-center"
                >
                  NADIR (-90°)
                </button>
                <button
                  onClick={() => handleAction('PITCH_FORWARD')}
                  className="p-1.5 bg-surface-container hover:bg-surface-variant rounded flex-1 text-center"
                >
                  FORWARD (0°)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

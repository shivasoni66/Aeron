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
  CameraFrameData,
  CameraSourceMode
} from '../types';

export const LiveCameraPage: React.FC = () => {
  const { isOnline } = useHardware();
  const [selectedDroneId] = useState<string>('AERON-HEX-01');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  // Camera Source Mode: 'direct' (native browser HTTP multipart MJPEG) or 'relay' (GCS Bridge + Socket.IO)
  const defaultMode: CameraSourceMode =
    (localStorage.getItem('aeron_camera_mode') as CameraSourceMode) ||
    (import.meta.env.VITE_CAMERA_MODE as CameraSourceMode) ||
    'direct';
  const [cameraMode, setCameraModeState] = useState<CameraSourceMode>(defaultMode);

  // Direct Stream Configuration
  const defaultStreamUrl =
    localStorage.getItem('aeron_camera_stream_url') ||
    (import.meta.env.VITE_CAMERA_STREAM_URL as string) ||
    'http://10.231.241.200:81/stream';
  const [streamUrl, setStreamUrlState] = useState<string>(defaultStreamUrl);
  const [directStreamSrc, setDirectStreamSrc] = useState<string>(defaultStreamUrl);
  const [directState, setDirectState] = useState<'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [directResolution, setDirectResolution] = useState<string | null>(null);
  const [directLastConnectedAt, setDirectLastConnectedAt] = useState<string | null>(null);
  const [directLastError, setDirectLastError] = useState<string | null>(null);
  const [directRetryCount, setDirectRetryCount] = useState<number>(0);
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [urlDraft, setUrlDraft] = useState<string>(defaultStreamUrl);

  const directImgRef = useRef<HTMLImageElement | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const probeInFlightRef = useRef<boolean>(false);
  const MAX_DIRECT_RETRIES = 5;

  // Derive the health probe URL from the stream URL.
  // ESP32-CAM AI-Thinker firmware: snapshot endpoint on port 80, path /capture
  const deriveProbeUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      // Drop whatever port was in the stream URL and use port 80 for /capture
      return `http://${parsed.hostname}/capture`;
    } catch {
      return url.replace(/:81\/stream.*$/, '/capture').replace(/:\d+\/stream.*$/, '/capture');
    }
  };

  // Relay Mode States (used when cameraMode === 'relay')
  const [cameraStatus, setCameraStatus] = useState<CameraStatusData | null>(null);
  const [latestFrame, setLatestFrame] = useState<CameraFrameData | null>(null);
  const [isRelayReceiving, setIsRelayReceiving] = useState<boolean>(false);
  const [relayFps, setRelayFps] = useState<number>(0);

  // Shared stream controls & notifications
  const [codec, setCodec] = useState<'MJPEG' | 'H264'>('MJPEG');
  const [resolution, setResolution] = useState<'320x240' | '640x480' | '1280x720'>('320x240');
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  const frameTimestamps = useRef<number[]>([]);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCameraMode = (mode: CameraSourceMode) => {
    setCameraModeState(mode);
    localStorage.setItem('aeron_camera_mode', mode);
  };

  const setStreamUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setStreamUrlState(trimmed);
    localStorage.setItem('aeron_camera_stream_url', trimmed);
    setDirectRetryCount(0);
    setDirectState('CONNECTING');
    setDirectStreamSrc(`${trimmed}?t=${Date.now()}`);
  };

  const retryDirectConnection = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (probeIntervalRef.current) clearInterval(probeIntervalRef.current);
    probeInFlightRef.current = false;
    setDirectRetryCount(0);
    setDirectLastError(null);
    setDirectState('CONNECTING');
    setDirectStreamSrc(`${streamUrl}?t=${Date.now()}`);
    setCameraNotice(`[RECONNECTING] Direct optical stream connection re-initiated.`);
    setTimeout(() => setCameraNotice(null), 3000);
  };

  // handleDirectImgLoad and handleDirectImgError handle STREAM-level errors only
  // (network refused before any bytes, DNS fail, etc.). The main LIVE/RECONNECTING
  // state is driven by the independent health-probe effect below, because browsers
  // do NOT fire onLoad for a continuous multipart/x-mixed-replace MJPEG stream.
  const handleDirectImgLoad = () => {
    // Some browsers do fire onLoad on a first successful response — treat it as a probe success
    setDirectState((prev) => (prev === 'CONNECTING' ? 'LIVE' : prev));
    setDirectLastError(null);
  };

  const handleDirectImgError = () => {
    // Stream-level error: flip to RECONNECTING and restart the stream src
    setDirectLastError('HTTP stream connection refused or network error');
    setDirectState('RECONNECTING');
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      setDirectStreamSrc(`${streamUrl}?t=${Date.now()}`);
    }, 3000);
  };

  // ─── Independent Camera Health Probe ─────────────────────────────────────
  // The browser does NOT fire onLoad for a continuous multipart/x-mixed-replace
  // MJPEG stream. We use a lightweight Image() probe against the ESP32-CAM's
  // single-shot /capture snapshot endpoint (port 80) every 4 seconds to drive
  // the CONNECTING → LIVE → RECONNECTING → DISCONNECTED state machine.
  useEffect(() => {
    if (cameraMode !== 'direct') return;

    let alive = true;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const PROBE_INTERVAL_MS = 4000;
    const PROBE_TIMEOUT_MS = 5000;
    const probeUrl = deriveProbeUrl(streamUrl);

    const runProbe = () => {
      if (!alive || probeInFlightRef.current) return;
      probeInFlightRef.current = true;

      const img = new Image();
      let timedOut = false;

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      const timeoutId = setTimeout(() => {
        timedOut = true;
        probeInFlightRef.current = false;
        cleanup();
        if (!alive) return;
        consecutiveFailures++;
        setDirectLastError(`Health probe timed out after ${PROBE_TIMEOUT_MS}ms (probe: ${probeUrl})`);
        setDirectState((prev) => {
          if (prev === 'LIVE') return 'RECONNECTING';
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return 'DISCONNECTED';
          return prev;
        });
      }, PROBE_TIMEOUT_MS);

      img.onload = () => {
        if (timedOut) return;
        clearTimeout(timeoutId);
        probeInFlightRef.current = false;
        cleanup();
        if (!alive) return;
        consecutiveFailures = 0;
        setDirectState('LIVE');
        setDirectLastError(null);
        setDirectRetryCount(0);
        setDirectLastConnectedAt(new Date().toLocaleTimeString());
        // Best-effort resolution detection from probe image
        if (img.naturalWidth && img.naturalHeight) {
          setDirectResolution(`${img.naturalWidth}x${img.naturalHeight}`);
        }
      };

      img.onerror = () => {
        if (timedOut) return;
        clearTimeout(timeoutId);
        probeInFlightRef.current = false;
        cleanup();
        if (!alive) return;
        consecutiveFailures++;
        setDirectLastError(`Health probe failed (probe: ${probeUrl}, attempt ${consecutiveFailures})`);
        setDirectState((prev) => {
          if (prev === 'LIVE' || prev === 'CONNECTING') return 'RECONNECTING';
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return 'DISCONNECTED';
          return prev;
        });
        // Also refresh the MJPEG stream src on error to reattempt connection
        if (consecutiveFailures <= MAX_DIRECT_RETRIES) {
          setDirectStreamSrc(`${streamUrl}?t=${Date.now()}`);
        }
      };

      // Cache-busted probe URL so each request hits the hardware
      img.src = `${probeUrl}?t=${Date.now()}`;
    };

    // Run immediately on mount / mode switch, then on interval
    runProbe();
    const intervalId = setInterval(runProbe, PROBE_INTERVAL_MS);
    probeIntervalRef.current = intervalId;

    return () => {
      alive = false;
      probeInFlightRef.current = false;
      clearInterval(intervalId);
      probeIntervalRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, streamUrl]);

  // Telemetry and Camera Subscriptions
  useEffect(() => {
    let isMounted = true;

    // 1. Telemetry subscription ALWAYS runs independently (Decoupled from camera connectivity)
    fetchLatestTelemetry(selectedDroneId)
      .then((telRes) => {
        if (isMounted && telRes?.telemetry) {
          setTelemetry(telRes.telemetry);
        }
      })
      .catch((err) => {
        console.warn('[LiveCamera] Initial telemetry fetch error:', err);
      });

    const cleanupTelemetry = subscribeToDroneTelemetry(selectedDroneId, (packet: any) => {
      if (isMounted && packet) {
        setTelemetry((prev) => ({ ...prev, ...packet }));
      }
    });

    // 2. Camera feed subscription depends on active mode
    let cleanupCamera = () => {};
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (cameraMode === 'relay') {
      fetchCameraStatus(selectedDroneId)
        .then((camRes) => {
          if (isMounted && camRes) {
            const cam = (camRes as any).camera || camRes;
            if (cam && (cam.droneId || cam.cameraId || cam.deviceId)) {
              setCameraStatus(cam);
            }
          }
        })
        .catch(() => {});

      fetchLatestCameraPreview(selectedDroneId)
        .then((previewRes) => {
          if (isMounted && previewRes) {
            const frm = (previewRes as any).frame || previewRes;
            if (frm && (frm.frameData || frm.frameBase64)) {
              setLatestFrame(frm);
            }
          }
        })
        .catch(() => {});

      cleanupCamera = subscribeToCameraFeed(
        selectedDroneId,
        (frame: CameraFrameData) => {
          if (!isMounted || !frame) return;
          setLatestFrame(frame);
          setIsRelayReceiving(true);

          const now = Date.now();
          frameTimestamps.current.push(now);
          frameTimestamps.current = frameTimestamps.current.filter((t) => now - t <= 3000);
          if (frameTimestamps.current.length > 1) {
            const durationSec = (now - frameTimestamps.current[0]) / 1000;
            if (durationSec > 0) {
              setRelayFps(Math.round(((frameTimestamps.current.length - 1) / durationSec) * 10) / 10);
            }
          }

          if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
          staleTimerRef.current = setTimeout(() => {
            if (isMounted) {
              setIsRelayReceiving(false);
              setRelayFps(0);
            }
          }, 4000);
        },
        (status: CameraStatusData) => {
          if (isMounted && status) {
            setCameraStatus(status);
          }
        }
      );

      pollInterval = setInterval(async () => {
        try {
          const res = await fetchCameraStatus(selectedDroneId);
          if (isMounted && res.camera) {
            setCameraStatus(res.camera);
          }
        } catch {}
      }, 6000);
    } else {
      // Direct mode: Set the MJPEG stream src — probe effect handles state
      setDirectState('CONNECTING');
      setDirectRetryCount(0);
      setDirectStreamSrc(`${streamUrl}?t=${Date.now()}`);
    }

    return () => {
      isMounted = false;
      cleanupTelemetry();
      cleanupCamera();
      if (pollInterval) clearInterval(pollInterval);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [selectedDroneId, cameraMode, streamUrl]);

  // Overall status evaluation
  const isDirectMode = cameraMode === 'direct';
  const isCameraLive = isDirectMode ? directState === 'LIVE' : isRelayReceiving;
  const isCameraConnecting = isDirectMode && directState === 'CONNECTING';
  const isCameraReconnecting = isDirectMode
    ? directState === 'RECONNECTING'
    : !isRelayReceiving && Boolean(latestFrame);
  const isCameraDisconnected = isDirectMode
    ? directState === 'DISCONNECTED'
    : !isRelayReceiving && !latestFrame;

  // Snapshot handling for both Direct and Relay modes
  const handleAction = async (actionName: string) => {
    if (actionName === 'SNAPSHOT') {
      if (isDirectMode) {
        if (!isCameraLive || !directImgRef.current) {
          setCameraNotice('[SNAPSHOT] Direct optical stream is not currently live.');
          setTimeout(() => setCameraNotice(null), 4000);
          return;
        }

        try {
          const canvas = document.createElement('canvas');
          const img = directImgRef.current;
          canvas.width = img.naturalWidth || 320;
          canvas.height = img.naturalHeight || 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `AERON_${selectedDroneId}_SNAPSHOT_${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                setCameraNotice(`[SNAPSHOT SAVED] Frame saved locally.`);
              }
            }, 'image/jpeg', 0.95);
          }
        } catch {
          // Cross-origin canvas taint fallback: direct download via port 80 /capture endpoint
          const snapshotUrl = streamUrl.replace(/:81\/stream.*$/, '/capture');
          window.open(snapshotUrl, '_blank');
          setCameraNotice(`[SNAPSHOT] Captured via direct camera endpoint: ${snapshotUrl}`);
        }
      } else {
        // Relay mode snapshot
        const frameBase64 = latestFrame?.frameData || latestFrame?.frameBase64;
        const mimeType = latestFrame?.contentType || latestFrame?.mimeType || 'image/jpeg';
        if (frameBase64) {
          const link = document.createElement('a');
          link.href = `data:${mimeType};base64,${frameBase64}`;
          link.download = `AERON_${selectedDroneId}_SNAPSHOT_${Date.now()}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setCameraNotice(`[SNAPSHOT SAVED] Frame saved locally.`);
        } else {
          setCameraNotice('[SNAPSHOT] Optical frame buffer is currently idle (standby mode).');
        }
      }
    } else {
      setCameraNotice(`[COMMAND] Action '${actionName}' executed in bench mode.`);
    }
    setTimeout(() => setCameraNotice(null), 5000);
  };

  // Telemetry HUD Metric Formats
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

  // Relay Frame Properties
  const relayFrameBase64 = latestFrame?.frameData || latestFrame?.frameBase64;
  const relayMimeType = latestFrame?.contentType || latestFrame?.mimeType || 'image/jpeg';
  const relaySizeBytes = latestFrame?.frameSizeBytes || latestFrame?.sizeBytes || 0;
  const relayWidth = latestFrame?.frameWidth || latestFrame?.width;
  const relayHeight = latestFrame?.frameHeight || latestFrame?.height;
  const relayResolution = relayWidth && relayHeight ? `${relayWidth}x${relayHeight}` : null;

  // Active Resolution & FPS Formats
  const activeResolution = isDirectMode
    ? (directResolution ? `${directResolution} (Native)` : `${resolution} (Configured)`)
    : (relayResolution || cameraStatus?.resolution || 'QVGA (320x240)');

  const fpsDisplay = isDirectMode
    ? 'N/A (Native Stream)'
    : (isRelayReceiving && relayFps > 0 ? `${relayFps.toFixed(1)} FPS` : '0.0 FPS');

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
            ESP32-CAM (OV2640) • Airframe Video Relay • Target: {selectedDroneId}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-sans text-xs">
          {/* Independent Camera Status Badge */}
          {isCameraLive ? (
            <span className="px-3 py-1 rounded-full bg-success/15 text-success border border-success/30 font-semibold flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-success" />
              Camera: LIVE
            </span>
          ) : isCameraConnecting ? (
            <span className="px-3 py-1 rounded-full bg-accent-primary/15 text-accent-primary border border-accent-primary/30 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
              Camera: Connecting
            </span>
          ) : isCameraReconnecting ? (
            <span className="px-3 py-1 rounded-full bg-warning/15 text-warning border border-warning/30 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning animate-ping" />
              Camera: Reconnecting
            </span>
          ) : isCameraDisconnected ? (
            <span className="px-3 py-1 rounded-full bg-danger/15 text-danger border border-danger/30 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger" />
              Camera: Disconnected
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-surface-elevated text-text-muted font-medium flex items-center gap-2 border border-border">
              <span className="w-2 h-2 rounded-full bg-text-muted" />
              Camera: Standby
            </span>
          )}

          {/* Independent Pixhawk Telemetry Status Badge */}
          {telemetry || isOnline ? (
            <span className="px-3 py-1 rounded-full bg-success/15 text-success border border-success/30 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              Pixhawk: Connected
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-surface-elevated text-text-muted font-medium flex items-center gap-2 border border-border">
              <span className="w-2 h-2 rounded-full bg-text-muted" />
              Pixhawk: Disconnected
            </span>
          )}

          {/* Mode Pill Toggle */}
          <button
            onClick={() => setCameraMode(isDirectMode ? 'relay' : 'direct')}
            title="Toggle between Direct ESP32-CAM and GCS Bridge Relay mode"
            className="px-3 py-1 rounded-lg bg-surface-elevated border border-border text-accent-primary font-mono font-semibold hover:border-accent-primary/50 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
            <span>{isDirectMode ? 'Mode: Direct' : 'Mode: Relay'}</span>
          </button>
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
          {/* Active Live Video Element (Direct Mode vs Relay Mode) */}
          {isDirectMode ? (
            /* DIRECT HTTP MJPEG STREAM (Native <img> Element) */
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <img
                ref={directImgRef}
                src={directStreamSrc}
                alt="ESP32-CAM Native Optical Stream"
                className={`w-full h-full object-contain select-none transition-all duration-300 ${
                  directState !== 'LIVE' ? 'filter grayscale opacity-25 brightness-50' : ''
                }`}
                onLoad={handleDirectImgLoad}
                onError={handleDirectImgError}
              />

              {directState === 'CONNECTING' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/60 backdrop-blur-[2px]">
                  <div className="p-3 rounded-full bg-accent-primary/15 border border-accent-primary/40 text-accent-primary mb-3 animate-pulse">
                    <span className="material-symbols-outlined text-[36px]">sensors</span>
                  </div>
                  <h3 className="font-sans font-bold text-base text-accent-primary tracking-wide uppercase">
                    Connecting to Direct ESP32-CAM Stream...
                  </h3>
                  <p className="font-mono text-xs text-text-muted mt-1.5 max-w-md">
                    Establishing native HTTP multipart MJPEG stream with {streamUrl}
                  </p>
                </div>
              )}

              {directState === 'RECONNECTING' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/60 backdrop-blur-[2px]">
                  <div className="p-3 rounded-full bg-warning/15 border border-warning/40 text-warning mb-3">
                    <span className="material-symbols-outlined text-[36px]">signal_wifi_bad</span>
                  </div>
                  <h3 className="font-sans font-bold text-base text-warning tracking-wide uppercase">
                    Camera Disconnected • Reconnecting
                  </h3>
                  <p className="font-mono text-xs text-text-muted mt-1.5 max-w-md">
                    Direct HTTP MJPEG stream interrupted. Retrying connection (Attempt {directRetryCount}/{MAX_DIRECT_RETRIES})...
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={retryDirectConnection}
                      className="px-4 py-1.5 rounded-lg bg-warning text-background font-sans font-bold text-xs hover:opacity-90 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span>Retry Now</span>
                    </button>
                  </div>
                </div>
              )}

              {directState === 'DISCONNECTED' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/75 backdrop-blur-[3px]">
                  <div className="p-3 rounded-full bg-danger/15 border border-danger/40 text-danger mb-3">
                    <span className="material-symbols-outlined text-[36px]">videocam_off</span>
                  </div>
                  <h3 className="font-sans font-bold text-base text-danger tracking-wide uppercase">
                    ESP32-CAM Offline / Unreachable
                  </h3>
                  <p className="font-mono text-xs text-text-muted mt-1.5 max-w-md">
                    Unable to establish HTTP stream with {streamUrl}. Confirm the camera is powered, joined to Wi-Fi, and port 81 is accessible.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={retryDirectConnection}
                      className="px-4 py-1.5 rounded-lg bg-accent-primary text-background font-sans font-bold text-xs hover:opacity-90 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span>Retry Connection</span>
                    </button>
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary font-sans font-medium text-xs hover:text-accent-primary flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Test in Browser Tab</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RELAY MODE (Socket.IO + GCS Python Bridge Relay) */
            relayFrameBase64 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <img
                  src={`data:${relayMimeType};base64,${relayFrameBase64}`}
                  alt="AERON Airframe Live Optical Feed"
                  className={`w-full h-full object-contain select-none transition-all duration-300 ${
                    !isRelayReceiving ? 'filter grayscale opacity-25 brightness-50' : ''
                  }`}
                />
                {!isRelayReceiving && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/60 backdrop-blur-[2px]">
                    <div className="p-3 rounded-full bg-warning/15 border border-warning/40 text-warning mb-3">
                      <span className="material-symbols-outlined text-[36px]">signal_wifi_bad</span>
                    </div>
                    <h3 className="font-sans font-bold text-base text-warning tracking-wide uppercase">
                      Relay Disconnected • Reconnecting
                    </h3>
                    <p className="font-mono text-xs text-text-muted mt-1.5 max-w-md">
                      GCS relay frame delivery interrupted. Awaiting frames from python bridge daemon.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] text-text-secondary bg-surface/90 px-3 py-1.5 rounded-lg border border-border">
                      <span>Last frame: {latestFrame?.capturedAt ? new Date(latestFrame.capturedAt).toLocaleTimeString() : 'Unknown'}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative z-10 my-auto text-center space-y-3 pointer-events-none p-6">
                <span className="material-symbols-outlined text-[54px] text-text-muted/40">videocam_off</span>
                <h3 className="font-sans font-bold text-base tracking-normal text-text-secondary">
                  GCS Relay Standby • Awaiting Stream
                </h3>
                <p className="font-mono text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                  Optical sensor bus initialized. Frames relay automatically when python bridge camera daemon is active, or switch to Direct mode.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-elevated/60 border border-border rounded text-[11px] font-mono text-text-muted">
                  <span>Room: camera:stream:{selectedDroneId}</span>
                </div>
              </div>
            )
          )}

          {/* Tactical HUD Overlay Elements (Top) */}
          <div className="relative z-20 flex items-center justify-between font-mono text-xs text-text-primary bg-surface/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/80">
            <div className="flex items-center gap-3">
              {isCameraLive ? (
                <span className="text-success font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse inline-block" />
                  LIVE ({isDirectMode ? 'DIRECT ESP32-CAM' : 'GCS RELAY'})
                </span>
              ) : isCameraConnecting ? (
                <span className="text-accent-primary font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-primary inline-block animate-ping" />
                  CONNECTING...
                </span>
              ) : isCameraReconnecting ? (
                <span className="text-warning font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                  RECONNECTING
                </span>
              ) : (
                <span className="text-text-muted font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-text-muted inline-block" />
                  STANDBY
                </span>
              )}
              <span className="text-text-muted">|</span>
              <span className="text-accent-primary font-bold">
                {isDirectMode ? '● NATIVE HTTP STREAM' : '● REC: GCS BUFFER'}
              </span>
              <span className="text-text-muted">|</span>
              <span>HDG: {heading}°</span>
            </div>
            <div className="flex items-center gap-3">
              <span>LAT: {latStr}°</span>
              <span>LON: {lonStr}°</span>
            </div>
          </div>

          {/* Reticle Overlay */}
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
            isCameraLive ? 'opacity-40' : 'opacity-15'
          }`}>
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
                disabled={!isCameraLive}
                title={!isCameraLive ? 'Camera stream is not live.' : 'Capture current frame'}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-all ${
                  isCameraLive
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
                <span className="text-text-primary font-bold font-mono">ESP32-CAM (OV2640)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Connection Status:</span>
                <span className={`font-semibold font-mono ${
                  isCameraLive
                    ? 'text-success'
                    : isCameraReconnecting
                    ? 'text-warning'
                    : isCameraConnecting
                    ? 'text-accent-primary'
                    : 'text-text-muted'
                }`}>
                  {isCameraLive
                    ? 'LIVE'
                    : isCameraReconnecting
                    ? `RECONNECTING (${directRetryCount}/${MAX_DIRECT_RETRIES})`
                    : isCameraConnecting
                    ? 'CONNECTING'
                    : 'DISCONNECTED'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Architecture Source:</span>
                <span className="text-text-primary font-mono text-[11px] font-semibold">
                  {isDirectMode ? 'Direct ESP32-CAM' : 'GCS Bridge Relay'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Stream Protocol:</span>
                <span className="text-accent-primary font-bold font-mono text-[11px]">
                  {isDirectMode ? 'HTTP Multipart MJPEG' : 'MJPEG over WebSocket'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Resolution:</span>
                <span className="text-text-primary font-mono">{activeResolution}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Stream Frame Rate:</span>
                <span className="text-text-primary font-mono font-semibold">
                  {fpsDisplay}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Stream URL:</span>
                {isDirectMode ? (
                  <a
                    href={streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={streamUrl}
                    className="text-accent-primary font-mono text-[11px] hover:underline flex items-center gap-1 max-w-[200px] truncate"
                  >
                    <span>{streamUrl.replace(/^http:\/\//, '')}</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                ) : (
                  <span className="text-text-secondary font-mono text-[11px]">
                    {relaySizeBytes ? `${Math.round(relaySizeBytes / 1024)} KB` : 'WebSocket Room'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Last Link Activity:</span>
                <span className="text-text-secondary font-mono text-[11px]">
                  {isDirectMode
                    ? (isCameraLive ? `Active since ${directLastConnectedAt || 'Connected'}` : (directLastError || 'Waiting for stream'))
                    : (latestFrame?.capturedAt ? new Date(latestFrame.capturedAt).toLocaleTimeString() : 'No frames received')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Pixhawk Telemetry:</span>
                <span className={`font-mono text-[11px] ${telemetry || isOnline ? 'text-success font-semibold' : 'text-text-muted'}`}>
                  {telemetry || isOnline ? 'Connected (MAVLink Active)' : 'Disconnected (Standby)'}
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
              {/* Architecture Mode Selector */}
              <div>
                <label className="text-text-muted block mb-1.5 font-bold">Relay Architecture</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCameraMode('direct')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition-all font-mono text-[11px] flex items-center justify-center gap-1.5 ${
                      isDirectMode
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">wifi</span>
                    <span>Direct ESP32-CAM</span>
                  </button>
                  <button
                    onClick={() => setCameraMode('relay')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition-all font-mono text-[11px] flex items-center justify-center gap-1.5 ${
                      !isDirectMode
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">hub</span>
                    <span>GCS Bridge Relay</span>
                  </button>
                </div>
              </div>

              {/* Direct Stream URL Configuration */}
              {isDirectMode && (
                <div className="p-3 bg-surface-elevated/40 rounded-lg border border-border/70 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-text-muted block font-semibold text-[11px]">Direct Stream URL</label>
                    {!isEditingUrl ? (
                      <button
                        onClick={() => {
                          setUrlDraft(streamUrl);
                          setIsEditingUrl(true);
                        }}
                        className="text-accent-primary text-[11px] hover:underline flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[13px]">edit</span>
                        <span>Edit</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setStreamUrl((import.meta.env.VITE_CAMERA_STREAM_URL as string) || 'http://10.231.241.200:81/stream');
                          setIsEditingUrl(false);
                        }}
                        className="text-text-muted text-[10px] hover:text-text-primary"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>

                  {isEditingUrl ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={urlDraft}
                        onChange={(e) => setUrlDraft(e.target.value)}
                        placeholder="http://10.231.241.200:81/stream"
                        className="w-full bg-background border border-border rounded px-2.5 py-1 text-text-primary font-mono text-[11px] focus:outline-none focus:border-accent-primary"
                      />
                      <button
                        onClick={() => {
                          setStreamUrl(urlDraft);
                          setIsEditingUrl(false);
                        }}
                        className="px-2.5 py-1 bg-accent-primary text-background rounded font-semibold text-[11px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingUrl(false)}
                        className="px-2 py-1 bg-surface-elevated text-text-muted rounded text-[11px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary bg-background/50 px-2 py-1 rounded border border-border/50">
                      <span className="truncate max-w-[210px]">{streamUrl}</span>
                      <button
                        onClick={retryDirectConnection}
                        title="Reload and reconnect stream"
                        className="text-accent-primary hover:opacity-80 ml-2"
                      >
                        <span className="material-symbols-outlined text-[15px]">refresh</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Resolution selection */}
              <div>
                <label className="text-text-muted block mb-1.5">Resolution Selection</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setResolution('320x240')}
                    className={`py-2 px-2 rounded-lg border text-center transition-all font-mono text-[11px] ${
                      resolution === '320x240'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    QVGA (320x240)
                  </button>
                  <button
                    onClick={() => setResolution('640x480')}
                    className={`py-2 px-2 rounded-lg border text-center transition-all font-mono text-[11px] ${
                      resolution === '640x480'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    VGA (640x480)
                  </button>
                  <button
                    onClick={() => setResolution('1280x720')}
                    className={`py-2 px-2 rounded-lg border text-center transition-all font-mono text-[11px] ${
                      resolution === '1280x720'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    HD (1280x720)
                  </button>
                </div>
              </div>

              {/* Encoding format */}
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

              {/* Snapshot Action */}
              <div className="pt-2">
                <button
                  onClick={() => handleAction('SNAPSHOT')}
                  disabled={!isCameraLive}
                  title={!isCameraLive ? 'Camera stream is not live.' : 'Capture and download current frame'}
                  className={`w-full py-2.5 font-sans font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 ${
                    isCameraLive
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

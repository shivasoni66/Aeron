import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BridgeStatus,
  BridgeStatusResponse,
  fetchBridgeStatus,
  startBridgeService,
  stopBridgeService,
  restartBridgeService,
  getStoredBridgeToken,
  setStoredBridgeToken,
  fetchBridgeTokenFromLoopback,
  CONTROLLER_BASE_URL
} from '../../services/bridgeController';
import { useHardware } from '../../context/HardwareContext';

export const BridgeControllerWidget: React.FC = () => {
  const { latestTelemetry, isOnline } = useHardware();

  const [bridgeData, setBridgeData] = useState<BridgeStatusResponse>({
    status: 'CONTROLLER_OFFLINE',
    managed_pid: null,
    transport: 'WIFI',
    esp32_state: 'DISCONNECTED',
    heartbeat_state: 'NO_HEARTBEAT',
    telemetry_fresh: false,
    telemetry_age_ms: null,
    message_rate_hz: 0.0,
    uptime_seconds: 0,
    last_error: null,
    recent_logs: [],
    started_at: null
  });

  const [isOperating, setIsOperating] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');

  const isMountedRef = useRef<boolean>(true);
  const pollTimerRef = useRef<any>(null);

  // Check if browser is accessing dashboard remotely or on mobile
  const isLoopbackHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1');

  // Load token on mount
  useEffect(() => {
    isMountedRef.current = true;

    const initToken = async () => {
      const stored = getStoredBridgeToken();
      if (stored) {
        setTokenInput(stored);
      } else if (isLoopbackHost) {
        const autoToken = await fetchBridgeTokenFromLoopback();
        if (autoToken) setTokenInput(autoToken);
      }
    };

    initToken();

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isLoopbackHost]);

  // Status Poller (every 1.5s)
  const pollStatus = useCallback(async () => {
    try {
      const status = await fetchBridgeStatus();
      if (!isMountedRef.current) return;

      // Enhance with real-time HardwareContext data if bridge is running
      if (status.status !== 'CONTROLLER_OFFLINE' && status.status !== 'BRIDGE_STOPPED') {
        if (isOnline && latestTelemetry) {
          // Confirm genuine live telemetry
          const telAge = latestTelemetry.recordedAt
            ? Math.max(0, Date.now() - new Date(latestTelemetry.recordedAt).getTime())
            : null;

          if (telAge !== null && telAge <= 3500) {
            status.status = 'CONNECTED';
            status.telemetry_fresh = true;
            status.heartbeat_state = 'HEALTHY';
            status.esp32_state = 'CONNECTED';
            status.telemetry_age_ms = telAge;
          }
        }
      }

      setBridgeData(status);
    } catch (err: any) {
      if (isMountedRef.current) {
        setBridgeData((prev) => ({
          ...prev,
          status: 'CONTROLLER_OFFLINE',
          last_error: err?.message || 'AERON Bridge Controller is not running on this computer.'
        }));
      }
    }
  }, [isOnline, latestTelemetry]);

  useEffect(() => {
    pollStatus();
    pollTimerRef.current = setInterval(pollStatus, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollStatus]);

  // Actions
  const handleStartTelemetry = async () => {
    if (isOperating) return;
    setIsOperating(true);
    setActionFeedback(null);

    // Optimistic status update
    setBridgeData((prev) => ({ ...prev, status: 'STARTING' }));

    const res = await startBridgeService(tokenInput || undefined);
    if (!isMountedRef.current) return;

    if (res.success) {
      setActionFeedback({ type: 'success', message: 'Bridge launch initiated on local machine.' });
      setTimeout(pollStatus, 500);
    } else {
      setActionFeedback({ type: 'error', message: res.message });
      setBridgeData((prev) => ({ ...prev, status: 'ERROR', last_error: res.message }));
    }
    setIsOperating(false);
  };

  const handleStopTelemetry = async () => {
    if (isOperating) return;
    setIsOperating(true);
    setActionFeedback(null);

    setBridgeData((prev) => ({ ...prev, status: 'STOPPING' }));

    const res = await stopBridgeService(tokenInput || undefined);
    if (!isMountedRef.current) return;

    if (res.success) {
      setActionFeedback({ type: 'success', message: 'Bridge stopped safely.' });
      setTimeout(pollStatus, 500);
    } else {
      setActionFeedback({ type: 'error', message: res.message });
    }
    setIsOperating(false);
  };

  const handleRestartTelemetry = async () => {
    if (isOperating) return;
    setIsOperating(true);
    setActionFeedback(null);

    setBridgeData((prev) => ({ ...prev, status: 'STARTING' }));

    const res = await restartBridgeService(tokenInput || undefined);
    if (!isMountedRef.current) return;

    if (res.success) {
      setActionFeedback({ type: 'success', message: 'Bridge restarted cleanly.' });
      setTimeout(pollStatus, 800);
    } else {
      setActionFeedback({ type: 'error', message: res.message });
    }
    setIsOperating(false);
  };

  const handleSaveToken = () => {
    setStoredBridgeToken(tokenInput);
    setShowTokenModal(false);
    setActionFeedback({ type: 'success', message: 'Authentication token saved.' });
  };

  // Format helpers
  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadgeConfig = (status: BridgeStatus) => {
    switch (status) {
      case 'CONNECTED':
        return {
          label: 'TELEMETRY ACTIVE',
          badgeClass: 'bg-success/15 text-success border border-success/30',
          dotClass: 'bg-success animate-pulse shadow-[0_0_8px_#34D399]',
          description: 'Valid MAVLink telemetry and heartbeat actively streaming to backend'
        };
      case 'CONNECTING':
        return {
          label: 'CONNECTING TRANSPORT',
          badgeClass: 'bg-warning/15 text-warning border border-warning/30',
          dotClass: 'bg-warning animate-ping',
          description: 'Establishing TCP connection on port 5760'
        };
      case 'WAITING_FOR_ESP32':
        return {
          label: 'WAITING FOR ESP32',
          badgeClass: 'bg-warning/15 text-warning border border-warning/30',
          dotClass: 'bg-warning animate-pulse',
          description: 'Scanning mobile hotspot for ESP32 Wi-Fi station'
        };
      case 'STARTING':
        return {
          label: 'STARTING BRIDGE',
          badgeClass: 'bg-info/15 text-info border border-info/30',
          dotClass: 'bg-info animate-spin',
          description: 'Initializing Python virtualenv and dependencies'
        };
      case 'STOPPING':
        return {
          label: 'STOPPING...',
          badgeClass: 'bg-text-muted/15 text-text-muted border border-border',
          dotClass: 'bg-text-muted animate-pulse',
          description: 'Terminating managed process tree'
        };
      case 'DISCONNECTED':
        return {
          label: bridgeData.managed_pid ? 'BRIDGE RUNNING • WAITING FOR HARDWARE' : 'DISCONNECTED',
          badgeClass: 'bg-warning/15 text-warning border border-warning/30',
          dotClass: 'bg-warning animate-pulse',
          description: bridgeData.managed_pid
            ? 'Process active; waiting for Pixhawk MAVLink heartbeat'
            : 'Process active, but MAVLink heartbeat lost (> 2.0s)'
        };
      case 'ERROR':
        return {
          label: 'ERROR',
          badgeClass: 'bg-danger/15 text-danger border border-danger/30',
          dotClass: 'bg-danger shadow-[0_0_8px_#EF4444]',
          description: bridgeData.last_error || 'Bridge process exited with error'
        };
      case 'CONTROLLER_OFFLINE':
        return {
          label: 'CONTROLLER OFFLINE',
          badgeClass: 'bg-danger/10 text-text-muted border border-danger/20',
          dotClass: 'bg-danger/60',
          description: 'Local controller service is not responding on 127.0.0.1:8765'
        };
      case 'BRIDGE_STOPPED':
      default:
        return {
          label: 'BRIDGE STOPPED',
          badgeClass: 'bg-surface-elevated text-text-muted border border-border',
          dotClass: 'bg-text-muted',
          description: 'Ready to launch physical Wi-Fi telemetry bridge'
        };
    }
  };

  const statusConfig = getStatusBadgeConfig(bridgeData.status);
  const isRunning =
    bridgeData.status === 'STARTING' ||
    bridgeData.status === 'WAITING_FOR_ESP32' ||
    bridgeData.status === 'CONNECTING' ||
    bridgeData.status === 'CONNECTED' ||
    bridgeData.status === 'DISCONNECTED';

  return (
    <div className="w-full bg-surface rounded-xl border border-border p-5 shadow-sm space-y-4 font-sans text-xs">
      {/* Top Banner: Feature Title & Controller Health */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
            <span className="material-symbols-outlined text-[20px]">router</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-text-primary tracking-wide">
                AERON Bridge Controller
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold flex items-center gap-1.5 ${statusConfig.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-[11px] text-text-muted">
              Local Python Telemetry Gateway • Windows Loopback API (127.0.0.1:8765)
            </p>
          </div>
        </div>

        {/* Right Tools: Logs Toggle & Security Token Config */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            title="Inspect real-time bridge console logs"
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
              showLogs
                ? 'bg-surface-elevated text-text-primary border-accent-primary/40'
                : 'bg-surface hover:bg-surface-elevated text-text-secondary border-border'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">terminal</span>
            <span>{showLogs ? 'Hide Logs' : 'Bridge Logs'}</span>
          </button>

          <button
            onClick={() => setShowTokenModal(true)}
            title="Configure local authentication token"
            className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">key</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-lg border font-mono text-xs flex items-center justify-between ${
            actionFeedback.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              {actionFeedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-text-muted hover:text-text-primary">
            ✕
          </button>
        </div>
      )}

      {/* Controller Offline Message Guard */}
      {bridgeData.status === 'CONTROLLER_OFFLINE' && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-danger font-semibold text-xs">
            <span className="material-symbols-outlined text-[18px]">wifi_off</span>
            <span>AERON Bridge Controller is not running on this computer.</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            The local bridge service must be active on <code className="text-accent-primary font-mono">{CONTROLLER_BASE_URL}</code> to start the physical MAVLink Wi-Fi telemetry bridge.
            Run <code className="text-text-primary font-mono">install-aeron-controller.ps1</code> or start the Python service to enable one-click control.
          </p>
        </div>
      )}

      {/* Remote / Mobile Access Limitation Notice */}
      {!isLoopbackHost && (
        <div className="p-3 bg-info/10 border border-info/30 rounded-lg flex items-start gap-2.5 text-text-secondary text-[11px]">
          <span className="material-symbols-outlined text-[16px] text-info shrink-0 mt-0.5">info</span>
          <div>
            <strong className="text-text-primary">Remote Dashboard Notice:</strong> When accessing the dashboard from a phone or external device, <code>127.0.0.1</code> refers to that device, not the telemetry laptop. Telemetry control requires the controller service running on the laptop.
          </div>
        </div>
      )}

      {/* Main Control Deck: Big Action Buttons & Telemetry Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Left Column: Primary Start / Stop Controls */}
        <div className="md:col-span-4 flex flex-col gap-2">
          {isRunning ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStopTelemetry}
                disabled={isOperating || bridgeData.status === 'STOPPING'}
                className="flex-1 px-5 py-3 rounded-xl font-sans font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-md bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                <span>{bridgeData.status === 'STOPPING' ? 'STOPPING...' : 'STOP TELEMETRY'}</span>
              </button>

              <button
                onClick={handleRestartTelemetry}
                disabled={isOperating}
                title="Restart telemetry bridge cleanly"
                className="p-3 rounded-xl bg-surface-elevated hover:bg-surface-secondary text-text-secondary hover:text-text-primary border border-border transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartTelemetry}
              disabled={isOperating || bridgeData.status === 'CONTROLLER_OFFLINE' || bridgeData.status === 'STARTING'}
              className="w-full px-5 py-3 rounded-xl font-sans font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-md bg-accent-primary text-black hover:bg-accent-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(191,244,46,0.2)]"
            >
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              <span>{bridgeData.status === 'STARTING' ? 'STARTING...' : 'START TELEMETRY'}</span>
            </button>
          )}

          <div className="text-[11px] text-text-muted flex items-center justify-between px-1">
            <span>Mode: <strong>Wi-Fi TCP (5760)</strong></span>
            <div className="flex items-center gap-2">
              {bridgeData.managed_pid && (
                <span className="font-mono text-[10px] text-text-secondary">PID: {bridgeData.managed_pid}</span>
              )}
              <span className="font-mono text-[10px] text-accent-primary">
                {formatUptime(bridgeData.uptime_seconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: 4 Real-Time Multi-Stage Indicator Panels */}
        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. ESP32 Link State */}
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/80 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">ESP32 Wi-Fi</span>
            <div className="flex items-center gap-1.5 my-1">
              <span className={`w-2 h-2 rounded-full ${
                bridgeData.esp32_state === 'CONNECTED'
                  ? 'bg-success animate-pulse'
                  : bridgeData.esp32_state === 'CONNECTING' || bridgeData.esp32_state === 'DISCOVERING'
                  ? 'bg-warning animate-ping'
                  : 'bg-text-muted'
              }`} />
              <span className="font-sans font-bold text-xs text-text-primary">
                {bridgeData.esp32_state}
              </span>
            </div>
            <span className="text-[10px] text-text-muted font-mono">Port 5760</span>
          </div>

          {/* 2. Pixhawk Heartbeat State */}
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/80 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">FC Heartbeat</span>
            <div className="flex items-center gap-1.5 my-1">
              <span className={`w-2 h-2 rounded-full ${
                bridgeData.heartbeat_state === 'HEALTHY'
                  ? 'bg-success animate-pulse'
                  : bridgeData.heartbeat_state === 'AWAITING'
                  ? 'bg-warning'
                  : 'bg-text-muted'
              }`} />
              <span className="font-sans font-bold text-xs text-text-primary">
                {bridgeData.heartbeat_state === 'HEALTHY' ? 'NOMINAL' : bridgeData.heartbeat_state}
              </span>
            </div>
            <span className="text-[10px] text-text-muted font-mono">TELEM2 (57.6k)</span>
          </div>

          {/* 3. Telemetry Freshness & Rate */}
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/80 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Packet Freshness</span>
            <div className="font-mono font-bold text-xs text-text-primary my-1">
              {bridgeData.telemetry_age_ms !== null ? `${bridgeData.telemetry_age_ms} ms` : '—'}
            </div>
            <span className="text-[10px] text-text-muted">
              {bridgeData.status === 'CONNECTED' ? 'Nominal (~5 Hz)' : 'Awaiting sync'}
            </span>
          </div>

          {/* 4. Cloud Ingestion */}
          <div className="p-3 bg-surface-elevated rounded-lg border border-border/80 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Cloud Ingestion</span>
            <div className="flex items-center gap-1.5 my-1">
              <span className={`w-2 h-2 rounded-full ${
                bridgeData.backend_state === 'CONNECTED'
                  ? 'bg-success animate-pulse'
                  : bridgeData.backend_state === 'CONNECTING'
                  ? 'bg-warning animate-pulse'
                  : bridgeData.backend_state === 'UPLOAD_ERROR'
                  ? 'bg-danger'
                  : 'bg-text-muted'
              }`} />
              <span className="font-mono font-bold text-xs text-text-primary">
                {bridgeData.backend_delivered_count !== undefined && bridgeData.backend_delivered_count > 0
                  ? `${bridgeData.backend_delivered_count} pkts`
                  : (bridgeData.backend_state || 'STANDBY')}
              </span>
            </div>
            <span className="text-[10px] text-text-muted truncate">
              {bridgeData.backend_delivered_count && bridgeData.backend_delivered_count > 0
                ? 'Render / Mongo Atlas'
                : 'Render Ingest'}
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Real-Time Bridge Console Log Drawer */}
      {showLogs && (
        <div className="mt-3 p-3 bg-black/60 rounded-xl border border-border font-mono text-[11px] space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-text-muted pb-1.5 border-b border-border/50 text-[10px]">
            <span className="flex items-center gap-1.5 text-accent-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
              LIVE TELEMETRY BRIDGE TERMINAL OUTPUT
            </span>
            <span>{bridgeData.recent_logs.length} lines captured</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 text-text-secondary select-text">
            {bridgeData.recent_logs.length > 0 ? (
              bridgeData.recent_logs.map((logLine, idx) => (
                <div
                  key={idx}
                  className={`leading-tight whitespace-pre-wrap break-all ${
                    logLine.includes('ERROR')
                      ? 'text-danger'
                      : logLine.includes('WARNING')
                      ? 'text-warning'
                      : logLine.includes('[STATUS]') || logLine.includes('HEALTHY')
                      ? 'text-accent-primary font-semibold'
                      : 'text-text-secondary'
                  }`}
                >
                  {logLine}
                </div>
              ))
            ) : (
              <div className="text-text-muted py-2 italic text-center">
                {bridgeData.status === 'BRIDGE_STOPPED'
                  ? 'Bridge is stopped. Press START TELEMETRY to launch process and stream logs.'
                  : 'Awaiting log output from subprocess...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authentication Token Configuration Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="bg-surface-elevated border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent-primary text-[20px]">key</span>
                <h3 className="font-bold text-sm text-text-primary">Bridge Controller Security Token</h3>
              </div>
              <button onClick={() => setShowTokenModal(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              State-changing operations (Start/Stop/Restart) require the local cryptographic token generated by the controller in <code className="text-accent-primary font-mono text-[11px]">.aeron-bridge-token</code>.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-text-muted uppercase">X-AERON-TOKEN</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste 64-char hex token..."
                className="w-full px-3 py-2 bg-surface rounded-lg border border-border font-mono text-xs text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={async () => {
                  const fetched = await fetchBridgeTokenFromLoopback();
                  if (fetched) setTokenInput(fetched);
                }}
                className="text-[11px] text-accent-primary hover:underline font-mono"
              >
                Auto-Detect from Loopback
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveToken}
                  className="px-4 py-1.5 rounded-lg bg-accent-primary text-black font-bold text-xs hover:bg-accent-primary/90"
                >
                  Save Token
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


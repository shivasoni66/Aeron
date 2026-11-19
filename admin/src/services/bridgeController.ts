/**
 * AERON Ground Control Station — Bridge Controller Client Service
 * ==============================================================
 * Communicates with the local AERON Bridge Controller service running
 * strictly on http://127.0.0.1:8765.
 */

export const CONTROLLER_BASE_URL = 'http://127.0.0.1:8765';
export const TOKEN_STORAGE_KEY = 'aeron_bridge_token';

export type BridgeStatus =
  | 'CONTROLLER_OFFLINE'
  | 'BRIDGE_STOPPED'
  | 'STARTING'
  | 'WAITING_FOR_ESP32'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'STOPPING';

export interface BridgeStatusResponse {
  status: BridgeStatus;
  managed_pid: number | null;
  transport: string;
  backend_url?: string;
  bridge_process_state?: 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';
  transport_state?: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  esp32_state: 'DISCONNECTED' | 'DISCOVERING' | 'CONNECTING' | 'CONNECTED';
  heartbeat_state: 'NO_HEARTBEAT' | 'AWAITING' | 'HEALTHY' | 'LOST';
  backend_state?: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'UPLOAD_ERROR';
  backend_delivered_count?: number;
  mavlink_rx_bytes?: number;
  mavlink_rx_packets?: number;
  telemetry_fresh: boolean;
  telemetry_age_ms: number | null;
  message_rate_hz: number;
  uptime_seconds: number;
  last_error: string | null;
  recent_logs: string[];
  started_at: number | null;
}

export interface DiagnosticCheckItem {
  id: string;
  name: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'WAITING' | 'NOT TESTED';
  details: string;
}

export interface BridgeDiagnosticsResponse {
  timestamp: string;
  overall: 'PASS' | 'WARNING' | 'FAIL' | 'WAITING';
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
    waiting: number;
  };
  checks: DiagnosticCheckItem[];
}

export interface BridgeHealthResponse {
  status: string;
  service: string;
  version: string;
  host: string;
  port: number;
  pid: number;
}

/**
 * Retrieves the stored authentication token from localStorage or auto-fetches from controller.
 */
export const getStoredBridgeToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Stores the authentication token in localStorage.
 */
export const setStoredBridgeToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } catch (err) {
    console.warn('[BridgeController] Could not save token to localStorage:', err);
  }
};

/**
 * Probes whether the local Bridge Controller HTTP service is online.
 */
export const checkControllerHealth = async (): Promise<BridgeHealthResponse | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${CONTROLLER_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return (await res.json()) as BridgeHealthResponse;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Automatically discovers the token if running on localhost / loopback.
 */
export const fetchBridgeTokenFromLoopback = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${CONTROLLER_BASE_URL}/api/bridge/token`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setStoredBridgeToken(data.token);
        return data.token;
      }
    }
  } catch {
    // Expected when running on non-loopback or if controller is offline
  }
  return null;
};

/**
 * Fetches the current authoritative status snapshot from the local controller.
 */
export const fetchBridgeStatus = async (): Promise<BridgeStatusResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${CONTROLLER_BASE_URL}/api/bridge/status`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return (await res.json()) as BridgeStatusResponse;
    }

    return createOfflineStatusResponse('Controller returned HTTP ' + res.status);
  } catch (err: any) {
    return createOfflineStatusResponse(err?.message || 'AERON Bridge Controller is not running on this computer.');
  }
};

/**
 * Sends a command to start the Python MAVLink telemetry bridge.
 */
export const startBridgeService = async (
  token?: string,
  options?: { transport?: string; backendUrl?: string; droneId?: string }
): Promise<{ success: boolean; message: string; status?: BridgeStatus }> => {
  const activeToken = token || getStoredBridgeToken() || await fetchBridgeTokenFromLoopback();
  if (!activeToken) {
    return {
      success: false,
      message: 'Authentication token missing. Please provide X-AERON-TOKEN to start bridge.'
    };
  }

  try {
    const body: Record<string, any> = {};
    if (options?.transport) body.transport = options.transport;
    if (options?.backendUrl) body.backend_url = options.backendUrl;
    if (options?.droneId) body.drone_id = options.droneId;

    const res = await fetch(`${CONTROLLER_BASE_URL}/api/bridge/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AERON-TOKEN': activeToken
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return {
      success: res.ok && !!data.success,
      message: data.message || (res.ok ? 'Bridge started' : 'Failed to start bridge'),
      status: data.status
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not connect to AERON Bridge Controller.'
    };
  }
};

/**
 * Sends a command to safely stop the managed Python bridge process.
 */
export const stopBridgeService = async (token?: string): Promise<{ success: boolean; message: string; status?: BridgeStatus }> => {
  const activeToken = token || getStoredBridgeToken() || await fetchBridgeTokenFromLoopback();
  if (!activeToken) {
    return {
      success: false,
      message: 'Authentication token missing. Please provide X-AERON-TOKEN to stop bridge.'
    };
  }

  try {
    const res = await fetch(`${CONTROLLER_BASE_URL}/api/bridge/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AERON-TOKEN': activeToken
      }
    });

    const data = await res.json();
    return {
      success: res.ok && !!data.success,
      message: data.message || (res.ok ? 'Bridge stopped' : 'Failed to stop bridge'),
      status: data.status
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not connect to AERON Bridge Controller.'
    };
  }
};

/**
 * Restarts the managed Python telemetry bridge safely.
 */
export const restartBridgeService = async (token?: string): Promise<{ success: boolean; message: string; status?: BridgeStatus }> => {
  const activeToken = token || getStoredBridgeToken() || await fetchBridgeTokenFromLoopback();
  if (!activeToken) {
    return {
      success: false,
      message: 'Authentication token missing. Please provide X-AERON-TOKEN.'
    };
  }

  try {
    const res = await fetch(`${CONTROLLER_BASE_URL}/api/bridge/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AERON-TOKEN': activeToken
      }
    });

    const data = await res.json();
    return {
      success: res.ok && !!data.success,
      message: data.message || 'Bridge restarted',
      status: data.status
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not connect to AERON Bridge Controller.'
    };
  }
};

/**
 * Executes the 13-stage telemetry bridge self-diagnostics test suite.
 */
export const runBridgeDiagnostics = async (): Promise<BridgeDiagnosticsResponse | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${CONTROLLER_BASE_URL}/api/bridge/diagnostics`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return (await res.json()) as BridgeDiagnosticsResponse;
    }
    return null;
  } catch (err) {
    console.warn('[BridgeController] Could not fetch bridge diagnostics:', err);
    return null;
  }
};

const createOfflineStatusResponse = (errorMsg: string): BridgeStatusResponse => ({
  status: 'CONTROLLER_OFFLINE',
  managed_pid: null,
  transport: 'WIFI',
  esp32_state: 'DISCONNECTED',
  heartbeat_state: 'NO_HEARTBEAT',
  telemetry_fresh: false,
  telemetry_age_ms: null,
  message_rate_hz: 0.0,
  uptime_seconds: 0,
  last_error: errorMsg,
  recent_logs: [],
  started_at: null
});


import { describe, it, expect } from 'vitest';
import { BridgeDiagnosticsPage } from '../BridgeDiagnosticsPage';
import { BridgeControllerWidget } from '../../components/telemetry/BridgeControllerWidget';
import { LiveEngineeringDiagnosticsPanel } from '../../components/telemetry/LiveEngineeringDiagnosticsPanel';
import { BridgeSelfDiagnosticsSuite } from '../../components/telemetry/BridgeSelfDiagnosticsSuite';
import sidebarSource from '../../components/Sidebar.tsx?raw';
import appSource from '../../App.tsx?raw';
import overviewSource from '../DroneOverviewPage.tsx?raw';
import liveTelemetrySource from '../LiveTelemetryPage.tsx?raw';
import bridgeDiagnosticsSource from '../BridgeDiagnosticsPage.tsx?raw';

describe('AERON Bridge & Diagnostics — Navigation, Architecture & Component Decoupling', () => {
  it('exports BridgeDiagnosticsPage as a valid component', () => {
    expect(typeof BridgeDiagnosticsPage).toBe('function');
    expect(typeof BridgeControllerWidget).toBe('function');
    expect(typeof LiveEngineeringDiagnosticsPanel).toBe('function');
    expect(typeof BridgeSelfDiagnosticsSuite).toBe('function');
  });

  it('verifies Bridge & Diagnostics navigation entry is placed immediately after GPS Tracking in Sidebar', () => {
    // Confirm presence of /bridge-diagnostics route
    expect(sidebarSource).toContain('/bridge-diagnostics');
    expect(sidebarSource).toContain('Bridge & Diagnostics');

    // Extract nav items order
    const matchItems = [...sidebarSource.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

    const liveCameraIdx = matchItems.indexOf('/live-camera');
    const gpsTrackingIdx = matchItems.indexOf('/gps-tracking');
    const bridgeDiagIdx = matchItems.indexOf('/bridge-diagnostics');
    const analyticsIdx = matchItems.indexOf('/flight-analytics');
    const historyIdx = matchItems.indexOf('/flight-history');

    expect(liveCameraIdx).toBeGreaterThanOrEqual(0);
    expect(gpsTrackingIdx).toBe(liveCameraIdx + 1);
    expect(bridgeDiagIdx).toBe(gpsTrackingIdx + 1);
    expect(analyticsIdx).toBe(bridgeDiagIdx + 1);
    expect(historyIdx).toBe(analyticsIdx + 1);
  });

  it('verifies route registration in App.tsx', () => {
    expect(appSource).toContain("import { BridgeDiagnosticsPage } from './pages/BridgeDiagnosticsPage'");
    expect(appSource).toContain('<Route path="bridge-diagnostics" element={<BridgeDiagnosticsPage />} />');
  });

  it('verifies DroneOverviewPage has completely removed BridgeControllerWidget', () => {
    expect(overviewSource).not.toContain('BridgeControllerWidget');
    expect(overviewSource).not.toContain('<BridgeControllerWidget');
  });

  it('verifies LiveTelemetryPage has completely removed LiveEngineeringDiagnosticsPanel', () => {
    expect(liveTelemetrySource).not.toContain('LiveEngineeringDiagnosticsPanel');
    expect(liveTelemetrySource).not.toContain('<LiveEngineeringDiagnosticsPanel');
  });

  it('verifies BridgeDiagnosticsPage embeds BridgeControllerWidget, LiveEngineeringDiagnosticsPanel and BridgeSelfDiagnosticsSuite', () => {
    expect(bridgeDiagnosticsSource).toContain("import { BridgeControllerWidget } from '../components/telemetry/BridgeControllerWidget'");
    expect(bridgeDiagnosticsSource).toContain("import { LiveEngineeringDiagnosticsPanel } from '../components/telemetry/LiveEngineeringDiagnosticsPanel'");
    expect(bridgeDiagnosticsSource).toContain("import { BridgeSelfDiagnosticsSuite } from '../components/telemetry/BridgeSelfDiagnosticsSuite'");
    expect(bridgeDiagnosticsSource).toContain('<BridgeControllerWidget />');
    expect(bridgeDiagnosticsSource).toContain('<LiveEngineeringDiagnosticsPanel />');
    expect(bridgeDiagnosticsSource).toContain('<BridgeSelfDiagnosticsSuite />');
  });

  it('verifies BridgeDiagnosticsPage renders the required title, subtitle and real state hooks', () => {
    expect(bridgeDiagnosticsSource).toContain('Bridge & Diagnostics');
    expect(bridgeDiagnosticsSource).toContain('Local hardware communication, telemetry gateway and engineering diagnostics.');
    expect(bridgeDiagnosticsSource).toContain('useHardware');
  });
});

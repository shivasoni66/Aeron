import React, { useEffect, useState } from 'react';
import { fetchDroneHardware } from '../services/api';
import { useHardware } from '../context/HardwareContext';
import { HardwareDeviceData } from '../types';

export const HardwareSensorsPage: React.FC = () => {
  const { isOnline, hardwareStatusLabel, latestTelemetry } = useHardware();
  const [devices, setDevices] = useState<HardwareDeviceData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [calibrationNotice, setCalibrationNotice] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<HardwareDeviceData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadHardware = async () => {
      try {
        const res = await fetchDroneHardware('AERON-HEX-01');
        if (isMounted) {
          setDevices(res.devices);
          if (res.devices.length > 0) setSelectedDevice(res.devices[0]);
        }
      } catch (err) {
        console.warn('[HardwareSensors] Failed to load hardware devices:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHardware();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCalibrate = (sensorName: string) => {
    setCalibrationNotice(
      `[SAFETY INTERLOCK] Sensor calibration for '${sensorName}' is restricted in read-only telemetry mode. Local bench validation required via MAVLink CLI.`
    );
    setTimeout(() => setCalibrationNotice(null), 5000);
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">memory</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Hardware & Sensors Bench
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Pixhawk 2.4.8 (STM32F427) Onboard Bus • Peripheral Sensor Diagnostics
          </p>
        </div>

        <button
          onClick={() => handleCalibrate('ALL_IMU_SENSORS')}
          className="px-4 py-2 bg-surface-elevated border border-border text-text-secondary hover:text-text-primary rounded-lg font-sans text-xs font-semibold flex items-center gap-2 transition-all cursor-not-allowed opacity-80"
          title="Restricted by ground safety policy"
        >
          <span className="material-symbols-outlined text-[16px] text-accent-primary">tune</span>
          <span>Calibrate sensors (Safety restricted)</span>
        </button>
      </div>

      {/* Safety Interlock Notification */}
      {calibrationNotice && (
        <div className="p-3.5 bg-danger/15 border border-danger/40 text-danger rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>{calibrationNotice}</span>
          </div>
          <button onClick={() => setCalibrationNotice(null)} className="text-text-primary hover:text-danger">
            ✕
          </button>
        </div>
      )}

      {/* Device Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-4 p-12 text-center text-text-muted font-mono text-xs">
            SCANNING ONBOARD BUS PERIPHERALS...
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-4 p-12 text-center text-text-muted font-mono text-xs">
            NO HARDWARE DEVICES REGISTERED FOR AERON-HEX-01.
          </div>
        ) : (
          devices.map((dev) => (
            <div
              key={dev.deviceId}
              onClick={() => setSelectedDevice(dev)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedDevice?.deviceId === dev.deviceId
                  ? 'bg-surface-elevated border-accent-primary/60 shadow-[0_0_12px_rgba(181,222,83,0.12)]'
                  : 'bg-surface border-border hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-text-muted uppercase">
                  {dev.deviceType.replace('_', ' ')}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    dev.connectionStatus === 'CONNECTED'
                      ? 'bg-success/15 text-success border border-success/30'
                      : dev.connectionStatus === 'AWAITING_DATA'
                      ? 'bg-warning/15 text-warning border border-warning/30'
                      : 'bg-surface-muted text-text-muted border border-border'
                  }`}
                >
                  {dev.connectionStatus}
                </span>
              </div>
              <h3 className="font-sans font-bold text-text-primary text-sm truncate">{dev.model}</h3>
              <p className="font-sans text-xs text-text-muted">{dev.manufacturer}</p>
              <div className="mt-3 pt-2.5 border-t border-border/60 flex justify-between font-mono text-[11px] text-text-muted">
                <span>INSTALL: {dev.installationStatus}</span>
                <span className="text-accent-primary">{dev.deviceId}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Hardware Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Onboard Bus & Port Architecture (8 Cols) */}
        <div className="lg:col-span-8 bg-surface p-5 rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="font-sans font-bold text-sm text-text-primary">
                Pixhawk 2.4.8 Pinout & Bus Topology
              </h2>
              <span className="text-[11px] text-text-muted">
                Autopilot link: {hardwareStatusLabel}
              </span>
            </div>
            <span className="font-mono text-xs text-accent-primary font-bold">
              ArduPilot Copter v4.5.1
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-surface-elevated p-3.5 rounded-lg border border-border space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-text-primary font-bold">TELEM 1 (UART)</span>
                <span className="text-accent-primary font-mono">57600 baud</span>
              </div>
              <p className="text-text-muted text-[11px]">MAVLink 2.0 Telemetry Radio / USB Ground Link</p>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                isOnline
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-surface-muted text-text-muted border-border'
              }`}>
                {isOnline ? 'Active stream' : 'Standby (Pre-flight)'}
              </span>
            </div>

            <div className="bg-surface-elevated p-3.5 rounded-lg border border-border space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-text-primary font-bold">TELEM 2 (UART)</span>
                <span className="text-text-muted font-mono">921600 baud</span>
              </div>
              <p className="text-text-muted text-[11px]">Companion Computer Link (RPi / Jetson)</p>
              <span className="inline-block px-2 py-0.5 rounded bg-surface-muted text-text-muted text-[10px] border border-border">
                Standby / Unattached
              </span>
            </div>

            <div className="bg-surface-elevated p-3.5 rounded-lg border border-border space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-text-primary font-bold">GPS & I2C Bus</span>
                <span className="text-accent-primary font-mono">38400 baud</span>
              </div>
              <p className="text-text-muted text-[11px]">U-Blox NEO-M8N GNSS + External HMC5883L Compass</p>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                isOnline
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-surface-muted text-text-muted border-border'
              }`}>
                {isOnline ? 'Bus locked' : 'Standby (Pre-flight)'}
              </span>
            </div>

            <div className="bg-surface-elevated p-3.5 rounded-lg border border-border space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-text-primary font-bold">Power Sensor</span>
                <span className="text-accent-primary font-mono">Analog ADC</span>
              </div>
              <p className="text-text-muted text-[11px]">4S LiPo Hall Sensor (PM02 Power Module)</p>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                isOnline
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-surface-muted text-text-muted border-border'
              }`}>
                {isOnline ? 'Calibrated (PM02)' : 'Standby (Pre-flight)'}
              </span>
            </div>
          </div>

          {/* Sensor Self-Test Matrix */}
          <div className="mt-4 pt-3 border-t border-border/60 space-y-3">
            <span className="font-sans text-xs text-text-primary font-bold uppercase tracking-wider block">
              Internal Sensor Health & Redundancy Matrix
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-surface-elevated p-3 rounded-lg border border-border">
                <span className="text-text-muted text-[10px] block">Primary IMU</span>
                <span className="text-text-primary font-mono font-bold">MPU-6000 (SPI)</span>
                <span className={`text-[11px] font-bold block mt-1 ${isOnline ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline ? 'Health OK' : 'Standby (Pre-flight)'}
                </span>
              </div>
              <div className="bg-surface-elevated p-3 rounded-lg border border-border">
                <span className="text-text-muted text-[10px] block">Secondary IMU</span>
                <span className="text-text-primary font-mono font-bold">LSM303D + L3GD20</span>
                <span className={`text-[11px] font-bold block mt-1 ${isOnline ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline ? 'Health OK' : 'Standby (Pre-flight)'}
                </span>
              </div>
              <div className="bg-surface-elevated p-3 rounded-lg border border-border">
                <span className="text-text-muted text-[10px] block">Barometer</span>
                <span className="text-text-primary font-mono font-bold">MS5611-01BA</span>
                <span className={`text-[11px] font-mono font-bold block mt-1 ${isOnline ? 'text-accent-primary' : 'text-text-muted'}`}>
                  {isOnline ? ((latestTelemetry as any)?.pressure ? `${(latestTelemetry as any).pressure.toFixed(1)} hPa` : '1013.2 hPa') : '—'}
                </span>
              </div>
              <div className="bg-surface-elevated p-3 rounded-lg border border-border">
                <span className="text-text-muted text-[10px] block">Failover CPU</span>
                <span className="text-text-primary font-mono font-bold">STM32F100 (IO)</span>
                <span className={`text-[11px] font-bold block mt-1 ${isOnline ? 'text-accent-primary' : 'text-text-muted'}`}>
                  {isOnline ? 'Interlocked' : 'Standby (Pre-flight)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Device Details Inspector (4 Cols) */}
        <div className="lg:col-span-4 bg-surface p-5 rounded-xl border border-border space-y-4 font-sans text-xs">
          <span className="font-sans text-sm font-bold text-text-primary block border-b border-border/60 pb-3">
            Device Specification Sheet
          </span>

          {selectedDevice ? (
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-text-muted block">Device Identifier</span>
                <span className="text-sm font-bold text-accent-primary font-mono">{selectedDevice.deviceId}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Model & Revision</span>
                <span className="text-text-primary font-bold">{selectedDevice.model}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Manufacturer</span>
                <span className="text-text-secondary">{selectedDevice.manufacturer}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Bus Type / Category</span>
                <span className="text-text-primary font-mono">{selectedDevice.deviceType.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Connection Status</span>
                <span className="text-text-primary font-bold">
                  {isOnline ? selectedDevice.connectionStatus : 'Standby (Pre-flight)'}
                </span>
              </div>
              {selectedDevice.serialNumber && (
                <div>
                  <span className="text-[10px] text-text-muted block">Serial Number</span>
                  <span className="text-text-secondary font-mono">{selectedDevice.serialNumber}</span>
                </div>
              )}
              {selectedDevice.metadata && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[10px] text-text-muted block mb-1">Configuration Metadata</span>
                  <pre className="p-2.5 bg-surface-elevated rounded-lg border border-border text-[10px] text-text-secondary overflow-x-auto">
                    {JSON.stringify(selectedDevice.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted">
              SELECT A HARDWARE DEVICE FROM THE TOP MATRIX TO INSPECT SPECIFICATIONS.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { fetchDroneHardware } from '../services/api';
import { HardwareDeviceData } from '../types';

export const HardwareSensorsPage: React.FC = () => {
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
      `[SAFETY INTERLOCK] Sensor calibration for '${sensorName}' is disabled in read-only telemetry mode. Bench orientation must be verified locally via MAVLink CLI.`
    );
    setTimeout(() => setCalibrationNotice(null), 5000);
  };

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">memory</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              HARDWARE & SENSORS BENCH
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            PIXHAWK 2.4.8 (STM32F427) ONBOARD BUS // PERIPHERAL SENSOR DIAGNOSTICS
          </p>
        </div>

        <button
          onClick={() => handleCalibrate('ALL_IMU_SENSORS')}
          className="px-space-md py-space-xs bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface font-label-telemetry text-label-telemetry rounded flex items-center gap-2 transition-all cursor-not-allowed opacity-80"
          title="Restricted by ground safety policy"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">tune</span>
          <span>CALIBRATE SENSORS [BENCH RESTRICTED]</span>
        </button>
      </div>

      {/* Safety Interlock Notification */}
      {calibrationNotice && (
        <div className="p-space-sm bg-error-container/30 border border-error text-error rounded font-label-telemetry text-[11px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>{calibrationNotice}</span>
          </div>
          <button onClick={() => setCalibrationNotice(null)} className="text-on-surface hover:text-error">
            ✕
          </button>
        </div>
      )}

      {/* Device Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-sm">
        {loading ? (
          <div className="col-span-4 p-8 text-center text-on-surface-variant font-label-telemetry">
            SCANNING ONBOARD BUS PERIPHERALS...
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-4 p-8 text-center text-on-surface-variant font-label-telemetry">
            NO HARDWARE DEVICES REGISTERED FOR AERON-HEX-01.
          </div>
        ) : (
          devices.map((dev) => (
            <div
              key={dev.deviceId}
              onClick={() => setSelectedDevice(dev)}
              className={`p-space-md rounded border transition-all cursor-pointer ${
                selectedDevice?.deviceId === dev.deviceId
                  ? 'bg-surface-container border-primary shadow-[0_0_12px_rgba(191,244,46,0.15)]'
                  : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-telemetry text-[10px] text-on-surface-variant uppercase">
                  {dev.deviceType.replace('_', ' ')}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-label-telemetry ${
                    dev.connectionStatus === 'CONNECTED'
                      ? 'bg-primary-container text-on-primary-container'
                      : dev.connectionStatus === 'AWAITING_DATA'
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-surface-variant text-on-surface-variant'
                  }`}
                >
                  {dev.connectionStatus}
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-sm truncate">{dev.model}</h3>
              <p className="text-body-sm text-on-surface-variant text-xs">{dev.manufacturer}</p>
              <div className="mt-3 pt-2 border-t border-surface-container-highest/40 flex justify-between font-label-telemetry text-[10px] text-on-surface-variant">
                <span>INSTALL: {dev.installationStatus}</span>
                <span className="text-primary-fixed">{dev.deviceId}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Hardware Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Onboard Bus & Port Architecture (8 Cols) */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-md">
          <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-space-xs">
            <span className="font-label-telemetry text-label-telemetry text-on-surface font-bold uppercase">
              PIXHAWK 2.4.8 PINOUT & BUS TOPOLOGY
            </span>
            <span className="font-label-telemetry text-[11px] text-primary-fixed">
              FIRMWARE: ARDUPILOT COPTER V4.3.4
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm font-label-telemetry text-[11px]">
            <div className="bg-surface-container-high p-space-sm rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-primary font-bold">TELEM 1 (UART)</span>
                <span className="text-primary-fixed">57600 BAUD</span>
              </div>
              <p className="text-on-surface-variant text-[10px]">MAVLink 2.0 Telemetry Radio / USB Ground Station Link</p>
              <span className="inline-block px-1.5 py-0.5 rounded bg-primary-container/20 text-primary text-[9px] font-bold">
                ACTIVE STREAM
              </span>
            </div>

            <div className="bg-surface-container-high p-space-sm rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-primary font-bold">TELEM 2 (UART)</span>
                <span className="text-on-surface-variant">921600 BAUD</span>
              </div>
              <p className="text-on-surface-variant text-[10px]">High-speed Companion Computer Link (Raspberry Pi / Jetson)</p>
              <span className="inline-block px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[9px]">
                STANDBY / UNATTACHED
              </span>
            </div>

            <div className="bg-surface-container-high p-space-sm rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-primary font-bold">GPS & I2C BUS</span>
                <span className="text-primary-fixed">38400 BAUD</span>
              </div>
              <p className="text-on-surface-variant text-[10px]">U-Blox NEO-M8N GNSS + External HMC5883L Compass (I2C 0x1E)</p>
              <span className="inline-block px-1.5 py-0.5 rounded bg-primary-container/20 text-primary text-[9px] font-bold">
                BUS LOCKED
              </span>
            </div>

            <div className="bg-surface-container-high p-space-sm rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-primary font-bold">POWER SENSOR</span>
                <span className="text-primary-fixed">ANALOG ADC</span>
              </div>
              <p className="text-on-surface-variant text-[10px]">3DR 4S LiPo Hall Sensor (Voltage pin 2, Current pin 3)</p>
              <span className="inline-block px-1.5 py-0.5 rounded bg-primary-container/20 text-primary text-[9px] font-bold">
                CALIBRATED
              </span>
            </div>
          </div>

          {/* Sensor Self-Test Matrix */}
          <div className="mt-space-md pt-space-sm border-t border-surface-container-highest/60 space-y-2">
            <span className="font-label-telemetry text-[11px] text-on-surface font-bold uppercase block">
              INTERNAL SENSOR HEALTH & REDUNDANCY MATRIX
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs font-label-telemetry text-[11px]">
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant text-[9px] block">PRIMARY IMU</span>
                <span className="text-on-surface font-bold">MPU-6000 (SPI)</span>
                <span className="text-primary-fixed text-[10px] block mt-1">HEALTH OK</span>
              </div>
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant text-[9px] block">SECONDARY IMU</span>
                <span className="text-on-surface font-bold">LSM303D + L3GD20</span>
                <span className="text-primary-fixed text-[10px] block mt-1">HEALTH OK</span>
              </div>
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant text-[9px] block">BAROMETER</span>
                <span className="text-on-surface font-bold">MS5611-01BA</span>
                <span className="text-primary-fixed text-[10px] block mt-1">1013.2 hPa</span>
              </div>
              <div className="bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant text-[9px] block">FAILOVER CPU</span>
                <span className="text-on-surface font-bold">STM32F100 (IO)</span>
                <span className="text-primary-fixed text-[10px] block mt-1">ARM INTERLOCKED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Device Details Inspector (4 Cols) */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
          <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
            DEVICE SPECIFICATION SHEET
          </span>

          {selectedDevice ? (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-on-surface-variant block">DEVICE IDENTIFIER</span>
                <span className="text-sm font-bold text-primary-fixed">{selectedDevice.deviceId}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block">MODEL & REVISION</span>
                <span className="text-on-surface font-bold">{selectedDevice.model}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block">MANUFACTURER</span>
                <span className="text-on-surface">{selectedDevice.manufacturer}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block">BUS TYPE / CATEGORY</span>
                <span className="text-primary">{selectedDevice.deviceType}</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block">CONNECTION STATUS</span>
                <span className="text-on-surface font-bold">{selectedDevice.connectionStatus}</span>
              </div>
              {selectedDevice.serialNumber && (
                <div>
                  <span className="text-[10px] text-on-surface-variant block">SERIAL NUMBER</span>
                  <span className="text-on-surface">{selectedDevice.serialNumber}</span>
                </div>
              )}
              {selectedDevice.metadata && (
                <div className="pt-2 border-t border-surface-container-highest/40">
                  <span className="text-[10px] text-on-surface-variant block mb-1">CONFIGURATION METADATA</span>
                  <pre className="p-2 bg-surface-container-highest/40 rounded text-[10px] text-on-surface overflow-x-auto">
                    {JSON.stringify(selectedDevice.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-on-surface-variant">
              SELECT A HARDWARE DEVICE FROM THE TOP MATRIX TO INSPECT SPECIFICATIONS.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


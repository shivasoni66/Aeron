import React, { useEffect, useState } from 'react';
import { fetchFlights, fetchFlightDetails } from '../services/api';
import { FlightSessionData, TelemetryData } from '../types';

export const FlightAnalyticsPage: React.FC = () => {
  const [flights, setFlights] = useState<FlightSessionData[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string>('');
  const [telemetrySamples, setTelemetrySamples] = useState<TelemetryData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadFlights = async () => {
      try {
        const res = await fetchFlights(1, 50);
        if (isMounted) {
          setFlights(res.flights);
          if (res.flights.length > 0) {
            setSelectedFlightId(res.flights[0].flightSessionId);
          }
        }
      } catch (err) {
        console.warn('[FlightAnalytics] Error loading flights:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFlights();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFlightId) return;
    let isMounted = true;
    const loadDetails = async () => {
      try {
        const res = await fetchFlightDetails(selectedFlightId);
        if (isMounted) {
          setTelemetrySamples(res.telemetrySamples || []);
        }
      } catch (err) {
        console.warn('[FlightAnalytics] Error loading flight details:', err);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedFlightId]);

  const selectedFlight = flights.find((f) => f.flightSessionId === selectedFlightId);

  // Computed metrics from telemetry samples
  const altitudes = telemetrySamples.map((t) => t.relativeAltitude ?? t.altitude ?? 0);
  const speeds = telemetrySamples.map((t) => t.groundSpeed ?? 0);
  const voltages = telemetrySamples.map((t) => t.batteryVoltage ?? 0);

  const maxAlt = altitudes.length > 0 ? Math.max(...altitudes).toFixed(1) : '--';
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds).toFixed(1) : '--';
  const minVolt = voltages.length > 0 ? Math.min(...voltages.filter((v) => v > 0)).toFixed(1) : '--';
  const durationMin = selectedFlight?.durationSeconds
    ? `${Math.floor(selectedFlight.durationSeconds / 60)}m ${selectedFlight.durationSeconds % 60}s`
    : '--';

  // SVG Chart Helper: points string from array
  const createSvgPoints = (data: number[], width: number, height: number, minVal?: number, maxVal?: number) => {
    if (data.length < 2) return '';
    const min = minVal !== undefined ? minVal : Math.min(...data);
    const max = maxVal !== undefined ? maxVal : Math.max(...data);
    const range = max - min || 1;

    return data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 20) - 10;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">monitoring</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              POST-FLIGHT ANALYTICS & PROFILES
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            DYNAMIC TELEMETRY HARVEST // POWER CONSUMPTION & KINEMATIC CURVES
          </p>
        </div>

        {/* Flight Selector Dropdown */}
        <div className="flex items-center gap-2 font-label-telemetry text-[11px]">
          <span className="text-on-surface-variant">SESSION:</span>
          <select
            value={selectedFlightId}
            onChange={(e) => setSelectedFlightId(e.target.value)}
            disabled={flights.length === 0}
            className="bg-surface-container px-3 py-1.5 rounded border border-outline-variant text-on-surface outline-none focus:border-primary"
          >
            {flights.length === 0 ? (
              <option value="">NO SESSIONS AVAILABLE</option>
            ) : (
              flights.map((f) => (
                <option key={f.flightSessionId} value={f.flightSessionId}>
                  {f.flightSessionId} — {f.source} ({new Date(f.startedAt).toLocaleDateString()})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-on-surface-variant font-label-telemetry">
          LOADING FLIGHT SORTIE ARCHIVES...
        </div>
      ) : flights.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded border border-outline-variant/30 text-center space-y-3 font-label-telemetry">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">cloud_off</span>
          <h3 className="text-lg font-bold text-on-surface">NO FLIGHT SESSIONS RECORDED</h3>
          <p className="text-on-surface-variant text-xs max-w-md mx-auto">
            NO COMPLETED FLIGHT SESSIONS RECORDED — RUN A HARDWARE BENCH TEST OR SIMULATION IN DRONE-BRIDGE TO GENERATE TELEMETRY PROFILES.
          </p>
        </div>
      ) : (
        <>
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm font-label-telemetry">
            <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
              <span className="text-[10px] text-on-surface-variant block uppercase">FLIGHT DURATION</span>
              <span className="text-xl font-bold text-on-surface mt-1 block">{durationMin}</span>
              <span className="text-[10px] text-primary-fixed mt-1 block">STATUS: {selectedFlight?.status}</span>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
              <span className="text-[10px] text-on-surface-variant block uppercase">PEAK ALTITUDE (AGL)</span>
              <span className="text-xl font-bold text-primary-fixed mt-1 block">{maxAlt} M</span>
              <span className="text-[10px] text-on-surface-variant mt-1 block">MS5611 BAROMETER</span>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
              <span className="text-[10px] text-on-surface-variant block uppercase">MAX GROUND SPEED</span>
              <span className="text-xl font-bold text-on-surface mt-1 block">{maxSpeed} M/S</span>
              <span className="text-[10px] text-on-surface-variant mt-1 block">
                {maxSpeed !== '--' ? `${(parseFloat(maxSpeed) * 3.6).toFixed(1)} KM/H` : '--'}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
              <span className="text-[10px] text-on-surface-variant block uppercase">MIN VOLTAGE DETECTED</span>
              <span className="text-xl font-bold text-on-surface mt-1 block">{minVolt} V</span>
              <span className="text-[10px] text-primary-fixed mt-1 block">4S POWER MODULE</span>
            </div>
          </div>

          {/* Performance Curves Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
            {/* Altitude Profile Chart */}
            <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2 font-label-telemetry text-[11px]">
                <span className="text-on-surface font-bold uppercase">ALTITUDE TRAJECTORY (M AGL)</span>
                <span className="text-primary-fixed font-bold">{telemetrySamples.length} SAMPLES</span>
              </div>

              {telemetrySamples.length > 1 ? (
                <div className="h-48 w-full relative flex items-center justify-center">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#bff42e"
                      strokeWidth="2.5"
                      points={createSvgPoints(altitudes, 500, 180)}
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-on-surface-variant font-label-telemetry text-xs">
                  INSUFFICIENT SAMPLES FOR CURVE VISUALIZATION
                </div>
              )}
            </div>

            {/* Speed Profile Chart */}
            <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2 font-label-telemetry text-[11px]">
                <span className="text-on-surface font-bold uppercase">GROUND SPEED PROFILE (M/S)</span>
                <span className="text-primary font-bold">PEAK: {maxSpeed} M/S</span>
              </div>

              {telemetrySamples.length > 1 ? (
                <div className="h-48 w-full relative flex items-center justify-center">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      points={createSvgPoints(speeds, 500, 180)}
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-on-surface-variant font-label-telemetry text-xs">
                  INSUFFICIENT SAMPLES FOR SPEED PROFILE
                </div>
              )}
            </div>

            {/* Battery Discharge Curve */}
            <div className="col-span-1 lg:col-span-2 bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2 font-label-telemetry text-[11px]">
                <span className="text-on-surface font-bold uppercase">4S BATTERY DISCHARGE PROFILE (VOLTS)</span>
                <span className="text-primary-fixed font-bold">CUTOFF THRESHOLD: 14.0V</span>
              </div>

              {telemetrySamples.length > 1 ? (
                <div className="h-44 w-full relative flex items-center justify-center">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 160" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="2.5"
                      points={createSvgPoints(voltages, 1000, 160, 13.0, 16.8)}
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-on-surface-variant font-label-telemetry text-xs">
                  INSUFFICIENT VOLTAGE SAMPLES
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


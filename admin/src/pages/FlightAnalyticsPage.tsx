import React, { useEffect, useState } from 'react';
import { fetchFlights, fetchFlightDetails } from '../services/api';
import { FlightSessionData, TelemetryData } from '../types';
import { MetricCard } from '../components/MetricCard';

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

  const altitudes = telemetrySamples.map((t) => t.relativeAltitude ?? t.altitude ?? 0);
  const speeds = telemetrySamples.map((t) => t.groundSpeed ?? 0);
  const voltages = telemetrySamples.map((t) => t.batteryVoltage ?? 0);

  const maxAlt = altitudes.length > 0 ? Math.max(...altitudes).toFixed(1) : '--';
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds).toFixed(1) : '--';
  const minVolt = voltages.length > 0 ? Math.min(...voltages.filter((v) => v > 0)).toFixed(1) : '--';
  const durationMin = selectedFlight?.durationSeconds
    ? `${Math.floor(selectedFlight.durationSeconds / 60)}m ${selectedFlight.durationSeconds % 60}s`
    : '--';

  const createSvgPoints = (data: number[], width: number, height: number, minVal?: number, maxVal?: number) => {
    if (data.length < 2) return '';
    const min = minVal !== undefined ? minVal : Math.min(...data);
    const max = maxVal !== undefined ? maxVal : Math.max(...data);
    const range = max - min || 1;

    return data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 24) - 12;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">monitoring</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Post-Flight Analytics & Profiles
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Dynamic Telemetry Harvest • Power Consumption & Kinematic Curves
          </p>
        </div>

        {/* Flight Selector Dropdown */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          <span className="text-text-muted">SESSION:</span>
          <select
            value={selectedFlightId}
            onChange={(e) => setSelectedFlightId(e.target.value)}
            disabled={flights.length === 0}
            className="bg-surface-elevated px-3 py-1.5 rounded-lg border border-border text-text-primary outline-none focus:border-accent-primary font-mono"
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 bg-surface rounded-xl border border-border animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-surface rounded-xl border border-border animate-pulse" />
        </div>
      ) : flights.length === 0 ? (
        <div className="bg-surface p-12 rounded-xl border border-border text-center space-y-3 font-sans">
          <span className="material-symbols-outlined text-[48px] text-text-muted/40">cloud_off</span>
          <h3 className="text-base font-bold text-text-primary">No Flight Sessions Recorded</h3>
          <p className="text-text-muted text-xs max-w-md mx-auto">
            Flight performance analytics and curves will populate once an active sortie or bench simulation session is completed.
          </p>
        </div>
      ) : (
        <>
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Sortie Duration"
              value={durationMin}
              unit="total"
              icon="timer"
              status="normal"
              secondaryValue={`Status: ${selectedFlight?.status || 'COMPLETED'}`}
            />

            <MetricCard
              label="Peak Altitude"
              value={maxAlt}
              unit="m AGL"
              icon="height"
              status="info"
              secondaryValue="Barometric MS5611"
            />

            <MetricCard
              label="Max Groundspeed"
              value={maxSpeed}
              unit="m/s"
              icon="speed"
              status="active"
              secondaryValue={maxSpeed !== '--' ? `${(parseFloat(maxSpeed) * 3.6).toFixed(1)} km/h` : '0.0 km/h'}
            />

            <MetricCard
              label="Min Battery Voltage"
              value={minVolt}
              unit="volts"
              icon="battery_alert"
              status={minVolt !== '--' && parseFloat(minVolt) < 14.2 ? 'warning' : 'normal'}
              secondaryValue="Threshold: 14.0V"
            />
          </div>

          {/* Performance Curves Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Altitude Trajectory Chart */}
            <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-3 font-mono text-xs">
                <span className="font-sans font-bold text-sm text-text-primary uppercase tracking-wider">
                  ALTITUDE TRAJECTORY (M AGL)
                </span>
                <span className="text-accent-primary font-bold">{telemetrySamples.length} SAMPLES</span>
              </div>

              {telemetrySamples.length > 1 ? (
                <div className="h-52 w-full relative flex items-center justify-center p-2 bg-surface-elevated/40 rounded-lg border border-border/60">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#B5DE53"
                      strokeWidth="2.5"
                      points={createSvgPoints(altitudes, 500, 180)}
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-text-muted font-mono text-xs">
                  INSUFFICIENT SAMPLES FOR CURVE VISUALIZATION
                </div>
              )}
            </div>

            {/* Groundspeed Profile Chart */}
            <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-3 font-mono text-xs">
                <span className="font-sans font-bold text-sm text-text-primary uppercase tracking-wider">
                  GROUNDSPEED PROFILE (M/S)
                </span>
                <span className="text-info font-bold">PEAK: {maxSpeed} M/S</span>
              </div>

              {telemetrySamples.length > 1 ? (
                <div className="h-52 w-full relative flex items-center justify-center p-2 bg-surface-elevated/40 rounded-lg border border-border/60">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#79AACB"
                      strokeWidth="2.5"
                      points={createSvgPoints(speeds, 500, 180)}
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-text-muted font-mono text-xs">
                  INSUFFICIENT SAMPLES FOR SPEED PROFILE
                </div>
              )}
            </div>

            {/* Battery Discharge Curve */}
            <div className="col-span-1 lg:col-span-2 bg-surface p-5 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-3 font-mono text-xs">
                <span className="font-sans font-bold text-sm text-text-primary uppercase tracking-wider">
                  4S BATTERY DISCHARGE PROFILE (VOLTS)
                </span>
                <span className="text-warning font-bold">CUTOFF THRESHOLD: 14.0V</span>
              </div>

              {telemetrySamples.length > 1 ? (
                <div className="h-48 w-full relative flex items-center justify-center p-2 bg-surface-elevated/40 rounded-lg border border-border/60">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 160" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#DDB66A"
                      strokeWidth="2.5"
                      points={createSvgPoints(voltages, 1000, 160, 13.0, 16.8)}
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-text-muted font-mono text-xs">
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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchMissions, fetchBhopalMicroClimate } from '../services/api';
import { subscribeToManagerBroadcasts } from '../services/socket';
import { MissionData, BhopalMicroClimateData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';
import { isDemoMission } from '../utils/geo';

// Compass direction helper
const getWindCompass = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return directions[index];
};

// Weather code icon helper
const getWeatherIcon = (code: number, isDay: boolean = true): string => {
  if (code === 0) return isDay ? 'wb_sunny' : 'bedtime';
  if (code === 1 || code === 2) return isDay ? 'partly_cloudy_day' : 'nights_stay';
  if (code === 3) return 'cloud';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 57) return 'grain';
  if (code >= 61 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'ac_unit';
  if (code >= 80 && code <= 82) return 'shower';
  if (code >= 95) return 'thunderstorm';
  return 'cloud_queue';
};

// US AQI category helper
const getUsAqiCategory = (aqi: number) => {
  if (aqi <= 50) {
    return { label: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  }
  if (aqi <= 100) {
    return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  }
  if (aqi <= 150) {
    return { label: 'Unhealthy for Sensitive Groups', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  }
  if (aqi <= 200) {
    return { label: 'Unhealthy', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  }
  if (aqi <= 300) {
    return { label: 'Very Unhealthy', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
  }
  return { label: 'Hazardous', color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/50' };
};

// European AQI category helper
const getEuAqiCategory = (aqi: number) => {
  if (aqi <= 20) {
    return { label: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  }
  if (aqi <= 40) {
    return { label: 'Fair', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' };
  }
  if (aqi <= 60) {
    return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  }
  if (aqi <= 80) {
    return { label: 'Poor', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
  }
  return { label: 'Very Poor', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
};

// UV Index category helper
const getUvCategory = (uv: number) => {
  if (uv <= 2) return { label: 'Low', color: 'text-emerald-400' };
  if (uv <= 5) return { label: 'Moderate', color: 'text-yellow-400' };
  if (uv <= 7) return { label: 'High', color: 'text-orange-400' };
  if (uv <= 10) return { label: 'Very High', color: 'text-rose-400' };
  return { label: 'Extreme', color: 'text-purple-400' };
};

export const MicroClimatePage: React.FC = () => {
  const [climateData, setClimateData] = useState<BhopalMicroClimateData | null>(null);
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshCooldown, setRefreshCooldown] = useState<number>(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [forecastView, setForecastView] = useState<'24h' | '7d' | 'aqTrend'>('24h');

  // Cooldown timer
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
      setRefreshError(null);
    } else {
      setIsLoading(true);
    }

    try {
      const [mRes, cRes] = await Promise.all([
        fetchMissions({ category: 'MICRO_CLIMATE', limit: 15 }),
        fetchBhopalMicroClimate(forceRefresh)
      ]);
      const realMissions = (mRes.missions || []).filter((m) => !isDemoMission(m));
      setMissions(realMissions);
      setClimateData(cRes);
      if (forceRefresh) {
        setRefreshCooldown(30);
      }
    } catch (err: unknown) {
      console.warn('MicroClimate fetch error:', err);
      if (forceRefresh) {
        setRefreshError(err instanceof Error ? err.message : 'Manual refresh rejected or timed out');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto polling every 5 minutes
    const interval = setInterval(() => {
      loadData(false);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const cleanup = subscribeToManagerBroadcasts({
      onMissionCreated: () => loadData(false),
      onMissionUpdated: () => loadData(false),
      onReconnect: () => loadData(false)
    });
    return () => cleanup();
  }, [loadData]);

  const handleManualRefresh = () => {
    if (refreshCooldown > 0 || isRefreshing) return;
    loadData(true);
  };

  // 24h Hourly Slice (first 24 hours)
  const hourly24 = useMemo(() => {
    if (!climateData?.forecast?.hourly) return [];
    return climateData.forecast.hourly.slice(0, 24);
  }, [climateData]);

  // Hourly min and max temp for scaling SVG chart
  const { minTemp24, maxTemp24 } = useMemo(() => {
    if (!hourly24.length) return { minTemp24: 0, maxTemp24: 40 };
    const temps = hourly24.map((h) => h.temperature);
    return {
      minTemp24: Math.floor(Math.min(...temps) - 2),
      maxTemp24: Math.ceil(Math.max(...temps) + 2)
    };
  }, [hourly24]);

  // 5-day Air Quality trend points (sampled every 3 hours for 5 days = 40 points)
  const aqTrendPoints = useMemo(() => {
    if (!climateData?.forecast?.airQualityHourly) return [];
    const hourly = climateData.forecast.airQualityHourly.slice(0, 120); // 5 days
    // Sample every 3 hours
    return hourly.filter((_, idx) => idx % 3 === 0);
  }, [climateData]);

  // AQ trend max value for scaling
  const maxPmVal = useMemo(() => {
    if (!aqTrendPoints.length) return 100;
    const maxPm25 = Math.max(...aqTrendPoints.map((p) => p.pm25));
    const maxPm10 = Math.max(...aqTrendPoints.map((p) => p.pm10));
    return Math.max(80, Math.ceil(Math.max(maxPm25, maxPm10) * 1.15));
  }, [aqTrendPoints]);

  const weather = climateData?.weather;
  const airQuality = climateData?.airQuality;
  const location = climateData?.location;
  const summary = climateData?.summary;
  const hardware = climateData?.hardwareSensors;
  const cache = climateData?.cache;
  const sources = climateData?.sources;

  const usAqiMeta = airQuality ? getUsAqiCategory(airQuality.usAqi) : null;
  const euAqiMeta = airQuality ? getEuAqiCategory(airQuality.europeanAqi) : null;
  const uvMeta = weather ? getUvCategory(airQuality?.uvIndex ?? 0) : null;

  return (
    <div className="flex flex-col w-full px-4 sm:px-6 py-6 space-y-6 max-w-[1720px] mx-auto text-text-primary">
      {/* SECTION A: LOCATION & STATUS HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-surface rounded-2xl border border-border border-l-4 border-l-caution-amber shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-caution-amber text-[24px]">thermostat_auto</span>
            <span className="font-sans text-xs text-caution-amber uppercase tracking-wider font-semibold">
              VERTICAL 04 • ATMOSPHERIC MICRO-CLIMATE & AIR QUALITY
            </span>
            <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
              climateData?.status === 'API_CONNECTED'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : climateData?.status === 'API_STALE'
                ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {climateData?.status || 'INITIALIZING'}
            </span>
            {cache?.weatherCached && (
              <span className="px-2 py-0.5 rounded bg-surface text-text-muted border border-border font-mono text-[10px]">
                CACHE: W({cache.weatherAgeSeconds}s) / AQ({cache.airQualityAgeSeconds}s)
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-sans font-bold text-xl sm:text-2xl text-text-primary tracking-tight">
              {location ? `${location.city.toUpperCase()}, ${location.state.toUpperCase()} (${location.country.toUpperCase()})` : 'BHOPAL, MADHYA PRADESH, INDIA'}
            </h1>
            <span className="font-mono text-xs text-caution-amber font-semibold">
              {location ? `${location.latitude.toFixed(4)}° N, ${location.longitude.toFixed(4)}° E` : '23.2599° N, 77.4126° E'}
            </span>
            {location?.elevationMeters !== undefined && (
              <span className="font-mono text-xs text-text-muted">
                MSL: {location.elevationMeters}m
              </span>
            )}
          </div>

          <p className="font-sans text-xs text-text-muted leading-relaxed">
            Real atmospheric weather and air quality monitoring for Bhopal via Copernicus CAMS & Open-Meteo models.
            Hardware airframe payloads are source-isolated below.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || refreshCooldown > 0}
            className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all ${
              refreshCooldown > 0 || isRefreshing
                ? 'bg-surface border-border text-text-muted cursor-not-allowed opacity-75'
                : 'bg-surface hover:bg-surface-elevated border-border text-text-primary hover:border-caution-amber/50'
            }`}
            title="Fetch latest meteorological telemetry from Open-Meteo"
          >
            <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin text-caution-amber' : ''}`}>
              refresh
            </span>
            <span>
              {isRefreshing
                ? 'REFRESHING...'
                : refreshCooldown > 0
                ? `COOLDOWN (${refreshCooldown}s)`
                : 'REFRESH DATA'}
            </span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-caution-amber text-background font-sans font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(242,185,95,0.25)]"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Launch Climate Sortie</span>
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{refreshError}</span>
        </div>
      )}

      {/* SECTION E: FLIGHT ADVISORY BANNER */}
      {summary && (
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs ${
          summary.flightAdvisory === 'PERMITTED'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : summary.flightAdvisory === 'CAUTION'
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              summary.flightAdvisory === 'PERMITTED'
                ? 'bg-emerald-500/20 text-emerald-400'
                : summary.flightAdvisory === 'CAUTION'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              <span className="material-symbols-outlined text-[24px]">
                {summary.flightAdvisory === 'PERMITTED' ? 'check_circle' : summary.flightAdvisory === 'CAUTION' ? 'warning' : 'block'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide">
                  FLIGHT ADVISORY: {summary.flightAdvisory}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-white/10 uppercase">
                  Thermal: {summary.thermalClassification}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-white/10 uppercase">
                  AQ: {summary.airQualityClassification}
                </span>
              </div>
              <p className="text-text-secondary font-sans text-xs mt-1">
                {summary.advisoryReasons.length > 0
                  ? summary.advisoryReasons.join(' • ')
                  : 'Atmospheric conditions within standard AERON flight envelope.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] shrink-0">
            {summary.windAlert && (
              <span className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">air</span> HIGH WIND
              </span>
            )}
            {summary.rainAlert && (
              <span className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">water_drop</span> PRECIPITATION
              </span>
            )}
            {summary.particulateAlert && (
              <span className="px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">grain</span> PM ELEVATED
              </span>
            )}
          </div>
        </div>
      )}

      {/* SECTION B: CURRENT WEATHER METRICS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-caution-amber text-[20px]">wb_cloudy</span>
            <h2 className="font-sans font-bold text-base text-text-primary tracking-tight">
              Bhopal Current Meteorological Metrics
            </h2>
            <span className="font-mono text-[11px] text-text-muted">
              (Model: {sources?.weather.model || 'Open-Meteo BestMatch'})
            </span>
          </div>
          {weather?.timestamp && (
            <span className="font-mono text-[11px] text-text-muted">
              Updated: {new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Ambient Temp */}
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-muted">
              <span className="font-mono text-[11px] uppercase">Temperature</span>
              <span className="material-symbols-outlined text-caution-amber text-[20px]">
                {weather ? getWeatherIcon(weather.weatherCode, weather.isDay) : 'thermostat'}
              </span>
            </div>
            <div className="my-2">
              <div className="font-sans text-3xl font-extrabold text-text-primary">
                {weather !== undefined ? `${weather.temperature.toFixed(1)}°C` : '--'}
              </div>
              <div className="font-sans text-xs text-text-muted mt-0.5">
                Feels like {weather !== undefined ? `${weather.apparentTemperature.toFixed(1)}°C` : '--'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-caution-amber truncate">
              {weather?.weatherDescription || 'Standby'}
            </div>
          </div>

          {/* Card 2: Relative Humidity */}
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-muted">
              <span className="font-mono text-[11px] uppercase">Relative Humidity</span>
              <span className="material-symbols-outlined text-blue-400 text-[20px]">humidity_percentage</span>
            </div>
            <div className="my-2">
              <div className="font-sans text-3xl font-extrabold text-text-primary">
                {weather !== undefined ? `${weather.relativeHumidity}%` : '--'}
              </div>
              <div className="font-sans text-xs text-text-muted mt-0.5">
                Moisture Saturation
              </div>
            </div>
            <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, weather?.relativeHumidity ?? 0))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Barometric Pressure */}
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-muted">
              <span className="font-mono text-[11px] uppercase">Pressure (MSL)</span>
              <span className="material-symbols-outlined text-teal-400 text-[20px]">compress</span>
            </div>
            <div className="my-2">
              <div className="font-sans text-3xl font-extrabold text-text-primary">
                {weather !== undefined ? `${weather.pressureMsl.toFixed(1)}` : '--'}
              </div>
              <div className="font-sans text-xs text-text-muted mt-0.5">
                hPa (Sea-level adjusted)
              </div>
            </div>
            <div className="text-[11px] font-mono text-text-muted">
              Surface: {weather?.surfacePressure ? `${weather.surfacePressure.toFixed(1)} hPa` : 'N/A'}
            </div>
          </div>

          {/* Card 4: Wind Dynamics */}
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-muted">
              <span className="font-mono text-[11px] uppercase">Wind Velocity</span>
              <span className="material-symbols-outlined text-cyan-400 text-[20px]">air</span>
            </div>
            <div className="my-2">
              <div className="font-sans text-3xl font-extrabold text-text-primary flex items-baseline gap-1">
                <span>{weather !== undefined ? `${weather.windSpeed.toFixed(1)}` : '--'}</span>
                <span className="text-sm font-normal text-text-muted">km/h</span>
              </div>
              <div className="font-sans text-xs text-text-muted mt-0.5">
                Gusts up to {weather !== undefined ? `${weather.windGusts.toFixed(1)} km/h` : '--'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">navigation</span>
              <span>{weather !== undefined ? `${weather.windDirection}° (${getWindCompass(weather.windDirection)})` : '--'}</span>
            </div>
          </div>

          {/* Card 5: Cloud Cover & Rain */}
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-muted">
              <span className="font-mono text-[11px] uppercase">Precip & Cloud</span>
              <span className="material-symbols-outlined text-indigo-400 text-[20px]">cloud</span>
            </div>
            <div className="my-2">
              <div className="font-sans text-3xl font-extrabold text-text-primary flex items-baseline gap-1">
                <span>{weather !== undefined ? `${weather.precipitation.toFixed(1)}` : '--'}</span>
                <span className="text-sm font-normal text-text-muted">mm</span>
              </div>
              <div className="font-sans text-xs text-text-muted mt-0.5">
                Cloud Cover: {weather !== undefined ? `${weather.cloudCover}%` : '--'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-text-muted">
              {weather?.rain && weather.rain > 0 ? `Active Rain: ${weather.rain}mm` : 'Zero active rainfall'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: AIR QUALITY PANEL (COPERNICUS CAMS GLOBAL) */}
      <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-caution-amber text-[22px]">masks</span>
              <h2 className="font-sans font-bold text-base text-text-primary tracking-tight">
                Copernicus CAMS Air Quality Telemetry — Bhopal
              </h2>
            </div>
            <p className="font-sans text-xs text-text-muted mt-0.5">
              Atmospheric pollutant analysis via Copernicus Atmosphere Monitoring Service (CAMS Global, ~45km spatial grid).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* US AQI Tag */}
            {airQuality && usAqiMeta && (
              <div className={`px-3 py-1.5 rounded-xl border ${usAqiMeta.bg} ${usAqiMeta.border} flex items-center gap-2`}>
                <span className="font-mono text-[10px] text-text-muted uppercase">US EPA AQI:</span>
                <span className={`font-mono text-sm font-extrabold ${usAqiMeta.color}`}>
                  {airQuality.usAqi}
                </span>
                <span className={`font-sans text-xs font-semibold ${usAqiMeta.color}`}>
                  ({usAqiMeta.label})
                </span>
              </div>
            )}

            {/* European AQI Tag */}
            {airQuality && euAqiMeta && (
              <div className={`px-3 py-1.5 rounded-xl border ${euAqiMeta.bg} ${euAqiMeta.border} flex items-center gap-2`}>
                <span className="font-mono text-[10px] text-text-muted uppercase">EU AQI:</span>
                <span className={`font-mono text-sm font-extrabold ${euAqiMeta.color}`}>
                  {airQuality.europeanAqi}
                </span>
                <span className={`font-sans text-xs font-semibold ${euAqiMeta.color}`}>
                  ({euAqiMeta.label})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer Note */}
        <div className="p-3 bg-surface-elevated/70 rounded-xl border border-border text-[11px] font-mono text-text-muted flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-caution-amber shrink-0">info</span>
          <span>
            AQI CLARIFICATION: Values reflect US EPA AQI (0–500 scale) and European AQI (0–100 scale) calculated from CAMS Global atmospheric models. These are distinct from Indian CPCB National AQI guidelines.
          </span>
        </div>

        {/* Pollutants Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono text-xs">
          {/* PM2.5 */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">PM 2.5</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.pm25 !== undefined ? `${airQuality.pm25.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              {airQuality?.pm25 !== undefined && airQuality.pm25 > 15 ? 'Exceeds WHO 24h' : 'Within WHO 24h'}
            </div>
          </div>

          {/* PM10 */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">PM 10</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.pm10 !== undefined ? `${airQuality.pm10.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              {airQuality?.pm10 !== undefined && airQuality.pm10 > 45 ? 'Elevated coarse' : 'Normal coarse'}
            </div>
          </div>

          {/* NO2 */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">NO₂</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.nitrogenDioxide !== undefined ? `${airQuality.nitrogenDioxide.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              Nitrogen Dioxide
            </div>
          </div>

          {/* SO2 */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">SO₂</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.sulphurDioxide !== undefined ? `${airQuality.sulphurDioxide.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              Sulphur Dioxide
            </div>
          </div>

          {/* Ozone */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">O₃ Ozone</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.ozone !== undefined ? `${airQuality.ozone.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              Ground-level O₃
            </div>
          </div>

          {/* CO */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">CO</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.carbonMonoxide !== undefined ? `${airQuality.carbonMonoxide.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              Carbon Monoxide
            </div>
          </div>

          {/* Dust */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">Dust Aerosol</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.dust !== undefined ? `${airQuality.dust.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">µg/m³</div>
            <div className="text-[10px] text-text-secondary pt-0.5 border-t border-border/40">
              Mineral Particles
            </div>
          </div>

          {/* UV Index */}
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-1">
            <div className="text-[10px] text-text-muted uppercase">Solar UV</div>
            <div className="text-xl font-bold text-text-primary">
              {airQuality?.uvIndex !== undefined ? `${airQuality.uvIndex.toFixed(1)}` : '--'}
            </div>
            <div className="text-[10px] text-text-muted">Index (0–12)</div>
            <div className={`text-[10px] font-semibold pt-0.5 border-t border-border/40 ${uvMeta?.color || 'text-text-muted'}`}>
              {uvMeta?.label || 'Standby'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: FORECAST DASHBOARD (TABS: 24h / 7d / AQ Trend) */}
      <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-caution-amber text-[22px]">insights</span>
            <h2 className="font-sans font-bold text-base text-text-primary tracking-tight">
              Bhopal Meteorological & Dispersion Projections
            </h2>
          </div>

          {/* View Toggle Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-elevated rounded-xl border border-border">
            <button
              onClick={() => setForecastView('24h')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                forecastView === '24h'
                  ? 'bg-caution-amber text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              24-HOUR HOURLY
            </button>
            <button
              onClick={() => setForecastView('7d')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                forecastView === '7d'
                  ? 'bg-caution-amber text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              7-DAY OUTLOOK
            </button>
            <button
              onClick={() => setForecastView('aqTrend')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                forecastView === 'aqTrend'
                  ? 'bg-caution-amber text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              5-DAY AQ TREND
            </button>
          </div>
        </div>

        {/* View 1: 24-Hour Weather Chart */}
        {forecastView === '24h' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-text-muted">
              <span>Next 24 hours (Hourly temperature & precipitation probability)</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-caution-amber" />
                  <span>Temperature (°C)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/60" />
                  <span>Rain Prob (%)</span>
                </span>
              </div>
            </div>

            {/* Responsive Scrollable 24-Hour Timeline */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[800px] h-[190px] relative bg-surface-elevated/40 rounded-xl border border-border p-3">
                {hourly24.length > 0 ? (
                  <svg className="w-full h-full" viewBox="0 0 1000 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F2B95F" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#F2B95F" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Rain probability bars in background */}
                    {hourly24.map((h, i) => {
                      const barWidth = 1000 / hourly24.length;
                      const x = i * barWidth;
                      const rainHeight = (h.precipitationProbability / 100) * 80;
                      return (
                        <rect
                          key={`rain-${i}`}
                          x={x + 4}
                          y={160 - rainHeight}
                          width={barWidth - 8}
                          height={rainHeight}
                          fill="#3B82F6"
                          opacity={0.3}
                          rx={2}
                        />
                      );
                    })}

                    {/* Temperature Line & Area */}
                    {(() => {
                      const points = hourly24.map((h, i) => {
                        const x = (i + 0.5) * (1000 / hourly24.length);
                        const range = Math.max(1, maxTemp24 - minTemp24);
                        const y = 140 - ((h.temperature - minTemp24) / range) * 110;
                        return { x, y, temp: h.temperature };
                      });

                      const pathD = points.reduce((acc, p, idx) => {
                        return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                      }, '');

                      const areaD = `${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;

                      return (
                        <>
                          <path d={areaD} fill="url(#tempGradient)" />
                          <path d={pathD} fill="none" stroke="#F2B95F" strokeWidth="2.5" />
                          {points.map((p, idx) => (
                            <circle
                              key={`pt-${idx}`}
                              cx={p.x}
                              cy={p.y}
                              r={3}
                              fill="#F2B95F"
                              stroke="#1E293B"
                              strokeWidth="1.5"
                            />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                ) : (
                  <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
                    NO HOURLY TELEMETRY AVAILABLE
                  </div>
                )}
              </div>

              {/* Hourly Labels & Icons strip */}
              <div
                className="min-w-[800px] gap-1 pt-2 font-mono text-[11px] text-center text-text-muted"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
              >
                {hourly24.map((h, i) => {
                  const hour = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={`h-lbl-${i}`} className="space-y-1">
                      <div className="text-[10px] text-text-secondary truncate">{hour}</div>
                      <span className="material-symbols-outlined text-[16px] text-caution-amber block">
                        {getWeatherIcon(h.weatherCode)}
                      </span>
                      <div className="font-bold text-text-primary text-[11px]">{Math.round(h.temperature)}°</div>
                      <div className="text-[9px] text-blue-400">{h.precipitationProbability}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* View 2: 7-Day Outlook */}
        {forecastView === '7d' && (
          <div className="space-y-3">
            <div className="text-xs font-mono text-text-muted">
              7-Day synoptic outlook for Bhopal, MP (Min / Max Temperature & Daily Precipitation)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {(climateData?.forecast?.daily || []).map((day, idx) => {
                const dateObj = new Date(day.date);
                const dayName = idx === 0 ? 'Today' : dateObj.toLocaleDateString([], { weekday: 'short' });
                const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={day.date}
                    className="p-3.5 rounded-xl bg-surface-elevated border border-border flex flex-col justify-between space-y-2 hover:border-caution-amber/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-caution-amber">{dayName}</span>
                      <span className="font-mono text-[10px] text-text-muted">{dateStr}</span>
                    </div>

                    <div className="flex items-center gap-2 my-1">
                      <span className="material-symbols-outlined text-[26px] text-caution-amber">
                        {getWeatherIcon(day.weatherCode)}
                      </span>
                      <div className="truncate">
                        <div className="font-sans font-bold text-sm text-text-primary">
                          {Math.round(day.tempMax)}° / <span className="text-text-muted text-xs font-normal">{Math.round(day.tempMin)}°</span>
                        </div>
                        <div className="font-sans text-[10px] text-text-muted truncate">
                          {day.weatherDescription}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 text-[10px] font-mono space-y-0.5 text-text-muted">
                      <div className="flex justify-between">
                        <span>Rain Prob:</span>
                        <span className="text-blue-400 font-bold">{day.precipitationProbabilityMax}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Precipitation:</span>
                        <span>{day.precipitationSum} mm</span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Sun:</span>
                        <span>
                          {new Date(day.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(day.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View 3: 5-Day AQ Trend Chart */}
        {forecastView === 'aqTrend' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-text-muted">
              <span>5-Day CAMS Global dispersion projection for Particulate Matter (PM2.5 vs PM10)</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span>PM 2.5 (Fine)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span>PM 10 (Coarse)</span>
                </span>
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <span className="w-4 border-t border-dashed border-red-500" />
                  <span>WHO PM2.5 Guideline (15 µg/m³)</span>
                </span>
              </div>
            </div>

            <div className="h-[200px] w-full bg-surface-elevated/40 rounded-xl border border-border p-3 relative">
              {aqTrendPoints.length > 0 ? (
                <svg className="w-full h-full" viewBox="0 0 1000 160" preserveAspectRatio="none">
                  {/* WHO 24h Guideline Line (15 ug/m3) */}
                  {(() => {
                    const yWho = 150 - (15 / maxPmVal) * 130;
                    return (
                      <line
                        x1="0"
                        y1={yWho}
                        x2="1000"
                        y2={yWho}
                        stroke="#EF4444"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                        opacity={0.6}
                      />
                    );
                  })()}

                  {/* PM10 Line (Yellow) */}
                  {(() => {
                    const points = aqTrendPoints.map((p, i) => {
                      const x = (i + 0.5) * (1000 / aqTrendPoints.length);
                      const y = 150 - (p.pm10 / maxPmVal) * 130;
                      return `${x},${y}`;
                    }).join(' ');
                    return (
                      <polyline
                        fill="none"
                        stroke="#FACC15"
                        strokeWidth="2"
                        strokeOpacity="0.8"
                        points={points}
                      />
                    );
                  })()}

                  {/* PM2.5 Line & Area (Rose) */}
                  {(() => {
                    const pts = aqTrendPoints.map((p, i) => {
                      const x = (i + 0.5) * (1000 / aqTrendPoints.length);
                      const y = 150 - (p.pm25 / maxPmVal) * 130;
                      return { x, y };
                    });
                    const pathD = pts.reduce((acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
                    return (
                      <>
                        <path d={pathD} fill="none" stroke="#F43F5E" strokeWidth="2.5" />
                        {pts.map((p, idx) => (
                          <circle key={`aq-pt-${idx}`} cx={p.x} cy={p.y} r={2.5} fill="#F43F5E" />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-xs font-mono">
                  NO DISPERSION FORECAST POINTS AVAILABLE
                </div>
              )}
            </div>

            {/* Date sample labels */}
            <div className="grid grid-cols-5 gap-2 text-center font-mono text-[11px] text-text-muted">
              {aqTrendPoints.filter((_, i) => i % 8 === 0).slice(0, 5).map((p, i) => (
                <div key={`aq-lbl-${i}`}>
                  {new Date(p.time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION F: DEDICATED SOURCE-ISOLATED HARDWARE SENSOR PANEL */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              hardware?.status === 'SENSOR_CONNECTED'
                ? 'bg-emerald-400 animate-pulse'
                : hardware?.status === 'SENSOR_STALE'
                ? 'bg-yellow-400'
                : 'bg-slate-600'
            }`} />
            <div>
              <h3 className="font-sans font-bold text-sm text-white tracking-wide uppercase">
                AIRFRAME ON-BOARD ENVIRONMENTAL PAYLOAD (BMP280 / HYGROMETER)
              </h3>
              <p className="font-sans text-[11px] text-slate-400">
                Source-isolated micro-elevation telemetry from drone hardware bus. Never mixed with Bhopal regional API models.
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase ${
            hardware?.status === 'SENSOR_CONNECTED'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : hardware?.status === 'SENSOR_STALE'
              ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
              : 'bg-slate-800 border border-slate-700 text-slate-400'
          }`}>
            PAYLOAD STATUS: {hardware?.status || 'SENSOR_NOT_CONNECTED'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-slate-400 uppercase">PAYLOAD TEMPERATURE</span>
            <div className="text-2xl font-bold text-white font-sans">
              {hardware?.readings?.temperature !== undefined ? `${hardware.readings.temperature.toFixed(1)}°C` : '--'}
            </div>
            <span className="text-[10px] text-slate-500">
              {hardware?.status === 'SENSOR_CONNECTED' ? 'I2C BMP280 Live Reading' : 'SENSOR NOT CONNECTED'}
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-slate-400 uppercase">PAYLOAD HUMIDITY</span>
            <div className="text-2xl font-bold text-white font-sans">
              {hardware?.readings?.humidity !== undefined ? `${hardware.readings.humidity.toFixed(1)}%` : '--'}
            </div>
            <span className="text-[10px] text-slate-500">
              {hardware?.status === 'SENSOR_CONNECTED' ? 'Airframe Hygrometer Active' : 'SENSOR NOT CONNECTED'}
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-1">
            <span className="text-[11px] text-slate-400 uppercase">PAYLOAD BAROMETRIC PRESSURE</span>
            <div className="text-2xl font-bold text-white font-sans">
              {hardware?.readings?.pressure !== undefined ? `${hardware.readings.pressure.toFixed(1)} hPa` : '--'}
            </div>
            <span className="text-[10px] text-slate-500">
              {hardware?.status === 'SENSOR_CONNECTED' ? 'Barometric Telemetry Stream' : 'SENSOR NOT CONNECTED'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
          <span>{hardware?.notes || 'Hardware sensor stream isolated from API mesoscale metrics.'}</span>
          <div className="flex items-center gap-3 text-slate-500">
            {hardware?.droneId && <span>Airframe: {hardware.droneId}</span>}
            {hardware?.lastReadingAt && (
              <span>Last Sync: {new Date(hardware.lastReadingAt).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* SECTION G: PROVIDERS, ATTRIBUTION & CC BY 4.0 LICENSING */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono text-text-muted">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-caution-amber">verified</span>
          <span>
            DATA PROVIDERS: Weather via <strong>Open-Meteo</strong> & Air Quality via <strong>Copernicus Atmosphere Monitoring Service (CAMS)</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-caution-amber hover:underline flex items-center gap-1"
          >
            <span>Open-Meteo (CC BY 4.0)</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
          <span>•</span>
          <a
            href="https://atmosphere.copernicus.eu/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-caution-amber hover:underline flex items-center gap-1"
          >
            <span>Copernicus CAMS</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>

      {/* SECTION H: ACTIVE CLIMATE MISSIONS */}
      <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-caution-amber animate-pulse" />
            <span>Active Micro-Climate Sorties</span>
          </h3>
          <span className="text-text-muted font-sans text-xs">{missions.length} sorties logged</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-text-muted animate-pulse font-mono text-xs">
            SYNCHRONIZING MICRO-CLIMATE SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-text-muted font-mono text-xs">
            NO ACTIVE MICRO-CLIMATE SORTIES LOGGED.
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-4 rounded-xl bg-surface-elevated border border-border/80 border-l-4 border-l-caution-amber flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-caution-amber font-bold">{m.missionId}</span>
                    <span className="text-text-muted">|</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.status === 'ACTIVE'
                        ? 'bg-caution-amber/15 text-caution-amber border border-caution-amber/30'
                        : 'bg-surface text-text-muted border border-border'
                    }`}>
                      {m.status}
                    </span>
                    <span className="text-text-secondary text-[11px]">STAGE {m.stage}/8 ({m.stageLabel})</span>
                  </div>
                  <h4 className="font-sans font-bold text-sm text-text-primary">{m.title}</h4>
                  <p className="font-sans text-xs text-text-muted leading-relaxed max-w-3xl">{m.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-text-muted text-[11px] font-mono">
                    AIRFRAME: <strong className="text-text-primary">{m.assignedDrones?.[0]?.displayName || m.assignedDrones?.[0]?.droneId || 'Unassigned'}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateMissionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => loadData(false)}
        defaultCategory="MICRO_CLIMATE"
      />
    </div>
  );
};

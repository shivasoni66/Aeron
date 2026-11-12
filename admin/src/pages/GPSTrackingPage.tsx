import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { fetchLatestTelemetry } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { useHardware } from '../context/HardwareContext';
import { TelemetryData } from '../types';
import { SimulatorControlWidget } from '../components/SimulatorControlWidget';

const BENCH_ORIGIN: [number, number] = [12.9716, 77.5946];

export const GPSTrackingPage: React.FC = () => {
  const { isOnline } = useHardware();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const droneMarkerRef = useRef<L.Marker | null>(null);
  const breadcrumbPolylineRef = useRef<L.Polyline | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);
  const [showGeofence, setShowGeofence] = useState<boolean>(true);
  const [hasGpsFix, setHasGpsFix] = useState<boolean>(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: BENCH_ORIGIN,
      zoom: 16,
      zoomControl: false
    });

    // Esri World Dark Gray Base (clean aerospace dark basemap, zero watermark)
    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 16,
        maxZoom: 19,
        attribution: '&copy; Esri, DeLorme, NAVTEQ &bull; OpenStreetMap'
      }
    ).addTo(map);

    tileLayer.on('tileerror', (error: any) => {
      if (error.tile && error.coords) {
        const z = error.coords.z;
        const x = error.coords.x;
        const y = error.coords.y;
        (error.tile as HTMLImageElement).src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      }
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Bench Origin Reference Marker
    const originIcon = L.divIcon({
      className: 'bench-marker',
      html: `<div style="background-color: #789BFF; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #0D141B; box-shadow: 0 0 12px rgba(120,155,255,0.8);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    L.marker(BENCH_ORIGIN, { icon: originIcon })
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 11px; color: #111512; padding: 2px;">
          <strong>Bench Launch Reference</strong>
          <div style="font-size: 10px; color: #555;">[12.9716° N, 77.5946° E]</div>
        </div>`
      )
      .addTo(map);

    // 500m Geofence Perimeter
    const geofence = L.circle(BENCH_ORIGIN, {
      radius: 500,
      color: '#BFF42E',
      fillColor: '#BFF42E',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '5, 8'
    }).addTo(map);
    geofenceCircleRef.current = geofence;

    // Breadcrumb Polyline (Telemetry Cyan)
    const polyline = L.polyline([], {
      color: '#35C6D8',
      weight: 3,
      opacity: 0.9
    }).addTo(map);
    breadcrumbPolylineRef.current = polyline;

    // Drone Aircraft Marker (not placed on map until valid fix arrives)
    const droneIcon = L.divIcon({
      className: 'drone-marker',
      html: `<div style="background-color: #BFF42E; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #0D141B; box-shadow: 0 0 16px rgba(191,244,46,0.9); display: flex; align-items: center; justify-content: center; font-size: 10px; color: #0D141B;">✈</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    const marker = L.marker(BENCH_ORIGIN, { icon: droneIcon });
    droneMarkerRef.current = marker;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const res = await fetchLatestTelemetry('AERON-HEX-01');
        if (isMounted && res.telemetry) {
          handleIncomingPoint(res.telemetry);
        }
      } catch (err) {
        console.warn('[GPSTracking] Failed to fetch latest telemetry:', err);
      }
    };

    loadInitial();

    const cleanup = subscribeToDroneTelemetry('AERON-HEX-01', (packet: any) => {
      if (isMounted && packet) {
        handleIncomingPoint(packet as TelemetryData);
      }
    });

    const handleIncomingPoint = (t: TelemetryData) => {
      setTelemetry((prev) => ({ ...prev, ...t }));
      const lat = t.latitude;
      const lon = t.longitude;
      const hasFix = !!lat && !!lon && t.gpsFixType !== 'NO FIX';
      setHasGpsFix(hasFix);

      if (lat && lon && hasFix && mapInstanceRef.current && droneMarkerRef.current) {
        const pos: [number, number] = [lat, lon];
        droneMarkerRef.current.setLatLng(pos);

        const isSim = t.isSimulated ?? true;
        const color = isSim ? '#F2B95F' : '#BFF42E';
        const shadow = isSim ? 'rgba(242,185,95,0.9)' : 'rgba(191,244,46,0.9)';
        const rot = t.heading !== undefined ? t.heading : 0;
        const updatedIcon = L.divIcon({
          className: 'drone-marker',
          html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #0D141B; box-shadow: 0 0 16px ${shadow}; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #0D141B; font-weight: bold; transform: rotate(${rot}deg); transition: transform 0.3s ease;">➤</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        droneMarkerRef.current.setIcon(updatedIcon);

        if (!mapInstanceRef.current.hasLayer(droneMarkerRef.current)) {
          droneMarkerRef.current.addTo(mapInstanceRef.current);
        }

        setBreadcrumbs((prev) => {
          const next = [...prev, pos];
          if (breadcrumbPolylineRef.current) {
            breadcrumbPolylineRef.current.setLatLngs(next);
          }
          return next;
        });
      }
    };

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!geofenceCircleRef.current || !mapInstanceRef.current) return;
    if (showGeofence) {
      geofenceCircleRef.current.addTo(mapInstanceRef.current);
    } else {
      geofenceCircleRef.current.remove();
    }
  }, [showGeofence]);

  const handleCenter = () => {
    if (!mapInstanceRef.current) return;
    if (telemetry?.latitude && telemetry?.longitude) {
      mapInstanceRef.current.setView([telemetry.latitude, telemetry.longitude], 17);
    } else {
      mapInstanceRef.current.setView(BENCH_ORIGIN, 16);
    }
  };

  const handleClearTrack = () => {
    setBreadcrumbs([]);
    if (breadcrumbPolylineRef.current) {
      breadcrumbPolylineRef.current.setLatLngs([]);
    }
  };

  const sats = isOnline && telemetry?.satellites !== undefined ? `${telemetry.satellites} Sats` : (isOnline ? 'Searching' : '—');
  const fixType = isOnline ? (telemetry?.gpsFixType || (hasGpsFix ? '3D Fix' : 'Searching')) : 'Standby';
  const hdop = isOnline && telemetry?.hdop !== undefined ? telemetry.hdop.toFixed(2) : '—';
  const latStr = isOnline && hasGpsFix && telemetry?.latitude !== undefined ? `${telemetry.latitude.toFixed(6)}° N` : '—';
  const lonStr = isOnline && hasGpsFix && telemetry?.longitude !== undefined ? `${telemetry.longitude.toFixed(6)}° E` : '—';
  const alt = isOnline && telemetry?.relativeAltitude !== undefined ? `${telemetry.relativeAltitude.toFixed(1)} m` : '—';
  const speed = isOnline && telemetry?.groundSpeed !== undefined ? `${telemetry.groundSpeed.toFixed(1)} m/s` : '—';
  const heading = isOnline && telemetry?.heading !== undefined ? `${Math.round(telemetry.heading)}°` : '—';

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">share_location</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Tactical GPS Tracking & Geofence
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            U-Blox NEO-M8N GNSS Constellation Monitor • 500m Perimeter Geofence
          </p>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs">
          <button
            onClick={handleCenter}
            className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-muted text-text-primary rounded-lg border border-border flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-accent-primary">my_location</span>
            <span>Center vehicle</span>
          </button>
          <button
            onClick={handleClearTrack}
            className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-muted text-text-secondary hover:text-text-primary rounded-lg border border-border flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">clear_all</span>
            <span>Clear breadcrumb</span>
          </button>
          <button
            onClick={() => setShowGeofence(!showGeofence)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-2 transition-colors ${
              showGeofence
                ? 'bg-accent-primary text-background border-accent-soft font-semibold'
                : 'bg-surface-elevated text-text-muted border-border'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">shield</span>
            <span>Geofence (500m)</span>
          </button>
        </div>
      </div>

      {/* Simulator Bench Control Panel */}
      <SimulatorControlWidget />

      {/* Main Map & Navigation HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leaflet Map Container (8 Cols) */}
        <div className="lg:col-span-8 bg-surface rounded-xl border border-border relative h-[560px] overflow-hidden flex flex-col shadow-sm">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Status Warning if no fix */}
          {!hasGpsFix && (
            <div className="absolute top-4 left-4 z-20 bg-surface/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-warning/40 flex items-center gap-2.5 font-sans text-xs shadow-lg">
              <span className="material-symbols-outlined text-warning text-[18px]">gps_not_fixed</span>
              <span className="text-warning font-semibold">
                {isOnline ? 'Awaiting 3D GPS fix — Bench reference active' : 'GPS receiver standby — Bench launch site active'}
              </span>
            </div>
          )}

          {/* Floating Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-surface/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-border flex items-center gap-4 font-sans text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-primary shadow-[0_0_8px_rgba(181,222,83,0.8)]" />
              <span className="text-text-primary font-medium">HEX-01 Aircraft</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-info shadow-[0_0_8px_rgba(121,170,203,0.8)]" />
              <span className="text-text-primary font-medium">GCS Station</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-accent-primary" />
              <span className="text-text-secondary">500m Geofence</span>
            </div>
          </div>
        </div>

        {/* Tactical GNSS Metrics Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Constellation Diagnostics Card */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="font-bold text-sm text-text-primary">
                GNSS Constellation Status
              </span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                hasGpsFix ? 'bg-success/15 text-success border border-success/30' : 'bg-surface-elevated text-text-muted border border-border'
              }`}>
                {fixType}
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Satellites in view:</span>
                <span className="text-accent-primary font-mono font-bold">{sats}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Horizontal dilution (HDOP):</span>
                <span className="text-text-primary font-mono font-bold">{hdop}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Receiver chipset:</span>
                <span className="text-text-primary">U-Blox NEO-M8N (UART @ 38400)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Ephemeris health:</span>
                <span className={`font-semibold ${isOnline ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline ? 'Nominal' : 'Standby (Pre-flight)'}
                </span>
              </div>
            </div>
          </div>

          {/* Positional Coordinates Card */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="font-bold text-sm text-text-primary">
                Real-Time Geodetic Vector
              </span>
              <span className="text-[11px] text-text-muted font-mono">
                {hasGpsFix ? 'Live 3D Fix' : 'Bench: 12.9716° N, 77.5946° E'}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Latitude:</span>
                <span className="text-text-primary font-mono font-bold">{latStr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Longitude:</span>
                <span className="text-text-primary font-mono font-bold">{lonStr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Altitude (AGL):</span>
                <span className="text-accent-primary font-mono font-bold">{alt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Ground speed:</span>
                <span className="text-text-primary font-mono font-bold">{speed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Heading azimuth:</span>
                <span className="text-text-primary font-mono font-bold">{heading}</span>
              </div>
            </div>
          </div>

          {/* Breadcrumb Buffer Info */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-2.5 font-sans text-xs text-text-secondary">
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Track samples:</span>
              <span className="text-accent-primary font-mono font-bold">{breadcrumbs.length} points</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Geofence limit:</span>
              <span className="text-text-primary font-bold">500m radius</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Failsafe action:</span>
              <span className="text-success font-semibold">RTL on boundary</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { fetchLatestTelemetry } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { TelemetryData } from '../types';

const BENCH_ORIGIN: [number, number] = [12.9716, 77.5946];

export const GPSTrackingPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const droneMarkerRef = useRef<L.Marker | null>(null);
  const breadcrumbPolylineRef = useRef<L.Polyline | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);

  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);
  const [showGeofence, setShowGeofence] = useState<boolean>(true);
  const [hasGpsFix, setHasGpsFix] = useState<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: BENCH_ORIGIN,
      zoom: 16,
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Bench Origin Marker
    const originIcon = L.divIcon({
      className: 'bench-marker',
      html: `<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 8px #3b82f6;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker(BENCH_ORIGIN, { icon: originIcon })
      .bindPopup('<strong style="color: #000;">BENCH ORIGIN // GCS STATION</strong>')
      .addTo(map);

    // Geofence Circle (500m)
    const geofence = L.circle(BENCH_ORIGIN, {
      radius: 500,
      color: '#bff42e',
      fillColor: '#bff42e',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '4, 6'
    }).addTo(map);
    geofenceCircleRef.current = geofence;

    // Breadcrumb Polyline
    const polyline = L.polyline([], {
      color: '#bff42e',
      weight: 3,
      opacity: 0.8
    }).addTo(map);
    breadcrumbPolylineRef.current = polyline;

    // Drone Marker
    const droneIcon = L.divIcon({
      className: 'drone-marker',
      html: `<div style="background-color: #bff42e; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #131313; box-shadow: 0 0 12px #bff42e;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    const marker = L.marker(BENCH_ORIGIN, { icon: droneIcon }).addTo(map);
    droneMarkerRef.current = marker;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Telemetry and GPS updates
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

      if (lat && lon && mapInstanceRef.current && droneMarkerRef.current) {
        const pos: [number, number] = [lat, lon];
        droneMarkerRef.current.setLatLng(pos);

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

  // Geofence toggle
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

  const sats = telemetry?.satellites ?? 0;
  const fixType = telemetry?.gpsFixType || (hasGpsFix ? '3D FIX' : 'NO FIX');
  const hdop = telemetry?.hdop !== undefined ? telemetry.hdop.toFixed(2) : '--';
  const latStr = telemetry?.latitude !== undefined ? telemetry.latitude.toFixed(6) : `${BENCH_ORIGIN[0].toFixed(6)} (BENCH)`;
  const lonStr = telemetry?.longitude !== undefined ? telemetry.longitude.toFixed(6) : `${BENCH_ORIGIN[1].toFixed(6)} (BENCH)`;
  const alt = telemetry?.relativeAltitude !== undefined ? telemetry.relativeAltitude.toFixed(1) : '--';
  const speed = telemetry?.groundSpeed !== undefined ? telemetry.groundSpeed.toFixed(1) : '--';
  const heading = telemetry?.heading !== undefined ? Math.round(telemetry.heading) : 0;

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">share_location</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              TACTICAL GPS TRACKING & GEOFENCE
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            U-BLOX NEO-M8N GNSS CONSTELLATION MONITOR // 500M PERIMETER GEOFENCE
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCenter}
            className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">my_location</span>
            <span>CENTER VEHICLE</span>
          </button>
          <button
            onClick={handleClearTrack}
            className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">clear_all</span>
            <span>CLEAR BREADCRUMB</span>
          </button>
          <button
            onClick={() => setShowGeofence(!showGeofence)}
            className={`px-3 py-1.5 rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-colors ${
              showGeofence ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-variant text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">shield</span>
            <span>GEOFENCE (500M)</span>
          </button>
        </div>
      </div>

      {/* Main Map & Navigation HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Leaflet Map Container (8 Cols) */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded border border-outline-variant/30 relative h-[520px] overflow-hidden flex flex-col">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Status Warning if no fix */}
          {!hasGpsFix && (
            <div className="absolute top-4 left-4 z-20 bg-surface-container-lowest/90 backdrop-blur-md px- space-sm py-2 rounded border border-amber-400/50 flex items-center gap-2 font-label-telemetry text-[11px] shadow-lg">
              <span className="material-symbols-outlined text-amber-400 text-[18px]">gps_not_fixed</span>
              <span className="text-amber-300">AWAITING 3D GPS FIX — DISPLAYING GROUND BENCH REFERENCE</span>
            </div>
          )}

          {/* Floating Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-2 rounded border border-outline-variant/30 flex items-center gap-4 font-label-telemetry text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_6px_#bff42e]" />
              <span className="text-on-surface">DRONE (AERON-HEX-01)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
              <span className="text-on-surface">BENCH GCS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-primary-fixed" />
              <span className="text-on-surface">500M GEOFENCE</span>
            </div>
          </div>
        </div>

        {/* Tactical GNSS Metrics Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-space-md">
          {/* Constellation Diagnostics Card */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2">
              <span className="text-on-surface font-bold uppercase">GNSS CONSTELLATION STATUS</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                hasGpsFix ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
              }`}>
                {fixType}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">SATELLITES LOCKED</span>
                <span className="text-primary-fixed font-bold">{sats} SATELLITES</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">HORIZONTAL DILUTION (HDOP)</span>
                <span className="text-on-surface font-bold">{hdop}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">RECEIVER CHIPSET</span>
                <span className="text-on-surface">U-BLOX NEO-M8N (UART @ 38400)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">EPHEMERIS HEALTH</span>
                <span className="text-primary-fixed">NOMINAL</span>
              </div>
            </div>
          </div>

          {/* Positional Coordinates Card */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              REAL-TIME GEODETIC VECTOR
            </span>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">LATITUDE</span>
                <span className="text-on-surface font-bold">{latStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">LONGITUDE</span>
                <span className="text-on-surface font-bold">{lonStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">ALTITUDE (AGL)</span>
                <span className="text-primary-fixed font-bold">{alt} M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">GROUND SPEED</span>
                <span className="text-on-surface font-bold">{speed} M/S</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">HEADING AZIMUTH</span>
                <span className="text-on-surface font-bold">{heading}°</span>
              </div>
            </div>
          </div>

          {/* Breadcrumb Buffer Info */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-1 font-label-telemetry text-[11px]">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">TRACK SAMPLES</span>
              <span className="text-primary-fixed font-bold">{breadcrumbs.length} POINTS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">GEOFENCE LIMIT</span>
              <span className="text-on-surface font-bold">500M RADIUS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">FAILSAFE ACTION</span>
              <span className="text-primary-fixed font-bold">RTL TRIGGER</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


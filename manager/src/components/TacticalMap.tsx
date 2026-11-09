import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MarkerItem {
  lat: number;
  lng: number;
  title: string;
  type?: 'DRONE' | 'INCIDENT' | 'WAYPOINT' | 'TARGET';
}

interface TacticalMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MarkerItem[];
  polygonCoords?: number[][]; // [[lat, lng], [lat, lng], ...]
  routeCoords?: [number, number][]; // [[lat, lng], ...]
  className?: string;
  emptyNotice?: string;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  center = [48.1371, 11.5761],
  zoom = 14,
  markers = [],
  polygonCoords,
  routeCoords,
  className = 'h-full w-full min-h-[300px]',
  emptyNotice
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(center, zoom);

      // CartoDB Dark Matter tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView(center, zoom);
    }

    const map = mapInstanceRef.current;

    // Clear previous layers
    const layerGroup = L.layerGroup().addTo(map);

    // Operational Polygon
    if (polygonCoords && polygonCoords.length >= 3) {
      const latLngs = polygonCoords.map((c) => [c[0], c[1]] as [number, number]);
      L.polygon(latLngs, {
        color: '#bff42e',
        weight: 1.5,
        fillColor: '#bff42e',
        fillOpacity: 0.12,
        dashArray: '4, 4'
      }).addTo(layerGroup);
    }

    // Route Polyline
    if (routeCoords && routeCoords.length >= 2) {
      L.polyline(routeCoords, {
        color: '#bff42e',
        weight: 2.5,
        opacity: 0.8
      }).addTo(layerGroup);
    }

    // Custom Markers
    markers.forEach((m) => {
      const isDrone = m.type === 'DRONE';
      const isIncident = m.type === 'INCIDENT';

      const iconHtml = isDrone
        ? `<div style="background-color: #bff42e; color: #151f00; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(191,244,46,0.6); font-family: monospace; font-size: 11px; font-weight: bold;">✈</div>`
        : isIncident
        ? `<div style="background-color: #ffb4ab; color: #690005; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(255,180,171,0.5); font-family: monospace; font-size: 11px; font-weight: bold;">!</div>`
        : `<div style="background-color: #202020; border: 2px solid #bff42e; border-radius: 50%; width: 14px; height: 14px;"></div>`;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-tactical-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([m.lat, m.lng], { icon: customIcon })
        .addTo(layerGroup)
        .bindPopup(`<div style="font-family: monospace; font-size: 11px; color: #000;"><strong>${m.title}</strong><br/>${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</div>`);
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [center, zoom, markers, polygonCoords, routeCoords]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded border border-surface-variant/40 ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />
      {emptyNotice && markers.length === 0 && (!routeCoords || routeCoords.length === 0) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-lowest/70 backdrop-blur-sm pointer-events-none p-4 text-center">
          <div className="font-label-telemetry text-xs text-on-surface-variant max-w-sm">
            <span className="material-symbols-outlined text-[28px] text-outline block mb-1">map</span>
            {emptyNotice}
          </div>
        </div>
      )}
    </div>
  );
};


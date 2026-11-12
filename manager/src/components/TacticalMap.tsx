import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MarkerItem {
  lat: number;
  lng: number;
  title: string;
  type?: 'DRONE' | 'INCIDENT' | 'WAYPOINT' | 'TARGET';
  heading?: number;
  isSimulated?: boolean;
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
  center = [12.9716, 77.5946],
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

      // Esri World Dark Gray Base tile layer (aeronautical grade dark basemap, zero watermark)
      const tileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 16,
          maxZoom: 19,
          attribution: '&copy; Esri, DeLorme, NAVTEQ &bull; OpenStreetMap'
        }
      ).addTo(map);

      // Graceful fallback to OpenStreetMap if primary tile server is unreachable
      tileLayer.on('tileerror', (error: any) => {
        if (error.tile && error.coords) {
          const z = error.coords.z;
          const x = error.coords.x;
          const y = error.coords.y;
          (error.tile as HTMLImageElement).src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        }
      });

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
        color: '#BFF42E',
        weight: 1.5,
        fillColor: '#BFF42E',
        fillOpacity: 0.1,
        dashArray: '5, 5'
      }).addTo(layerGroup);
    }

    // Route Polyline
    if (routeCoords && routeCoords.length >= 2) {
      L.polyline(routeCoords, {
        color: '#35C6D8',
        weight: 2.5,
        opacity: 0.9
      }).addTo(layerGroup);
    }

    // Custom Markers
    markers.forEach((m) => {
      const isDrone = m.type === 'DRONE';
      const isIncident = m.type === 'INCIDENT';
      const isWaypoint = m.type === 'WAYPOINT';

      const droneBg = m.isSimulated ? '#F2B95F' : '#BFF42E';
      const droneShadow = m.isSimulated ? 'rgba(242,185,95,0.8)' : 'rgba(191,244,46,0.8)';
      const rotation = m.heading !== undefined ? m.heading : 0;

      const iconHtml = isDrone
        ? `<div style="background-color: ${droneBg}; color: #0D141B; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px ${droneShadow}; font-family: monospace; font-size: 13px; font-weight: bold; transform: rotate(${rotation}deg); transition: transform 0.3s ease;">➤</div>`
        : isIncident
        ? `<div style="background-color: #F07878; color: #FFFFFF; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(240,120,120,0.6); font-family: monospace; font-size: 11px; font-weight: bold;">!</div>`
        : isWaypoint
        ? `<div style="background-color: #192631; border: 2px solid #789BFF; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(120,155,255,0.5);"><div style="width: 6px; height: 6px; background-color: #789BFF; border-radius: 50%;"></div></div>`
        : `<div style="background-color: #192631; border: 2px solid #BFF42E; border-radius: 50%; width: 14px; height: 14px;"></div>`;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-tactical-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([m.lat, m.lng], { icon: customIcon })
        .addTo(layerGroup)
        .bindPopup(
          `<div style="font-family: monospace; font-size: 11px; color: #111512; padding: 2px;">
            <strong>${m.title}</strong>
            <div style="font-size: 9px; color: #555;">[${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}]</div>
          </div>`
        );
    });

    return () => {
      map.removeLayer(layerGroup);
    };
  }, [center, zoom, markers, polygonCoords, routeCoords]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border bg-[#0D100E] ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full" />
      {emptyNotice && (
        <div className="absolute top-3 left-3 z-[400] bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-text-secondary">
          {emptyNotice}
        </div>
      )}
    </div>
  );
};

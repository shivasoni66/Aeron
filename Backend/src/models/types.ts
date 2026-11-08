/**
 * AERON Database Architecture - Shared Geospatial & Enums
 */

export interface IGeoJSONPoint {
  type: 'Point';
  /**
   * Coordinates in GeoJSON format: [longitude, latitude]
   * Longitude: -180.0 to 180.0
   * Latitude: -90.0 to 90.0
   */
  coordinates: [number, number];
}

export interface IGeoJSONPolygon {
  type: 'Polygon';
  /**
   * Coordinates array of linear rings: [[[longitude, latitude], ...]]
   */
  coordinates: [number, number][][];
}

export interface IGeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}

export const isValidGeoJSONPoint = (point?: IGeoJSONPoint | null): boolean => {
  if (!point) return false;
  if (point.type !== 'Point') return false;
  if (!Array.isArray(point.coordinates) || point.coordinates.length !== 2) return false;

  const [lon, lat] = point.coordinates;
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  if (isNaN(lon) || isNaN(lat)) return false;
  if (lon < -180 || lon > 180) return false;
  if (lat < -90 || lat > 90) return false;

  return true;
};


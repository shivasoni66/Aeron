import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { TelemetryRecord } from '../../src/models/TelemetryRecord.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { EnvironmentalService, BhopalMicroClimateResponse } from '../../src/services/environmental.service.js';

describe('AERON Micro-Climate — Bhopal Weather & Air Quality API Suite', () => {
  const app = createApp();

  const dummyManagerId = new mongoose.Types.ObjectId().toString();
  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const managerToken = signAccessToken(dummyManagerId, 'manager');
  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === dummyManagerId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyManagerId),
          email: 'manager@aeron.internal',
          name: 'Operations Manager',
          role: 'manager',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyCitizenId),
          email: 'citizen@aeron.internal',
          name: 'Citizen User',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  describe('Security & RBAC Enforcement', () => {
    it('STRICTLY BLOCKS unauthenticated requests to /manager/environmental/bhopal (401)', async () => {
      const res = await request(app).get('/api/v1/manager/environmental/bhopal');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('STRICTLY BLOCKS citizen accounts from manager environmental telemetry (403)', async () => {
      const res = await request(app)
        .get('/api/v1/manager/environmental/bhopal')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('GET /api/v1/manager/environmental/bhopal', () => {
    it('returns full strongly-typed Bhopal environmental response with Open-Meteo & CAMS data', async () => {
      // Mock live Open-Meteo calls to guarantee deterministic offline testing
      vi.spyOn(EnvironmentalService, 'fetchBhopalWeather').mockResolvedValue({
        elevation: 505,
        current: {
          time: '2026-11-18T15:00',
          temperature_2m: 27.5,
          relative_humidity_2m: 35,
          apparent_temperature: 26.2,
          is_day: 1,
          precipitation: 0.0,
          rain: 0.0,
          showers: 0.0,
          weather_code: 0,
          cloud_cover: 5,
          pressure_msl: 1016.4,
          wind_speed_10m: 11.5,
          wind_direction_10m: 45,
          wind_gusts_10m: 25.0
        },
        hourly: {
          time: ['2026-11-18T15:00', '2026-11-18T16:00'],
          temperature_2m: [27.5, 26.0],
          relative_humidity_2m: [35, 40],
          precipitation_probability: [0, 5],
          precipitation: [0, 0],
          weather_code: [0, 1],
          wind_speed_10m: [11.5, 10.0],
          wind_direction_10m: [45, 50],
          uv_index: [3.5, 1.2]
        },
        daily: {
          time: ['2026-11-18', '2026-11-19'],
          weather_code: [0, 1],
          temperature_2m_max: [28.5, 29.0],
          temperature_2m_min: [14.5, 15.0],
          precipitation_sum: [0, 0],
          precipitation_probability_max: [5, 10],
          sunrise: ['2026-11-18T06:35', '2026-11-19T06:36'],
          sunset: ['2026-11-18T17:35', '2026-11-19T17:35']
        }
      });

      vi.spyOn(EnvironmentalService, 'fetchBhopalAirQuality').mockResolvedValue({
        current: {
          time: '2026-11-18T15:00',
          us_aqi: 115,
          european_aqi: 65,
          pm10: 42.0,
          pm2_5: 35.0,
          carbon_monoxide: 195.0,
          nitrogen_dioxide: 1.5,
          sulphur_dioxide: 6.8,
          ozone: 128.0,
          dust: 12.0,
          uv_index: 3.2
        },
        hourly: {
          time: ['2026-11-18T15:00', '2026-11-18T16:00'],
          us_aqi: [115, 110],
          european_aqi: [65, 62],
          pm10: [42.0, 40.0],
          pm2_5: [35.0, 33.0],
          carbon_monoxide: [195.0, 190.0],
          nitrogen_dioxide: [1.5, 1.4],
          sulphur_dioxide: [6.8, 6.5],
          ozone: [128.0, 120.0],
          dust: [12.0, 10.0],
          uv_index: [3.2, 1.0]
        }
      });

      const res = await request(app)
        .get('/api/v1/manager/environmental/bhopal')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const data: BhopalMicroClimateResponse = res.body.data;
      // 1. Location
      expect(data.location.city).toBe('Bhopal');
      expect(data.location.state).toBe('Madhya Pradesh');
      expect(data.location.country).toBe('India');
      expect(data.location.latitude).toBe(23.2599);
      expect(data.location.longitude).toBe(77.4126);
      expect(data.location.timezone).toBe('Asia/Kolkata');

      // 2. Weather
      expect(data.weather.temperature).toBe(27.5);
      expect(data.weather.relativeHumidity).toBe(35);
      expect(data.weather.pressureMsl).toBe(1016.4);
      expect(data.weather.windSpeed).toBe(11.5);
      expect(data.weather.weatherDescription).toBe('Clear sky');

      // 3. Air Quality
      expect(data.airQuality.usAqi).toBe(115);
      expect(data.airQuality.europeanAqi).toBe(65);
      expect(data.airQuality.pm25).toBe(35.0);
      expect(data.airQuality.pm10).toBe(42.0);

      // 4. Forecasts
      expect(data.forecast.hourly.length).toBeGreaterThan(0);
      expect(data.forecast.daily.length).toBeGreaterThan(0);
      expect(data.forecast.airQualityHourly.length).toBeGreaterThan(0);

      // 5. Sources & Licensing
      expect(data.sources.weather.license).toContain('CC BY 4.0');
      expect(data.sources.airQuality.model).toContain('CAMS Global');
      expect(data.sources.airQuality.spatialResolution).toContain('45 km');

      // 6. Hardware Sensor Isolation
      expect(data.hardwareSensors.status).toBe('SENSOR_NOT_CONNECTED');
      expect(data.hardwareSensors.readings).toBeNull();
    });

    it('isolates hardware sensor readings when telemetry is active without overwriting API metrics', async () => {
      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => ({
            droneId: 'AERON-HEX-01',
            recordedAt: new Date(),
            sensorHealth: {
              temperature: 28.2,
              humidity: 38.0,
              pressure: 1015.0
            }
          })
        })
      } as any);

      vi.spyOn(EnvironmentalService, 'fetchBhopalWeather').mockResolvedValue({
        elevation: 505,
        current: { temperature_2m: 25.0, relative_humidity_2m: 40.0, pressure_msl: 1016.0 },
        hourly: { time: [] },
        daily: { time: [] }
      });
      vi.spyOn(EnvironmentalService, 'fetchBhopalAirQuality').mockResolvedValue({
        current: { us_aqi: 90, european_aqi: 50, pm2_5: 25.0, pm10: 35.0 },
        hourly: { time: [] }
      });

      const res = await request(app)
        .get('/api/v1/manager/environmental/bhopal')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      // Primary API remains unchanged
      expect(data.weather.temperature).toBe(25.0);
      // Hardware sensor is reported separately in its own container
      expect(data.hardwareSensors.status).toBe('SENSOR_CONNECTED');
      expect(data.hardwareSensors.source).toBe('AIRFRAME_BMP280_I2C');
      expect(data.hardwareSensors.readings.temperature).toBe(28.2);
    });

    it('returns STALE fallback data if external provider call fails when cached data exists', async () => {
      // Seed service with last good data
      (EnvironmentalService as any).lastGoodMicroClimate = {
        location: { city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', latitude: 23.2599, longitude: 77.4126, timezone: 'Asia/Kolkata', localTime: '' },
        weather: { temperature: 26.0, apparentTemperature: 25.0, relativeHumidity: 30, pressureMsl: 1015, windSpeed: 10, windDirection: 0, windGusts: 15, precipitation: 0, rain: 0, showers: 0, cloudCover: 0, weatherCode: 0, weatherDescription: 'Clear sky', isDay: true, timestamp: '2026-11-18T14:00' },
        airQuality: { usAqi: 100, europeanAqi: 55, pm25: 30, pm10: 40, carbonMonoxide: 180, nitrogenDioxide: 1.0, sulphurDioxide: 5.0, ozone: 110, dust: 10, uvIndex: 2.0, timestamp: '2026-11-18T14:00' },
        forecast: { hourly: [], daily: [], airQualityHourly: [] },
        sources: { weather: {} as any, airQuality: {} as any },
        hardwareSensors: { status: 'SENSOR_NOT_CONNECTED', droneId: null, lastReadingAt: null, readings: null, source: 'NONE', notes: '' },
        status: 'API_CONNECTED',
        summary: { flightAdvisory: 'PERMITTED', advisoryReasons: [], thermalClassification: '', airQualityClassification: '', particulateAlert: false, windAlert: false, rainAlert: false },
        lastFetchedAt: '2026-11-18T14:00:00.000Z',
        cache: {} as any
      };

      vi.spyOn(EnvironmentalService, 'fetchBhopalWeather').mockRejectedValue(new Error('Open-Meteo timeout'));

      const res = await request(app)
        .get('/api/v1/manager/environmental/bhopal')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('API_STALE');
      expect(res.body.data.summary.advisoryReasons[0]).toContain('STALE DATA');
    });
  });
});

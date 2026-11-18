import { logger } from '../utils/logger.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { env } from '../config/env.js';

export interface LocationMetadata {
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  timezone: string;
  localTime: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  pressureMsl: number;
  surfacePressure?: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  precipitation: number;
  rain: number;
  showers: number;
  cloudCover: number;
  weatherCode: number;
  weatherDescription: string;
  isDay: boolean;
  timestamp: string;
}

export interface CurrentAirQuality {
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  carbonMonoxide: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  ozone: number;
  dust: number;
  uvIndex: number;
  timestamp: string;
}

export interface HourlyWeatherForecast {
  time: string;
  temperature: number;
  relativeHumidity: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
  windDirection: number;
  uvIndex: number;
}

export interface DailyWeatherForecast {
  date: string;
  weatherCode: number;
  weatherDescription: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  sunrise: string;
  sunset: string;
}

export interface HourlyAirQualityForecast {
  time: string;
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  carbonMonoxide: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  ozone: number;
  dust: number;
  uvIndex: number;
}

export interface HardwareSensorState {
  status: 'SENSOR_NOT_CONNECTED' | 'SENSOR_CONNECTED' | 'SENSOR_STALE';
  droneId: string | null;
  lastReadingAt: string | null;
  readings: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
  } | null;
  source: 'AIRFRAME_BMP280_I2C' | 'NONE';
  notes: string;
}

export interface EnvironmentalSources {
  weather: {
    provider: string;
    model: string;
    license: string;
    attribution: string;
    url: string;
  };
  airQuality: {
    provider: string;
    model: string;
    domain: string;
    spatialResolution: string;
    temporalResolution: string;
    license: string;
    attribution: string;
    url: string;
  };
}

export interface EnvironmentalStatusSummary {
  flightAdvisory: 'PERMITTED' | 'CAUTION' | 'RESTRICTED';
  advisoryReasons: string[];
  thermalClassification: string;
  airQualityClassification: string;
  particulateAlert: boolean;
  windAlert: boolean;
  rainAlert: boolean;
}

export interface BhopalMicroClimateResponse {
  location: LocationMetadata;
  weather: CurrentWeather;
  airQuality: CurrentAirQuality;
  forecast: {
    hourly: HourlyWeatherForecast[];
    daily: DailyWeatherForecast[];
    airQualityHourly: HourlyAirQualityForecast[];
  };
  sources: EnvironmentalSources;
  hardwareSensors: HardwareSensorState;
  status: 'API_CONNECTED' | 'API_LOADING' | 'API_DELAYED' | 'API_STALE' | 'API_OFFLINE' | 'API_ERROR';
  summary: EnvironmentalStatusSummary;
  lastFetchedAt: string;
  cache: {
    weatherCached: boolean;
    airQualityCached: boolean;
    weatherAgeSeconds: number;
    airQualityAgeSeconds: number;
    weatherExpiresInSeconds: number;
    airQualityExpiresInSeconds: number;
  };
}

// Standard WMO Weather Interpretation Codes (WW)
export const WMO_CODE_MAP: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

export const getWeatherDescription = (code?: number): string => {
  if (code === undefined || code === null) return 'Unknown';
  return WMO_CODE_MAP[code] || `Weather code ${code}`;
};

export class EnvironmentalService {
  // Fixed Bhopal Coordinates and Metadata
  public static readonly BHOPAL_COORDS = {
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    country: 'India',
    latitude: 23.2599,
    longitude: 77.4126,
    timezone: 'Asia/Kolkata'
  };

  // Cache configuration
  private static readonly WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly AQ_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
  private static readonly FORCE_REFRESH_MIN_INTERVAL_MS = 30 * 1000; // 30 seconds rate-limit for manual refresh
  private static readonly HTTP_TIMEOUT_MS = 8000; // 8 seconds fetch timeout

  // In-memory cache structures
  private static weatherCache: {
    data: any;
    fetchedAt: number;
  } | null = null;

  private static aqCache: {
    data: any;
    fetchedAt: number;
  } | null = null;

  private static lastForceRefreshAt: number = 0;
  private static inFlightWeatherPromise: Promise<any> | null = null;
  private static inFlightAqPromise: Promise<any> | null = null;

  // Stale fallback cache (retains last good response even across TTL expiration)
  private static lastGoodMicroClimate: BhopalMicroClimateResponse | null = null;

  /**
   * Fetches weather data from Open-Meteo Weather Forecast API.
   * Uses in-memory cache and in-flight deduplication.
   */
  public static async fetchBhopalWeather(force: boolean = false): Promise<any> {
    const now = Date.now();
    if (!force && this.weatherCache && now - this.weatherCache.fetchedAt < this.WEATHER_CACHE_TTL_MS) {
      return this.weatherCache.data;
    }

    if (this.inFlightWeatherPromise) {
      return this.inFlightWeatherPromise;
    }

    this.inFlightWeatherPromise = (async () => {
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', this.BHOPAL_COORDS.latitude.toString());
        url.searchParams.set('longitude', this.BHOPAL_COORDS.longitude.toString());
        url.searchParams.set(
          'current',
          'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
        );
        url.searchParams.set(
          'hourly',
          'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index'
        );
        url.searchParams.set(
          'daily',
          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset'
        );
        url.searchParams.set('timezone', this.BHOPAL_COORDS.timezone);
        url.searchParams.set('temperature_unit', 'celsius');
        url.searchParams.set('wind_speed_unit', 'kmh');
        url.searchParams.set('precipitation_unit', 'mm');
        url.searchParams.set('forecast_days', '7');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.HTTP_TIMEOUT_MS);

        const resp = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'AERON-GCS/2.4 (Bhopal-MicroClimate; contact@aeron.gov)'
          }
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          throw new Error(`Open-Meteo Weather API HTTP error ${resp.status}`);
        }

        const data = await resp.json();
        this.weatherCache = {
          data,
          fetchedAt: Date.now()
        };
        logger.info(`[ENVIRONMENTAL-SVC] Successfully retrieved fresh weather data for Bhopal (${resp.status})`);
        return data;
      } catch (err: unknown) {
        logger.warn(`[ENVIRONMENTAL-SVC] Failed to fetch live weather from Open-Meteo: ${err instanceof Error ? err.message : err}`);
        if (this.weatherCache) {
          logger.info('[ENVIRONMENTAL-SVC] Returning previous cached weather data under degraded condition');
          return this.weatherCache.data;
        }
        throw err;
      } finally {
        this.inFlightWeatherPromise = null;
      }
    })();

    return this.inFlightWeatherPromise;
  }

  /**
   * Fetches air quality data from Open-Meteo Air Quality API (CAMS Global model).
   */
  public static async fetchBhopalAirQuality(force: boolean = false): Promise<any> {
    const now = Date.now();
    if (!force && this.aqCache && now - this.aqCache.fetchedAt < this.AQ_CACHE_TTL_MS) {
      return this.aqCache.data;
    }

    if (this.inFlightAqPromise) {
      return this.inFlightAqPromise;
    }

    this.inFlightAqPromise = (async () => {
      try {
        const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
        url.searchParams.set('latitude', this.BHOPAL_COORDS.latitude.toString());
        url.searchParams.set('longitude', this.BHOPAL_COORDS.longitude.toString());
        url.searchParams.set('domains', 'cams_global');
        url.searchParams.set(
          'current',
          'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index'
        );
        url.searchParams.set(
          'hourly',
          'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index'
        );
        url.searchParams.set('timezone', this.BHOPAL_COORDS.timezone);
        url.searchParams.set('forecast_days', '5');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.HTTP_TIMEOUT_MS);

        const resp = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'AERON-GCS/2.4 (Bhopal-MicroClimate; contact@aeron.gov)'
          }
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          throw new Error(`Open-Meteo Air Quality API HTTP error ${resp.status}`);
        }

        const data = await resp.json();
        this.aqCache = {
          data,
          fetchedAt: Date.now()
        };
        logger.info(`[ENVIRONMENTAL-SVC] Successfully retrieved fresh CAMS Global air quality for Bhopal (${resp.status})`);
        return data;
      } catch (err: unknown) {
        logger.warn(`[ENVIRONMENTAL-SVC] Failed to fetch air quality from Open-Meteo: ${err instanceof Error ? err.message : err}`);
        if (this.aqCache) {
          logger.info('[ENVIRONMENTAL-SVC] Returning previous cached air quality under degraded condition');
          return this.aqCache.data;
        }
        throw err;
      } finally {
        this.inFlightAqPromise = null;
      }
    })();

    return this.inFlightAqPromise;
  }

  /**
   * Queries genuine physical drone telemetry records for isolated hardware sensor diagnostics.
   */
  public static async getHardwareSensorState(): Promise<HardwareSensorState> {
    try {
      const latestTelemetry = await TelemetryRecord.findOne({
        $or: [
          { 'sensorHealth.temperature': { $exists: true } },
          { 'sensorHealth.humidity': { $exists: true } },
          { 'sensorHealth.pressure': { $exists: true } }
        ]
      })
        .sort({ recordedAt: -1 })
        .lean();

      if (latestTelemetry && latestTelemetry.sensorHealth) {
        const recordedEpoch = new Date(latestTelemetry.recordedAt).getTime();
        const ageSec = (Date.now() - recordedEpoch) / 1000;
        const isStale = ageSec > 30;
        const sh = latestTelemetry.sensorHealth as Record<string, any>;

        return {
          status: isStale ? 'SENSOR_STALE' : 'SENSOR_CONNECTED',
          droneId: latestTelemetry.droneId ? String(latestTelemetry.droneId) : 'AERON-HEX-01',
          lastReadingAt: new Date(latestTelemetry.recordedAt).toISOString(),
          readings: {
            temperature: typeof sh.temperature === 'number' ? sh.temperature : undefined,
            humidity: typeof sh.humidity === 'number' ? sh.humidity : undefined,
            pressure: typeof sh.pressure === 'number' ? sh.pressure : undefined
          },
          source: 'AIRFRAME_BMP280_I2C',
          notes: isStale
            ? `Telemetry is stale (${Math.round(ageSec)}s since last transmission)`
            : 'Live physical sensor streaming via Pixhawk/I2C payload bus'
        };
      }

      return {
        status: 'SENSOR_NOT_CONNECTED',
        droneId: null,
        lastReadingAt: null,
        readings: null,
        source: 'NONE',
        notes: 'No active airframe environmental payload connected. Operating in honest standby.'
      };
    } catch {
      return {
        status: 'SENSOR_NOT_CONNECTED',
        droneId: null,
        lastReadingAt: null,
        readings: null,
        source: 'NONE',
        notes: 'Telemetry database check completed.'
      };
    }
  }

  /**
   * Derives objective environmental advisory and alerts without inventing safety ratings.
   */
  public static deriveStatusSummary(weather: CurrentWeather, aq: CurrentAirQuality): EnvironmentalStatusSummary {
    const reasons: string[] = [];
    let flightAdvisory: 'PERMITTED' | 'CAUTION' | 'RESTRICTED' = 'PERMITTED';

    // Wind constraints
    const windAlert = weather.windSpeed >= 30 || weather.windGusts >= 40;
    if (weather.windSpeed >= 40 || weather.windGusts >= 50) {
      reasons.push(`High sustained winds (${weather.windSpeed} km/h) and gusts (${weather.windGusts} km/h) exceed safe UAV limits`);
      flightAdvisory = 'RESTRICTED';
    } else if (windAlert) {
      reasons.push(`Elevated wind speeds (${weather.windSpeed} km/h) require aerodynamic turbulence compensation`);
      flightAdvisory = 'CAUTION';
    }

    // Precipitation constraints
    const rainAlert = weather.precipitation > 0 || weather.rain > 0 || weather.showers > 0;
    if (weather.precipitation >= 5.0) {
      reasons.push(`Heavy rainfall (${weather.precipitation} mm) active across survey sector`);
      flightAdvisory = 'RESTRICTED';
    } else if (rainAlert) {
      reasons.push(`Active precipitation (${weather.precipitation} mm) detected`);
      if (flightAdvisory === 'PERMITTED') {
        flightAdvisory = 'CAUTION';
      }
    }

    // Particulate constraints
    const particulateAlert = aq.pm25 >= 35.5 || aq.pm10 >= 50;
    if (particulateAlert) {
      reasons.push(`Elevated atmospheric particulates (PM2.5: ${aq.pm25} µg/m³, PM10: ${aq.pm10} µg/m³)`);
    }

    // Thermal classification
    let thermalClassification = 'Pleasant / Moderate';
    if (weather.temperature >= 40) {
      thermalClassification = 'Extreme Heatwave';
      reasons.push(`Extreme ambient air temperature (${weather.temperature}°C)`);
    } else if (weather.temperature >= 35) {
      thermalClassification = 'Elevated Summer Heat';
    } else if (weather.temperature <= 10) {
      thermalClassification = 'Cold Wave Conditions';
    }

    // Air quality classification based on US AQI standards
    let airQualityClassification = 'Good';
    if (aq.usAqi > 300) airQualityClassification = 'Hazardous';
    else if (aq.usAqi > 200) airQualityClassification = 'Very Unhealthy';
    else if (aq.usAqi > 150) airQualityClassification = 'Unhealthy';
    else if (aq.usAqi > 100) airQualityClassification = 'Unhealthy for Sensitive Groups';
    else if (aq.usAqi > 50) airQualityClassification = 'Moderate';

    if (reasons.length === 0) {
      reasons.push('Atmospheric conditions within nominal operational parameters for UAV micro-climate surveys');
    }

    return {
      flightAdvisory,
      advisoryReasons: reasons,
      thermalClassification,
      airQualityClassification,
      particulateAlert,
      windAlert,
      rainAlert
    };
  }

  /**
   * Main facade returning unified, typed, cached Bhopal micro-climate intelligence.
   */
  public static async getBhopalMicroClimate(forceRefresh: boolean = false): Promise<BhopalMicroClimateResponse> {
    const now = Date.now();
    let allowForce = false;

    if (forceRefresh) {
      if (now - this.lastForceRefreshAt >= this.FORCE_REFRESH_MIN_INTERVAL_MS) {
        allowForce = true;
        this.lastForceRefreshAt = now;
      } else {
        logger.info('[ENVIRONMENTAL-SVC] Manual refresh rate limit active (<30s). Serving cached response.');
      }
    }

    let weatherRaw: any = null;
    let aqRaw: any = null;
    let isStale = false;
    let isError = false;

    try {
      [weatherRaw, aqRaw] = await Promise.all([
        this.fetchBhopalWeather(allowForce),
        this.fetchBhopalAirQuality(allowForce)
      ]);
    } catch (fetchErr) {
      logger.error(`[ENVIRONMENTAL-SVC] External API call failed: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}`);
      if (this.lastGoodMicroClimate) {
        logger.info('[ENVIRONMENTAL-SVC] Serving last good cached micro-climate marked as STALE');
        const staleClone: BhopalMicroClimateResponse = {
          ...this.lastGoodMicroClimate,
          status: 'API_STALE',
          summary: {
            ...this.lastGoodMicroClimate.summary,
            advisoryReasons: [
              '[WARNING: STALE DATA] External atmospheric provider connection temporarily delayed; showing last verified readings',
              ...this.lastGoodMicroClimate.summary.advisoryReasons
            ]
          }
        };
        return staleClone;
      }
      isError = true;
      throw new Error(`Atmospheric API provider temporarily unreachable: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown'}`);
    }

    const hwSensors = await this.getHardwareSensorState();

    // Map Current Weather
    const curW = weatherRaw.current || {};
    const currentWeather: CurrentWeather = {
      temperature: curW.temperature_2m ?? 0,
      apparentTemperature: curW.apparent_temperature ?? curW.temperature_2m ?? 0,
      relativeHumidity: curW.relative_humidity_2m ?? 0,
      pressureMsl: curW.pressure_msl ?? 1013.25,
      surfacePressure: curW.surface_pressure,
      windSpeed: curW.wind_speed_10m ?? 0,
      windDirection: curW.wind_direction_10m ?? 0,
      windGusts: curW.wind_gusts_10m ?? curW.wind_speed_10m ?? 0,
      precipitation: curW.precipitation ?? 0,
      rain: curW.rain ?? 0,
      showers: curW.showers ?? 0,
      cloudCover: curW.cloud_cover ?? 0,
      weatherCode: curW.weather_code ?? 0,
      weatherDescription: getWeatherDescription(curW.weather_code),
      isDay: curW.is_day === 1,
      timestamp: curW.time || new Date().toISOString()
    };

    // Map Current Air Quality
    const curAq = aqRaw.current || {};
    const currentAirQuality: CurrentAirQuality = {
      usAqi: curAq.us_aqi ?? 0,
      europeanAqi: curAq.european_aqi ?? 0,
      pm25: curAq.pm2_5 ?? 0,
      pm10: curAq.pm10 ?? 0,
      carbonMonoxide: curAq.carbon_monoxide ?? 0,
      nitrogenDioxide: curAq.nitrogen_dioxide ?? 0,
      sulphurDioxide: curAq.sulphur_dioxide ?? 0,
      ozone: curAq.ozone ?? 0,
      dust: curAq.dust ?? 0,
      uvIndex: curAq.uv_index ?? 0,
      timestamp: curAq.time || new Date().toISOString()
    };

    // Map Hourly Weather Forecast (Up to 48 hours)
    const hourlyRaw = weatherRaw.hourly || {};
    const hourlyTimes: string[] = hourlyRaw.time || [];
    const hourlyCount = Math.min(48, hourlyTimes.length);
    const hourlyForecast: HourlyWeatherForecast[] = [];

    for (let i = 0; i < hourlyCount; i++) {
      hourlyForecast.push({
        time: hourlyTimes[i],
        temperature: hourlyRaw.temperature_2m?.[i] ?? 0,
        relativeHumidity: hourlyRaw.relative_humidity_2m?.[i] ?? 0,
        precipitationProbability: hourlyRaw.precipitation_probability?.[i] ?? 0,
        precipitation: hourlyRaw.precipitation?.[i] ?? 0,
        weatherCode: hourlyRaw.weather_code?.[i] ?? 0,
        weatherDescription: getWeatherDescription(hourlyRaw.weather_code?.[i]),
        windSpeed: hourlyRaw.wind_speed_10m?.[i] ?? 0,
        windDirection: hourlyRaw.wind_direction_10m?.[i] ?? 0,
        uvIndex: hourlyRaw.uv_index?.[i] ?? 0
      });
    }

    // Map Daily Weather Forecast (7 days)
    const dailyRaw = weatherRaw.daily || {};
    const dailyTimes: string[] = dailyRaw.time || [];
    const dailyForecast: DailyWeatherForecast[] = [];

    for (let i = 0; i < dailyTimes.length; i++) {
      dailyForecast.push({
        date: dailyTimes[i],
        weatherCode: dailyRaw.weather_code?.[i] ?? 0,
        weatherDescription: getWeatherDescription(dailyRaw.weather_code?.[i]),
        tempMax: dailyRaw.temperature_2m_max?.[i] ?? 0,
        tempMin: dailyRaw.temperature_2m_min?.[i] ?? 0,
        precipitationSum: dailyRaw.precipitation_sum?.[i] ?? 0,
        precipitationProbabilityMax: dailyRaw.precipitation_probability_max?.[i] ?? 0,
        sunrise: dailyRaw.sunrise?.[i] || '',
        sunset: dailyRaw.sunset?.[i] || ''
      });
    }

    // Map Hourly Air Quality Forecast (Up to 72 hours)
    const aqHourlyRaw = aqRaw.hourly || {};
    const aqHourlyTimes: string[] = aqHourlyRaw.time || [];
    const aqHourlyCount = Math.min(72, aqHourlyTimes.length);
    const aqHourlyForecast: HourlyAirQualityForecast[] = [];

    for (let i = 0; i < aqHourlyCount; i++) {
      aqHourlyForecast.push({
        time: aqHourlyTimes[i],
        usAqi: aqHourlyRaw.us_aqi?.[i] ?? 0,
        europeanAqi: aqHourlyRaw.european_aqi?.[i] ?? 0,
        pm25: aqHourlyRaw.pm2_5?.[i] ?? 0,
        pm10: aqHourlyRaw.pm10?.[i] ?? 0,
        carbonMonoxide: aqHourlyRaw.carbon_monoxide?.[i] ?? 0,
        nitrogenDioxide: aqHourlyRaw.nitrogen_dioxide?.[i] ?? 0,
        sulphurDioxide: aqHourlyRaw.sulphur_dioxide?.[i] ?? 0,
        ozone: aqHourlyRaw.ozone?.[i] ?? 0,
        dust: aqHourlyRaw.dust?.[i] ?? 0,
        uvIndex: aqHourlyRaw.uv_index?.[i] ?? 0
      });
    }

    const summary = this.deriveStatusSummary(currentWeather, currentAirQuality);

    const weatherAge = this.weatherCache ? Math.round((now - this.weatherCache.fetchedAt) / 1000) : 0;
    const aqAge = this.aqCache ? Math.round((now - this.aqCache.fetchedAt) / 1000) : 0;

    const weatherExpiresIn = Math.max(0, Math.round((this.WEATHER_CACHE_TTL_MS - (now - (this.weatherCache?.fetchedAt || now))) / 1000));
    const aqExpiresIn = Math.max(0, Math.round((this.AQ_CACHE_TTL_MS - (now - (this.aqCache?.fetchedAt || now))) / 1000));

    const result: BhopalMicroClimateResponse = {
      location: {
        city: this.BHOPAL_COORDS.city,
        state: this.BHOPAL_COORDS.state,
        country: this.BHOPAL_COORDS.country,
        latitude: this.BHOPAL_COORDS.latitude,
        longitude: this.BHOPAL_COORDS.longitude,
        elevationMeters: weatherRaw.elevation,
        timezone: this.BHOPAL_COORDS.timezone,
        localTime: new Date().toLocaleString('en-IN', { timeZone: this.BHOPAL_COORDS.timezone })
      },
      weather: currentWeather,
      airQuality: currentAirQuality,
      forecast: {
        hourly: hourlyForecast,
        daily: dailyForecast,
        airQualityHourly: aqHourlyForecast
      },
      sources: {
        weather: {
          provider: 'Open-Meteo Weather Forecast API',
          model: 'Seamless Global Blend (ECMWF, GFS, ICON)',
          license: 'CC BY 4.0',
          attribution: 'Weather data by Open-Meteo.com, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0)',
          url: 'https://open-meteo.com/'
        },
        airQuality: {
          provider: 'Open-Meteo Air Quality API / Copernicus Atmosphere Monitoring Service',
          model: 'Copernicus CAMS Global Atmospheric Composition',
          domain: 'cams_global',
          spatialResolution: '~45 km grid cell',
          temporalResolution: '3-hour forecast updates',
          license: 'CC BY 4.0',
          attribution: 'Air quality data by Open-Meteo.com using Copernicus CAMS, licensed under CC BY 4.0',
          url: 'https://open-meteo.com/en/docs/air-quality-api'
        }
      },
      hardwareSensors: hwSensors,
      status: 'API_CONNECTED',
      summary,
      lastFetchedAt: new Date().toISOString(),
      cache: {
        weatherCached: weatherAge > 2,
        airQualityCached: aqAge > 2,
        weatherAgeSeconds: weatherAge,
        airQualityAgeSeconds: aqAge,
        weatherExpiresInSeconds: weatherExpiresIn,
        airQualityExpiresInSeconds: aqExpiresIn
      }
    };

    // Store as last good response for fallback
    this.lastGoodMicroClimate = result;
    return result;
  }
}

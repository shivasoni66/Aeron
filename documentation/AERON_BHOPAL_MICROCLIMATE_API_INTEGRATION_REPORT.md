# AERON — Bhopal Micro-Climate & Air Quality API Integration Report

- **Date:** 2026-11-18
- **Mission Vertical:** M03 / Vertical 04 — Micro-Climate & Atmospheric Survey
- **Target Location:** Bhopal, Madhya Pradesh, India (`23.2599° N, 77.4126° E`, Elevation ~495 m MSL)
- **System Status:** **VERIFIED OPERATIONAL & SOURCE-ISOLATED**

---

## 1. Executive Summary

In accordance with AERON's real-time operational standards, Vertical 04 (Micro-Climate & Heat Island Monitoring) has been upgraded from static or placeholder hardware assumptions to a genuinely operational, dual-stream architecture:

1. **Primary Atmospheric Data Source:** Live external meteorological and atmospheric dispersion data via **Open-Meteo Weather Forecast API** and the **Copernicus Atmosphere Monitoring Service (CAMS Global)** model.
2. **Dedicated Airframe Hardware Payload:** On-board I2C BMP280 barometric/hygrometric sensors on physical drone airframes, strictly source-isolated and reported independently.
3. **Strict Truthfulness & Zero Fabrication:**
   - When no physical drone is broadcasting hardware telemetry, hardware sensors are transparently displayed as `SENSOR_NOT_CONNECTED` or `STANDBY`.
   - Hardware sensor values are **never** blended, synthesized, or substituted into the regional Bhopal meteorological baseline.
   - Air Quality Indices are clearly delineated: **US EPA AQI (0–500 scale)** and **European AQI (0–100 scale)** calculated via Copernicus CAMS Global (~45 km spatial grid). Neither is misrepresented as Indian Central Pollution Control Board (CPCB) National AQI.

---

## 2. Atmospheric & Meteorological Architecture

```
                                  +------------------------------------------------------+
                                  |                 EXTERNAL DATA SOURCES                |
                                  |  - Open-Meteo Weather Forecast (ECMWF / BestMatch)   |
                                  |  - Copernicus Atmosphere Monitoring Service (CAMS)   |
                                  +---------------------------+--------------------------+
                                                              |
                                                    HTTPS REST| (Direct Server-to-Server)
                                                              v
+----------------------------------------------------------------------------------------+
|                                AERON BACKEND (NODE.JS / EXPRESS)                       |
|                                                                                        |
|  [environmental.service.ts]                                                            |
|  - In-Memory Caching (Weather TTL: 15 min, Air Quality TTL: 60 min)                    |
|  - Request Deduplication (In-flight promise sharing)                                    |
|  - Manual Refresh Rate-Limiter (Cooldown: 30s)                                         |
|  - Provider Failover / Stale Cache Fallback (status: 'API_STALE')                       |
|  - Dynamic Flight Advisory Evaluator (PERMITTED / CAUTION / RESTRICTED)                |
|  - Hardware Payload Resolver (Queries latest TelemetryRecord for AERON-HEX-01)          |
|                                                                                        |
|  GET /api/v1/manager/environmental/bhopal                                              |
+-------------------------------------------+--------------------------------------------+
                                            |
                                            | Authenticated JSON
                                            v
+----------------------------------------------------------------------------------------+
|                             AERON MANAGER PORTAL (REACT + VITE)                        |
|                                                                                        |
|  [MicroClimatePage.tsx]                                                                |
|  - Section A: Location & Status Header (Bhopal coordinates, local time, cache stats)   |
|  - Section B: Current Weather Cards (Temp, Feels-like, Humidity, Pressure, Wind, Rain) |
|  - Section C: Air Quality Panel (US EPA AQI, EU AQI, 8-gas pollutant grid)            |
|  - Section D: Forecast Dashboard (24h hourly SVG timeline, 7d outlook, 5d AQ trend)   |
|  - Section E: Flight Advisory Banner (Operational envelope alerts)                     |
|  - Section F: Source-Isolated Hardware Payload Panel (Airframe BMP280 live/standby)    |
|  - Section G: Attribution & CC BY 4.0 Licensing                                        |
|  - Section H: Active Micro-Climate Sorties Catalog                                     |
+----------------------------------------------------------------------------------------+
```

---

## 3. Data Providers & Endpoint Configurations

### A. Weather Forecast API
- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Coordinates:** Latitude `23.2599`, Longitude `77.4126` (Bhopal, MP, India)
- **Timezone:** `Asia/Kolkata`
- **Parameters Queried:**
  - `current`: `temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m`
  - `hourly`: `temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index` (168 hours)
  - `daily`: `weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset` (7 days)
- **License:** CC BY 4.0 Open-Meteo.com

### B. Air Quality & Atmospheric Chemistry API
- **Endpoint:** `https://air-quality-api.open-meteo.com/v1/air-quality`
- **Model Domain:** `domains=cams_global` (Copernicus Atmosphere Monitoring Service)
- **Spatial Resolution:** ~45 km grid cell
- **Temporal Resolution:** 3-hour update cycle
- **Parameters Queried:**
  - `current`: `us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index`
  - `hourly`: `us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index` (120 hours / 5 days)

---

## 4. Backend Implementation Details

### Response Contract (`BhopalMicroClimateResponse`)
```typescript
export interface BhopalMicroClimateResponse {
  location: {
    city: 'Bhopal';
    state: 'Madhya Pradesh';
    country: 'India';
    latitude: 23.2599;
    longitude: 77.4126;
    elevationMeters: 495;
    timezone: 'Asia/Kolkata';
    localTime: string;
  };
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
```

### In-Memory Caching & Rate-Limiting Guard
- In-memory cache ensures zero duplicate requests to Open-Meteo:
  - **Weather data:** TTL 15 minutes (900 seconds)
  - **Air quality data:** TTL 60 minutes (3600 seconds)
- **Request deduplication:** Multiple concurrent requests share the exact same in-flight Promise.
- **Manual force refresh:** Calling `?refresh=true` is guarded by a 30-second cooldown window to prevent upstream provider rate-limit violations.
- **Fault-tolerance:** In the event of upstream network timeouts, the service gracefully serves the last-known-good cached state stamped with `status: 'API_STALE'`.

---

## 5. Frontend Manager Interface (`MicroClimatePage.tsx`)

### Key Components
1. **Location & Telemetry Header:**
   - Clearly flags Bhopal geographic coordinates (`23.2599° N, 77.4126° E`), elevation (495m MSL), and IST local time.
   - Status badge reflecting `API_CONNECTED` or `API_STALE`.
   - Manual Refresh Button with active countdown cooldown (30s) and loading spinner.
2. **Real Weather Telemetry (5 Core Cards):**
   - **Temperature:** Ambient air temperature (°C) alongside feels-like temperature.
   - **Relative Humidity:** Saturation percentage with visual meter.
   - **Atmospheric Pressure:** Mean sea-level pressure (hPa) and ground-surface reading.
   - **Wind Dynamics:** Wind speed (km/h), gusts (km/h), and 16-point compass heading (e.g., ESE).
   - **Precipitation:** Real-time rainfall intensity (mm) and percentage cloud cover.
3. **Copernicus CAMS Air Quality Panel:**
   - Dedicated badges for **US EPA AQI** (0–500 scale) and **European AQI** (0–100 scale).
   - Prominent disclaimer highlighting that neither index represents Indian CPCB National AQI.
   - 8-metric pollutant grid: PM2.5, PM10, NO2, SO2, Surface Ozone, Carbon Monoxide, Dust Aerosol, and UV Index.
4. **Interactive Meteorological Projections:**
   - **24-Hour Hourly Timeline:** Vector SVG rendering smooth temperature curve overlaid with precipitation probability bars and WMO weather icons.
   - **7-Day Synoptic Outlook:** Daily cards with high/low temperature ranges, rain probability, and sunrise/sunset times.
   - **5-Day AQ Dispersion Trend:** Multi-series SVG tracking fine (PM2.5) vs coarse (PM10) particulate matter against the WHO 24-hour health guideline limit (15 µg/m³).
5. **Flight Advisory Engine:**
   - Evaluates flight safety against wind velocity, rain probability, and battery thermal ceilings.
   - Issues `PERMITTED`, `CAUTION`, or `RESTRICTED` status with supporting operational reasons.
6. **Strictly Source-Isolated Hardware Sensor Panel:**
   - Completely separated from regional API metrics.
   - Transparently indicates `SENSOR_NOT_CONNECTED` when the physical airframe is in standby.
   - Seamlessly transitions to live BMP280 readings (`SENSOR_CONNECTED`) upon drone telemetry stream arrival.

---

## 6. Verification & Test Results

### Backend Automated Test Suite
- **File:** `Backend/tests/manager/environmental.test.ts`
- **Total Test Cases:** 5 tests covering:
  - 401 Unauthorized for unauthenticated requests
  - 403 Forbidden for non-manager/non-admin roles
  - Full structural validation of `BhopalMicroClimateResponse`
  - Strict hardware sensor isolation
  - Stale cache fallback behavior
- **Suite Result:** **230 / 230 tests passed** across all 17 Backend test files.

### Manager Frontend Vitest Suite
- **File:** `manager/src/__tests__/managerIntegration.test.ts`
- **Total Test Cases:** 16 tests covering:
  - Telemetry provider provenance and simulation protection
  - Observation vector and location accuracy classifications
  - Human-in-the-loop review transitions
  - Bhopal Micro-Climate data integrity and airframe isolation
  - Flight advisory safety rules
- **Suite Result:** **16 / 16 tests passed**.

### Production Build Verification
- `npm run build --prefix Backend`: Clean compilation (`dist/server.js`, `dist/services/environmental.service.js`).
- `npm run build --prefix manager`: Clean compilation (`dist/index.html`, `dist/assets/index-CWG2w0Rv.js`).

---

## 7. Compliance Checklist

| Requirement | Status | Verification Evidence |
| :--- | :--- | :--- |
| Bhopal, MP Coordinates Fixed | **COMPLIANT** | `23.2599° N, 77.4126° E` in `environmental.service.ts` & `MicroClimatePage.tsx` |
| Primary Data Source: Open-Meteo & CAMS | **COMPLIANT** | Queried via Node.js server; zero direct browser API calls |
| Zero Mock/Fabricated Weather Data | **COMPLIANT** | Genuine real-time API values served; no 30°C/50% defaults |
| US AQI vs EU AQI Explicitly Labeled | **COMPLIANT** | Both indices labeled and distinct; neither called Indian CPCB AQI |
| Airframe Hardware Sensors Isolated | **COMPLIANT** | BMP280 panel shows `SENSOR_NOT_CONNECTED` in standby; never overwrites API |
| Caching & Rate-Limiting Active | **COMPLIANT** | Weather cached 15m, AQ cached 60m, manual refresh rate-limited to 30s |
| Flight Advisory Dynamically Derived | **COMPLIANT** | Evaluated on wind, rain, heat, and PM alerts |
| CC BY 4.0 License Attribution | **COMPLIANT** | Open-Meteo and Copernicus CAMS links present in UI |

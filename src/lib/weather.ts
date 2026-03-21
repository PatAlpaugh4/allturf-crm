// ============================================================================
// Allturf CRM — Weather Integration (Phase 5.4)
// Fetches from Open-Meteo API (free, no key needed).
// Caches daily results in weather_snapshots table.
// Calculates GDD and determines spray windows.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  temperature_2m_mean: number[];
  precipitation_sum: number[];
  relative_humidity_2m_mean: number[];
  wind_speed_10m_max: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}

export interface WeatherData {
  snapshot_date: string;
  temp_high_c: number;
  temp_low_c: number;
  temp_avg_c: number;
  rainfall_mm: number;
  humidity_avg: number;
  wind_avg_kmh: number;
  gdd_daily: number;
  gdd_cumulative: number;
  is_spray_window: boolean;
}

// ---------------------------------------------------------------------------
// GDD calculation — base 10°C for cool-season turf
// ---------------------------------------------------------------------------
const GDD_BASE_TEMP_C = 10;

export function calculateDailyGDD(
  tempHighC: number,
  tempLowC: number,
  baseTempC: number = GDD_BASE_TEMP_C
): number {
  const avgTemp = (tempHighC + tempLowC) / 2;
  return Math.max(0, avgTemp - baseTempC);
}

// ---------------------------------------------------------------------------
// Spray window determination
// ---------------------------------------------------------------------------
export function isSprayWindow(params: {
  windKmh: number;
  rainfallMm: number;
  tempAvgC: number;
  forecastRainfallMm?: number;
}): boolean {
  // Conditions for a good spray window:
  // - Wind < 15 km/h (label requirements for most products)
  // - No rain today (>= 2mm means too wet)
  // - No significant rain in forecast (if provided)
  // - Temperature between 10-30°C (most products effective range)
  return (
    params.windKmh < 15 &&
    params.rainfallMm < 2 &&
    (params.forecastRainfallMm == null || params.forecastRainfallMm < 2) &&
    params.tempAvgC >= 10 &&
    params.tempAvgC <= 30
  );
}

// ---------------------------------------------------------------------------
// Fetch weather from Open-Meteo and cache in weather_snapshots
// ---------------------------------------------------------------------------
export async function fetchAndCacheWeather(
  companyId: string,
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<WeatherData[]> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Check if we already have today's data cached
  const { data: cached } = await supabase
    .from("weather_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .eq("snapshot_date", today)
    .maybeSingle();

  if (cached) {
    // Return the last N days from cache
    const { data: cachedDays } = await supabase
      .from("weather_snapshots")
      .select("*")
      .eq("company_id", companyId)
      .order("snapshot_date", { ascending: false })
      .limit(days);

    if (cachedDays && cachedDays.length > 0) {
      return cachedDays.map((d) => ({
        snapshot_date: d.snapshot_date,
        temp_high_c: d.temp_high_c ?? 0,
        temp_low_c: d.temp_low_c ?? 0,
        temp_avg_c: d.temp_avg_c ?? 0,
        rainfall_mm: d.rainfall_mm ?? 0,
        humidity_avg: d.humidity_avg ?? 0,
        wind_avg_kmh: d.wind_avg_kmh ?? 0,
        gdd_daily: d.gdd_daily ?? 0,
        gdd_cumulative: d.gdd_cumulative ?? 0,
        is_spray_window: d.is_spray_window ?? false,
      }));
    }
  }

  // Fetch from Open-Meteo
  const endDate = today;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startDateStr = startDate.toISOString().split("T")[0];

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "precipitation_sum",
    "relative_humidity_2m_mean",
    "wind_speed_10m_max",
  ].join(","));
  url.searchParams.set("start_date", startDateStr);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("timezone", "America/Toronto");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data: OpenMeteoResponse = await response.json();
  const daily = data.daily;

  // Get the latest cumulative GDD from the database for continuity
  const { data: lastSnapshot } = await supabase
    .from("weather_snapshots")
    .select("gdd_cumulative, snapshot_date")
    .eq("company_id", companyId)
    .lt("snapshot_date", startDateStr)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let cumulativeGDD = lastSnapshot?.gdd_cumulative ?? 0;

  // Build weather data and upsert into cache
  const weatherRows: WeatherData[] = daily.time.map((date, i) => {
    const tempHigh = daily.temperature_2m_max[i];
    const tempLow = daily.temperature_2m_min[i];
    const tempAvg = daily.temperature_2m_mean[i];
    const rainfall = daily.precipitation_sum[i];
    const humidity = daily.relative_humidity_2m_mean[i];
    const wind = daily.wind_speed_10m_max[i];
    const dailyGDD = calculateDailyGDD(tempHigh, tempLow);
    cumulativeGDD += dailyGDD;

    // Check next day's rain for spray window (if available)
    const nextDayRain = i < daily.time.length - 1
      ? daily.precipitation_sum[i + 1]
      : undefined;

    const sprayOk = isSprayWindow({
      windKmh: wind,
      rainfallMm: rainfall,
      tempAvgC: tempAvg,
      forecastRainfallMm: nextDayRain,
    });

    return {
      snapshot_date: date,
      temp_high_c: tempHigh,
      temp_low_c: tempLow,
      temp_avg_c: tempAvg,
      rainfall_mm: rainfall,
      humidity_avg: humidity,
      wind_avg_kmh: wind,
      gdd_daily: Math.round(dailyGDD * 100) / 100,
      gdd_cumulative: Math.round(cumulativeGDD * 100) / 100,
      is_spray_window: sprayOk,
    };
  });

  // Upsert all rows into weather_snapshots (UNIQUE on company_id + snapshot_date)
  const upsertRows = weatherRows.map((w) => ({
    company_id: companyId,
    snapshot_date: w.snapshot_date,
    temp_high_c: w.temp_high_c,
    temp_low_c: w.temp_low_c,
    temp_avg_c: w.temp_avg_c,
    rainfall_mm: w.rainfall_mm,
    humidity_avg: w.humidity_avg,
    wind_avg_kmh: w.wind_avg_kmh,
    gdd_daily: w.gdd_daily,
    gdd_cumulative: w.gdd_cumulative,
    gdd_base_temp_c: GDD_BASE_TEMP_C,
    is_spray_window: w.is_spray_window,
    source: "open-meteo",
  }));

  await supabase
    .from("weather_snapshots")
    .upsert(upsertRows, { onConflict: "company_id,snapshot_date" });

  return weatherRows;
}

// ---------------------------------------------------------------------------
// Get current spray window status for a course
// ---------------------------------------------------------------------------
export async function getSprayWindowStatus(
  companyId: string
): Promise<{ is_spray_window: boolean; reason: string } | null> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("weather_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .eq("snapshot_date", today)
    .maybeSingle();

  if (!data) return null;

  const reasons: string[] = [];
  if ((data.wind_avg_kmh ?? 0) >= 15) reasons.push(`High wind: ${data.wind_avg_kmh}km/h`);
  if ((data.rainfall_mm ?? 0) >= 2) reasons.push(`Rain: ${data.rainfall_mm}mm`);
  if ((data.temp_avg_c ?? 0) < 10) reasons.push(`Too cold: ${data.temp_avg_c}°C`);
  if ((data.temp_avg_c ?? 0) > 30) reasons.push(`Too hot: ${data.temp_avg_c}°C`);

  return {
    is_spray_window: data.is_spray_window ?? false,
    reason: reasons.length > 0 ? reasons.join("; ") : "Conditions are good for spraying",
  };
}

// ---------------------------------------------------------------------------
// Get cumulative GDD for the current season
// ---------------------------------------------------------------------------
export async function getSeasonGDD(
  companyId: string,
  seasonStartMonth: number = 4 // April
): Promise<{ cumulative_gdd: number; days_tracked: number } | null> {
  const supabase = createServiceClient();
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), seasonStartMonth - 1, 1);
  const seasonStartStr = seasonStart.toISOString().split("T")[0];

  const { data } = await supabase
    .from("weather_snapshots")
    .select("gdd_cumulative, gdd_daily")
    .eq("company_id", companyId)
    .gte("snapshot_date", seasonStartStr)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const { count } = await supabase
    .from("weather_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("snapshot_date", seasonStartStr);

  return {
    cumulative_gdd: data.gdd_cumulative ?? 0,
    days_tracked: count ?? 0,
  };
}

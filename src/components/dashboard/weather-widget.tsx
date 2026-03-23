"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  Droplet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface WeatherDay {
  snapshot_date: string;
  temp_high_c: number | null;
  temp_low_c: number | null;
  temp_avg_c: number | null;
  rainfall_mm: number | null;
  humidity_avg: number | null;
  wind_avg_kmh: number | null;
  gdd_daily: number | null;
  gdd_cumulative: number | null;
  is_spray_window: boolean;
}

interface WeatherData {
  location: string;
  today: WeatherDay;
  week: WeatherDay[];
}

function getWeatherCondition(data: WeatherDay): {
  icon: LucideIcon;
  label: string;
} {
  const temp = data.temp_avg_c ?? 15;
  const rain = data.rainfall_mm ?? 0;
  const humidity = data.humidity_avg ?? 50;

  if (temp < 2 && rain > 0) return { icon: CloudSnow, label: "Snow" };
  if (rain >= 5) return { icon: CloudRain, label: "Heavy Rain" };
  if (rain >= 2) return { icon: CloudRain, label: "Rain" };
  if (rain >= 0.5) return { icon: CloudDrizzle, label: "Drizzle" };
  if (humidity > 80) return { icon: Cloud, label: "Overcast" };
  if (humidity > 55) return { icon: CloudSun, label: "Partly Cloudy" };
  return { icon: Sun, label: "Clear" };
}

function getGradientClasses(data: WeatherDay): {
  light: string;
  dark: string;
} {
  const temp = data.temp_avg_c ?? 15;
  const rain = data.rainfall_mm ?? 0;
  const humidity = data.humidity_avg ?? 50;

  if (rain > 2)
    return {
      light: "from-slate-400 via-gray-400 to-slate-500",
      dark: "from-slate-700 via-gray-800 to-slate-800",
    };
  if (humidity > 80)
    return {
      light: "from-gray-300 via-slate-300 to-gray-400",
      dark: "from-gray-700 via-slate-800 to-gray-800",
    };
  if (temp > 20)
    return {
      light: "from-sky-400 via-blue-400 to-blue-500",
      dark: "from-sky-700 via-blue-800 to-blue-900",
    };
  if (temp >= 10)
    return {
      light: "from-blue-300 via-sky-300 to-cyan-200",
      dark: "from-blue-800 via-sky-900 to-cyan-900",
    };
  return {
    light: "from-slate-300 via-blue-200 to-blue-300",
    dark: "from-slate-800 via-blue-900 to-slate-900",
  };
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function WeatherWidget() {
  const supabase = createBrowserClient();
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch the most recent 7 days of weather across any company
        const { data: snapshots } = await supabase
          .from("weather_snapshots")
          .select("*, company:companies(name)")
          .order("snapshot_date", { ascending: false })
          .limit(50);

        if (!snapshots || snapshots.length === 0) {
          setLoading(false);
          return;
        }

        // Group by company_id, pick the one with the most recent data
        const byCompany: Record<string, typeof snapshots> = {};
        for (const s of snapshots) {
          if (!byCompany[s.company_id]) byCompany[s.company_id] = [];
          byCompany[s.company_id].push(s);
        }

        // Find the company with the most recent snapshot
        let bestCompanyId = "";
        let bestDate = "";
        const companyIds = Object.keys(byCompany);
        for (const cid of companyIds) {
          const latest = byCompany[cid][0].snapshot_date;
          if (latest > bestDate) {
            bestDate = latest;
            bestCompanyId = cid;
          }
        }

        const companySnapshots = byCompany[bestCompanyId]
          .sort(
            (a, b) =>
              new Date(a.snapshot_date).getTime() -
              new Date(b.snapshot_date).getTime()
          )
          .slice(-7);

        const today = companySnapshots[companySnapshots.length - 1];
        const companyName =
          (today.company as { name: string } | null)?.name ?? "Unknown";

        setData({
          location: companyName,
          today,
          week: companySnapshots,
        });
      } catch {
        // Graceful failure — widget just won't show
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="rounded-3xl overflow-hidden min-h-[280px] skeleton" />
    );
  }

  if (!data) {
    return null;
  }

  const condition = getWeatherCondition(data.today);
  const gradient = getGradientClasses(data.today);
  const ConditionIcon = condition.icon;
  const tempHigh = data.today.temp_high_c ?? "--";
  const tempLow = data.today.temp_low_c ?? "--";
  const tempAvg = data.today.temp_avg_c != null ? Math.round(data.today.temp_avg_c) : "--";
  const needsOverlay =
    (data.today.humidity_avg ?? 0) > 80 && (data.today.rainfall_mm ?? 0) <= 2;

  return (
    <div
      className={`rounded-3xl overflow-hidden p-5 min-h-[280px] relative bg-gradient-to-br ${gradient.light} dark:${gradient.dark} shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]`}
    >
      {needsOverlay && (
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/90">
              {data.location}
            </p>
            <p className="text-6xl font-light tracking-tight text-white mt-1">
              {tempAvg}°
            </p>
            <p className="text-base text-white/80 mt-0.5">{condition.label}</p>
            <p className="text-sm text-white/70">
              H:{tempHigh}° L:{tempLow}°
            </p>
          </div>
          <ConditionIcon className="h-8 w-8 text-white/90 mt-1" />
        </div>

        {/* Spray badge + GDD + quick stats */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {data.today.is_spray_window ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-white/20 backdrop-blur-sm text-sm font-medium text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Spray Window Open
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-white/20 backdrop-blur-sm text-sm font-medium text-white">
              <XCircle className="h-3.5 w-3.5" />
              Spray Window Closed
            </span>
          )}
          {data.today.gdd_cumulative != null && (
            <span className="text-sm text-white/80 font-medium">
              GDD: {Math.round(data.today.gdd_cumulative)}
            </span>
          )}
        </div>

        {/* Quick weather details */}
        <div className="flex items-center gap-4 mt-2 text-sm text-white/70">
          <span className="inline-flex items-center gap-1">
            <Wind className="h-3.5 w-3.5" />
            {data.today.wind_avg_kmh ?? 0} km/h
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3.5 w-3.5" />
            {data.today.rainfall_mm ?? 0}mm
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplet className="h-3.5 w-3.5" />
            {data.today.humidity_avg ?? 0}%
          </span>
        </div>

        {/* 7-day strip */}
        {data.week.length > 1 && (
          <div className="border-t border-white/15 pt-3 mt-3 flex overflow-x-auto gap-0">
            {data.week.map((day) => {
              const dayCondition = getWeatherCondition(day);
              const DayIcon = dayCondition.icon;
              return (
                <div
                  key={day.snapshot_date}
                  className="flex-1 min-w-[52px] text-center"
                >
                  <p className="text-xs text-white/60 font-medium">
                    {getDayLabel(day.snapshot_date)}
                  </p>
                  <DayIcon className="h-4 w-4 mx-auto mt-1 text-white/80" />
                  <p className="text-xs text-white/90 mt-1 font-medium">
                    {day.temp_high_c != null ? Math.round(day.temp_high_c) : "--"}°
                  </p>
                  <p className="text-xs text-white/50">
                    {day.temp_low_c != null ? Math.round(day.temp_low_c) : "--"}°
                  </p>
                  <div className="flex justify-center mt-1">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        day.is_spray_window
                          ? "bg-green-400"
                          : "bg-red-400"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { AlertTriangle, Bell, Phone, TrendingUp } from "lucide-react";

import { FieldTrendsCard } from "@/components/dashboard/field-trends";
import { DailyDigestCard } from "@/components/dashboard/daily-digest-card";
import { RepActivitySnapshot } from "@/components/dashboard/rep-activity-snapshot";
import { DemandSignalsCard } from "@/components/dashboard/demand-signals-card";
import { WeatherWidget } from "@/components/dashboard/weather-widget";

export function ManagerDashboard() {
  return (
    <div className="space-y-4">
      {/* a. Weather + Quick Stats side by side on desktop */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WeatherWidget />
        <QuickStats />
      </div>

      {/* b. Latest Field Alerts */}
      <FieldTrendsCard />

      {/* c. Today's Digest Preview */}
      <DailyDigestCard />

      {/* d + e. Rep Activity and Demand Signals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RepActivitySnapshot />
        <DemandSignalsCard />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Stats row
// ---------------------------------------------------------------------------

function QuickStats() {
  const supabase = createBrowserClient();
  const [stats, setStats] = useState({
    callsToday: 0,
    callsYesterday: 0,
    activeAlerts: 0,
    hasCritical: false,
    overdueCommitments: 0,
    demandSignals: 0,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Run all queries in parallel
      const [callsRes, alertsRes, demandRes] = await Promise.all([
        supabase
          .from("call_logs")
          .select("created_at")
          .gte("created_at", yesterdayStart.toISOString()),
        supabase
          .from("field_trend_signals")
          .select("severity")
          .eq("is_active", true),
        supabase
          .from("demand_signals")
          .select("id")
          .gte("created_at", weekAgo),
      ]);

      let callsToday = 0;
      let callsYesterday = 0;
      if (callsRes.data) {
        for (const c of callsRes.data) {
          if (new Date(c.created_at) >= todayStart) callsToday++;
          else callsYesterday++;
        }
      }

      const activeAlerts = alertsRes.data?.length || 0;
      const hasCritical = alertsRes.data?.some((a) => a.severity === "critical") || false;
      const demandSignals = demandRes.data?.length || 0;

      // Overdue commitments — count action items past due across all reps
      const today = now.toISOString().split("T")[0];
      const { data: overdueData } = await supabase
        .from("rep_nudges")
        .select("id")
        .eq("is_dismissed", false)
        .eq("is_completed", false)
        .lt("due_date", today)
        .not("due_date", "is", null);

      setStats({
        callsToday,
        callsYesterday,
        activeAlerts,
        hasCritical,
        overdueCommitments: overdueData?.length || 0,
        demandSignals,
      });
      setLoaded(true);
    }
    load();
  }, [supabase]);

  if (!loaded) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <QuickStatCard
        icon={<Phone className="h-4 w-4" />}
        value={stats.callsToday}
        label="Calls today"
        sublabel={stats.callsYesterday > 0 ? `${stats.callsYesterday} yesterday` : undefined}
      />
      <QuickStatCard
        icon={<AlertTriangle className="h-4 w-4" />}
        value={stats.activeAlerts}
        label="Field alerts"
        variant={stats.hasCritical ? "danger" : stats.activeAlerts > 0 ? "warning" : "default"}
      />
      <QuickStatCard
        icon={<Bell className="h-4 w-4" />}
        value={stats.overdueCommitments}
        label="Overdue items"
        variant={stats.overdueCommitments > 0 ? "danger" : "default"}
      />
      <QuickStatCard
        icon={<TrendingUp className="h-4 w-4" />}
        value={stats.demandSignals}
        label="Demand signals"
        sublabel="this week"
      />
    </div>
  );
}

function QuickStatCard({
  icon,
  value,
  label,
  sublabel,
  variant = "default",
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  sublabel?: string;
  variant?: "default" | "warning" | "danger";
}) {
  const gradientClass =
    variant === "danger"
      ? "bg-gradient-to-br from-red-50 to-card dark:from-red-950/30 dark:to-card"
      : variant === "warning"
        ? "bg-gradient-to-br from-amber-50 to-card dark:from-amber-950/30 dark:to-card"
        : "bg-card";

  const iconBgClass =
    variant === "danger"
      ? "bg-red-100 dark:bg-red-900/30 text-red-500"
      : variant === "warning"
        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-500"
        : "bg-primary/10 text-primary";

  const valueClass =
    variant === "danger"
      ? "text-red-600 dark:text-red-400"
      : variant === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "";

  return (
    <div
      className={`rounded-2xl border border-border/30 ${gradientClass} shadow-[var(--shadow-card)] transition-shadow duration-200 p-3`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center ${iconBgClass}`}
        >
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold leading-none ${valueClass}`}>
            {value}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          {sublabel && (
            <p className="text-[9px] text-muted-foreground">{sublabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

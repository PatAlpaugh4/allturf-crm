"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Package,
  Pill,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import type { TrendSeverity } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEntry {
  id: string;
  call_log_id: string;
  summary: string | null;
  sentiment: string | null;
  diseases_mentioned: string[] | null;
  products_mentioned: string[] | null;
  products_requested: Array<{ product_name: string; quantity?: number; unit?: string }> | null;
  extracted_commitments: Array<{ description: string; deadline: string | null }> | null;
  extracted_reorders: Array<{ product_name: string; quantity?: number; unit?: string }> | null;
  urgency_level: string | null;
  confidence_score: number | null;
  created_at: string;
  call_log: {
    id: string;
    raw_transcript: string | null;
    created_at: string;
    rep: { id: string; full_name: string | null; territory: string | null } | null;
    company: { id: string; name: string } | null;
    contact: { id: string; first_name: string; last_name: string } | null;
  } | null;
}

interface TrendAlert {
  id: string;
  signal_type: string;
  severity: TrendSeverity;
  title: string;
  description: string | null;
  affected_region: string | null;
  data_points: number;
  is_active: boolean;
  created_at: string;
}

interface TrendingDisease {
  name: string;
  count: number;
}

interface TrendingProduct {
  name: string;
  discussed: number;
  requested: number;
}

interface HotRegion {
  name: string;
  count: number;
}

interface StockAlert {
  product_id: string;
  product_name: string;
  category: string;
  quantity_on_hand: number;
  reorder_point: number;
  quantity_on_order: number;
  demand_this_week: number;
  low_stock: boolean;
  high_demand: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATE_RANGES = [
  { label: "Today", days: 0 },
  { label: "Last 3 Days", days: 3 },
  { label: "This Week", days: 7 },
  { label: "Last 2 Weeks", days: 14 },
] as const;

const SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  critical: { border: "border-red-300", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
  warning: { border: "border-orange-300", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  watch: { border: "border-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400" },
  info: { border: "border-blue-300", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
};

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-green-500",
  neutral: "bg-slate-400",
  concerned: "bg-orange-500",
  urgent: "bg-red-500",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FieldIntelPage() {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient();

  const [rangeDays, setRangeDays] = useState(14);
  const [territory, setTerritory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);
  const [trendingDiseases, setTrendingDiseases] = useState<TrendingDisease[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [hotRegions, setHotRegions] = useState<HotRegion[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAdmin, router]);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - rangeDays);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [rangeDays]);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    if (territory) params.set("territory", territory);

    setFetchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fetchHeaders: Record<string, string> = {};
      if (session?.access_token) fetchHeaders["Authorization"] = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/turf/field-timeline?${params}`, { headers: fetchHeaders });
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
        setAlerts(data.alerts || []);
        setTrendingDiseases(data.trending_diseases || []);
        setTrendingProducts(data.trending_products || []);
        setHotRegions(data.hot_regions || []);
        setStockAlerts(data.stock_alerts || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFetchError(errData.error || `Failed to load (${res.status})`);
      }
    } catch {
      setFetchError("Network error loading field intel");
    }

    setLoading(false);
  }, [profile?.id, startDate, endDate, territory, supabase.auth]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [fetchData, isAdmin]);

  const handleAcknowledge = async (alertId: string) => {
    await supabase
      .from("field_trend_signals")
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq("id", alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Field Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time cross-rep activity and disease/product clustering
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {DATE_RANGES.map((r) => (
            <Button
              key={r.days}
              variant={rangeDays === r.days ? "default" : "outline"}
              size="sm"
              onClick={() => setRangeDays(r.days)}
              className="min-h-[36px]"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
            return (
              <div
                key={alert.id}
                className={`rounded-xl border ${style.border} ${style.bg} p-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className={`h-5 w-5 mt-0.5 shrink-0 ${style.text}`} />
                    <div>
                      <p className={`text-sm font-semibold ${style.text}`}>
                        {alert.title}
                      </p>
                      {alert.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {alert.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {alert.affected_region && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {alert.affected_region}
                          </span>
                        )}
                        <span>{alert.data_points} data points</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAcknowledge(alert.id)}
                    className="shrink-0"
                  >
                    Acknowledge
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Main content: timeline + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Timeline */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
            </div>
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Activity className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No field activity in this time range
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border hidden sm:block" />

              <div className="space-y-1">
                {timeline.map((entry) => (
                  <TimelineCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 xl:w-80 space-y-4 shrink-0">
          {/* Trending diseases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Trending Diseases
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendingDiseases.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No trends yet</p>
              ) : (
                <div className="space-y-2">
                  {trendingDiseases.map((d) => {
                    const maxCount = trendingDiseases[0].count;
                    return (
                      <div key={d.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate">{d.name}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {d.count} rep{d.count !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full transition-all"
                            style={{ width: `${(d.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trending products */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Trending Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendingProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No trends yet</p>
              ) : (
                <div className="space-y-2.5">
                  {trendingProducts.map((p) => (
                    <div key={p.name} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2 text-xs">
                          {p.discussed + p.requested}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{p.discussed} discussed</span>
                        {p.requested > 0 && (
                          <span className="text-green-600 font-medium">
                            {p.requested} requested
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hot regions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-rose-500" />
                Hot Regions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hotRegions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-1">
                  {hotRegions.map((r) => (
                    <button
                      key={r.name}
                      onClick={() =>
                        setTerritory(territory === r.name ? null : r.name)
                      }
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                        territory === r.name
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="truncate">{r.name}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">
                        {r.count}
                      </Badge>
                    </button>
                  ))}
                  {territory && (
                    <button
                      onClick={() => setTerritory(null)}
                      className="text-xs text-muted-foreground hover:text-foreground mt-1 w-full text-center"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock alerts */}
          {stockAlerts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-500" />
                  Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {stockAlerts.map((s) => (
                    <div key={s.product_id} className="text-sm space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{s.product_name}</span>
                        {s.low_stock && (
                          <Badge className="text-[10px] bg-red-100 text-red-700 shrink-0 ml-1">
                            Low
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>
                          Stock: <span className={s.low_stock ? "text-red-600 font-medium" : ""}>{s.quantity_on_hand}</span>
                          {s.reorder_point > 0 && <span> / {s.reorder_point} min</span>}
                        </span>
                        {s.quantity_on_order > 0 && (
                          <span>{s.quantity_on_order} on order</span>
                        )}
                      </div>
                      {s.high_demand && (
                        <p className="text-[11px] text-orange-600 font-medium">
                          {s.demand_this_week} requests this week
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Card
// ---------------------------------------------------------------------------

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cl = entry.call_log;
  const rep = cl?.rep;
  const company = cl?.company;
  const contact = cl?.contact;

  const initials = rep?.full_name
    ? rep.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const sentimentColor = SENTIMENT_DOT[entry.sentiment || "neutral"] || SENTIMENT_DOT.neutral;

  return (
    <div className="relative flex gap-3 sm:gap-4 py-3 px-1">
      {/* Avatar + vertical line connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary z-10">
          {initials}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-medium">{rep?.full_name || "Unknown rep"}</span>
          <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${sentimentColor}`} title={entry.sentiment || "neutral"} />
          <span className="text-xs text-muted-foreground">{formatTime(entry.created_at)}</span>
          {entry.urgency_level && entry.urgency_level !== "routine" && (
            <Badge
              className={`text-[10px] ${
                entry.urgency_level === "emergency"
                  ? "bg-red-100 text-red-700"
                  : entry.urgency_level === "urgent"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {entry.urgency_level}
            </Badge>
          )}
        </div>

        {/* Course + contact */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {company && (
            <Link
              href={`/courses/${company.id}`}
              className="hover:text-primary hover:underline font-medium"
            >
              {company.name}
            </Link>
          )}
          {contact && (
            <span>
              {contact.first_name} {contact.last_name}
            </span>
          )}
          {rep?.territory && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {rep.territory}
            </span>
          )}
        </div>

        {/* Summary */}
        {entry.summary && (
          <p className="text-sm text-foreground/90 leading-relaxed">
            {entry.summary}
          </p>
        )}

        {/* Pills */}
        <div className="flex flex-wrap gap-1.5">
          {entry.diseases_mentioned?.map((d) => (
            <Badge
              key={d}
              variant="outline"
              className="text-[10px] border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-950/30"
            >
              {d}
            </Badge>
          ))}
          {entry.products_mentioned?.map((p) => (
            <Badge
              key={p}
              variant="outline"
              className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30"
            >
              {p}
            </Badge>
          ))}
          {entry.products_requested?.map((pr) => (
            <Badge
              key={pr.product_name}
              variant="outline"
              className="text-[10px] border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 flex items-center gap-0.5"
            >
              <Pill className="h-2.5 w-2.5" />
              {pr.product_name}
              {pr.quantity ? ` × ${pr.quantity}` : ""}
            </Badge>
          ))}
        </div>

        {/* Commitments */}
        {entry.extracted_commitments && entry.extracted_commitments.length > 0 && (
          <div className="text-xs space-y-0.5 mt-1">
            {entry.extracted_commitments.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 text-muted-foreground">
                <span className="text-primary mt-px">→</span>
                <span>
                  {c.description}
                  {c.deadline && (
                    <span className="ml-1 font-medium text-foreground">
                      (by {c.deadline})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Expand/collapse transcript */}
        {cl?.raw_transcript && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Hide transcript
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show transcript
              </>
            )}
          </button>
        )}

        {expanded && cl?.raw_transcript && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mt-1">
            {cl.raw_transcript}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const isYesterday =
    new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
  if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

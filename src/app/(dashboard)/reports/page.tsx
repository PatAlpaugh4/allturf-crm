"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  BarChart3,
  TrendingUp,
  MapPin,
  DollarSign,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Area,
} from "recharts";

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------
const PIE_COLORS = [
  "#0d9488", "#84cc16", "#f43f5e", "#10b981", "#f59e0b",
  "#0ea5e9", "#8b5cf6", "#6366f1", "#6b7280",
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  const [loading, setLoading] = useState(true);

  // Raw data
  const [deals, setDeals] = useState<
    Array<{
      id: string;
      value_cad: number;
      stage: string;
      season: string | null;
      created_at: string;
      company_name: string | null;
    }>
  >([]);
  const [dealItems, setDealItems] = useState<
    Array<{
      id: string;
      deal_id: string;
      name: string;
      quantity: number;
      unit_price: number;
      category: string | null;
    }>
  >([]);
  const [visits, setVisits] = useState<
    Array<{
      id: string;
      visit_date: string;
      overall_condition: string | null;
      rep_name: string | null;
      company_name: string | null;
    }>
  >([]);
  const [observations, setObservations] = useState<
    Array<{
      id: string;
      visit_report_id: string;
      disease_name: string | null;
      disease_type: string | null;
    }>
  >([]);
  const [weatherData, setWeatherData] = useState<
    Array<{
      snapshot_date: string;
      gdd_cumulative: number | null;
      temp_avg_c: number | null;
    }>
  >([]);
  const [treatments, setTreatments] = useState<
    Array<{
      application_date: string | null;
      product_name: string | null;
    }>
  >([]);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const [dealsRes, itemsRes, visitsRes, obsRes, weatherRes, treatRes] =
        await Promise.all([
          supabase
            .from("deals")
            .select("id, value_cad, stage, season, created_at, company:companies(name)")
            .order("created_at"),
          supabase
            .from("deal_items")
            .select("id, deal_id, name, quantity, unit_price, offering:offerings(category)")
            .order("created_at"),
          supabase
            .from("visit_reports")
            .select("id, visit_date, overall_condition, rep:user_profiles(full_name), company:companies(name)")
            .order("visit_date"),
          supabase
            .from("visit_observations")
            .select("id, visit_report_id, disease_pest:turf_diseases_pests(name, type)")
            .order("created_at"),
          supabase
            .from("weather_snapshots")
            .select("snapshot_date, gdd_cumulative, temp_avg_c")
            .order("snapshot_date"),
          supabase
            .from("project_tasks")
            .select("application_date, product:offerings(name)")
            .not("application_date", "is", null)
            .order("application_date"),
        ]);

      if (dealsRes.data) {
        setDeals(
          dealsRes.data.map((d) => ({
            id: d.id,
            value_cad: d.value_cad,
            stage: d.stage,
            season: d.season,
            created_at: d.created_at,
            company_name: (d.company as unknown as { name: string } | null)?.name ?? null,
          }))
        );
      }

      if (itemsRes.data) {
        setDealItems(
          itemsRes.data.map((i) => ({
            id: i.id,
            deal_id: i.deal_id,
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            category: (i.offering as unknown as { category: string } | null)?.category ?? null,
          }))
        );
      }

      if (visitsRes.data) {
        setVisits(
          visitsRes.data.map((v) => ({
            id: v.id,
            visit_date: v.visit_date,
            overall_condition: v.overall_condition,
            rep_name: (v.rep as unknown as { full_name: string | null } | null)?.full_name ?? null,
            company_name: (v.company as unknown as { name: string } | null)?.name ?? null,
          }))
        );
      }

      if (obsRes.data) {
        setObservations(
          obsRes.data.map((o) => {
            const dp = o.disease_pest as unknown as { name: string; type: string } | null;
            return {
              id: o.id,
              visit_report_id: o.visit_report_id,
              disease_name: dp?.name ?? null,
              disease_type: dp?.type ?? null,
            };
          })
        );
      }

      if (weatherRes.data) setWeatherData(weatherRes.data);

      if (treatRes.data) {
        setTreatments(
          treatRes.data.map((t) => ({
            application_date: t.application_date,
            product_name: (t.product as unknown as { name: string } | null)?.name ?? null,
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, [supabase]);

  // =========================================================================
  // Computed chart data
  // =========================================================================

  // Revenue by month
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const month = d.created_at.slice(0, 7); // YYYY-MM
      map.set(month, (map.get(month) || 0) + d.value_cad);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [deals]);

  // Product category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of dealItems) {
      const cat = item.category || "Other";
      map.set(cat, (map.get(cat) || 0) + item.quantity * item.unit_price);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [dealItems]);

  // Visit frequency by rep
  const visitsByRep = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of visits) {
      const rep = v.rep_name || "Unassigned";
      map.set(rep, (map.get(rep) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([rep, count]) => ({ rep, count }));
  }, [visits]);

  // Disease occurrence
  const diseaseOccurrence = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of observations) {
      if (o.disease_name) {
        map.set(o.disease_name, (map.get(o.disease_name) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([disease, count]) => ({ disease, count }));
  }, [observations]);

  // GDD overlay with treatment timing
  const gddWithTreatments = useMemo(() => {
    const gddMap = new Map<string, { gdd: number; temp: number | null }>();
    for (const w of weatherData) {
      gddMap.set(w.snapshot_date, {
        gdd: w.gdd_cumulative || 0,
        temp: w.temp_avg_c,
      });
    }

    // Mark treatment dates
    const treatmentDates = new Set(
      treatments.map((t) => t.application_date).filter(Boolean) as string[]
    );

    // Build combined series
    const entries = Array.from(gddMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: date.slice(5), // MM-DD
        gdd: data.gdd,
        temp: data.temp,
        treatment: treatmentDates.has(date) ? data.gdd : null,
      }));

    return entries;
  }, [weatherData, treatments]);

  // KPI cards
  const totalRevenue = deals.reduce((s, d) => s + d.value_cad, 0);
  const totalVisits = visits.length;
  const uniqueCourses = new Set(visits.map((v) => v.company_name).filter(Boolean)).size;
  const avgCondition = useMemo(() => {
    const conditions = visits
      .map((v) => v.overall_condition)
      .filter(Boolean) as string[];
    if (conditions.length === 0) return "—";
    const rank: Record<string, number> = {
      Excellent: 5,
      Good: 4,
      Fair: 3,
      Poor: 2,
      Critical: 1,
    };
    const avg =
      conditions.reduce((s, c) => s + (rank[c] || 0), 0) / conditions.length;
    if (avg >= 4.5) return "Excellent";
    if (avg >= 3.5) return "Good";
    if (avg >= 2.5) return "Fair";
    if (avg >= 1.5) return "Poor";
    return "Critical";
  }, [visits]);

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Territory analytics and insights
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          title="Total Visits"
          value={String(totalVisits)}
          icon={<MapPin className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          title="Active Courses"
          value={String(uniqueCourses)}
          icon={<Users className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          title="Avg Condition"
          value={avgCondition}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="territory">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="territory" className="min-h-[44px] flex-1 sm:flex-initial text-xs sm:text-sm">Territory</TabsTrigger>
          <TabsTrigger value="products" className="min-h-[44px] flex-1 sm:flex-initial text-xs sm:text-sm">Products</TabsTrigger>
          <TabsTrigger value="activity" className="min-h-[44px] flex-1 sm:flex-initial text-xs sm:text-sm">Activity</TabsTrigger>
        </TabsList>

        {/* Territory Overview */}
        <TabsContent value="territory" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Revenue by Month */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Revenue by Month</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                      />
                      <Bar dataKey="revenue" fill="hsl(142, 45%, 35%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            {/* Visit Frequency by Rep */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Visit Frequency by Rep</CardTitle>
              </CardHeader>
              <CardContent>
                {visitsByRep.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={visitsByRep} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="rep"
                        type="category"
                        tick={{ fontSize: 11 }}
                        width={100}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(142, 45%, 45%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Product Sales */}
        <TabsContent value="products" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Category Breakdown Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Product Category Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) =>
                          `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {categoryBreakdown.map((entry, idx) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[idx % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            {/* Top Products by Revenue (table) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Category Revenue Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoryBreakdown
                    .sort((a, b) => b.value - a.value)
                    .map((cat) => {
                      const total = categoryBreakdown.reduce((s, c) => s + c.value, 0);
                      const pct = total > 0 ? (cat.value / total) * 100 : 0;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{cat.name}</span>
                            <span className="text-muted-foreground">
                              ${cat.value.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {categoryBreakdown.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No product data yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Course Activity */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Disease Occurrence */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Disease / Pest Occurrence
                </CardTitle>
              </CardHeader>
              <CardContent>
                {diseaseOccurrence.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={diseaseOccurrence} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="disease"
                        type="category"
                        tick={{ fontSize: 10 }}
                        width={140}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            {/* GDD Overlay with Treatment Timing */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  GDD Accumulation & Treatment Timing
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gddWithTreatments.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={gddWithTreatments}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis
                        yAxisId="gdd"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: "GDD",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 11 },
                        }}
                      />
                      <YAxis
                        yAxisId="temp"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: "°C",
                          angle: 90,
                          position: "insideRight",
                          style: { fontSize: 11 },
                        }}
                      />
                      <Tooltip />
                      <Area
                        yAxisId="gdd"
                        type="monotone"
                        dataKey="gdd"
                        fill="hsl(142, 45%, 35%)"
                        fillOpacity={0.1}
                        stroke="hsl(142, 45%, 35%)"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="temp"
                        stroke="#f59e0b"
                        strokeWidth={1}
                        dot={false}
                      />
                      <Bar
                        yAxisId="gdd"
                        dataKey="treatment"
                        fill="#ef4444"
                        barSize={4}
                        name="Treatment"
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          {title}
        </div>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
      No data available yet
    </div>
  );
}

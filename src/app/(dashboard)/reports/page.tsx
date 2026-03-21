"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  BarChart3,
  Phone,
  MapPin,
  DollarSign,
  FileText,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);

  const [calls, setCalls] = useState<Array<{ id: string; created_at: string }>>([]);
  const [visits, setVisits] = useState<Array<{ id: string; visit_date: string }>>([]);
  const [deals, setDeals] = useState<Array<{ id: string; value_cad: number; stage: string; created_at: string }>>([]);
  const [diseaseObs, setDiseaseObs] = useState<Array<{ disease_name: string | null }>>([]);
  const [callExtractions, setCallExtractions] = useState<Array<{ products_discussed: string[] | null }>>([]);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const [callsRes, visitsRes, dealsRes, obsRes, extractRes] = await Promise.all([
        supabase.from("call_logs").select("id, created_at").order("created_at", { ascending: false }),
        supabase.from("visit_reports").select("id, visit_date").order("visit_date", { ascending: false }),
        supabase.from("deals").select("id, value_cad, stage, created_at").order("created_at"),
        supabase.from("visit_observations").select("disease_pest:turf_diseases_pests(name)"),
        supabase.from("call_log_extractions").select("products_discussed"),
      ]);

      if (callsRes.data) setCalls(callsRes.data);
      if (visitsRes.data) setVisits(visitsRes.data);
      if (dealsRes.data) setDeals(dealsRes.data);
      if (obsRes.data) {
        setDiseaseObs(
          obsRes.data.map((o) => ({
            disease_name: (o.disease_pest as unknown as { name: string } | null)?.name ?? null,
          }))
        );
      }
      if (extractRes.data) setCallExtractions(extractRes.data);

      setLoading(false);
    }
    load();
  }, [supabase]);

  // Time period helpers
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekStr = startOfWeek.toISOString().split("T")[0];
  const monthStr = now.toISOString().slice(0, 7);

  const callsThisWeek = calls.filter((c) => c.created_at >= weekStr).length;
  const callsThisMonth = calls.filter((c) => c.created_at.startsWith(monthStr)).length;
  const visitsThisWeek = visits.filter((v) => v.visit_date >= weekStr).length;
  const visitsThisMonth = visits.filter((v) => v.visit_date.startsWith(monthStr)).length;

  // Top 5 diseases mentioned
  const topDiseases = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of diseaseObs) {
      if (o.disease_name) map.set(o.disease_name, (map.get(o.disease_name) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [diseaseObs]);

  // Top 5 products discussed
  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of callExtractions) {
      if (e.products_discussed) {
        for (const p of e.products_discussed) {
          map.set(p, (map.get(p) || 0) + 1);
        }
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [callExtractions]);

  // Revenue by month
  const revenueByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const month = d.created_at.slice(0, 7);
      map.set(month, (map.get(month) || 0) + d.value_cad);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, revenue]) => ({ month, revenue }));
  }, [deals]);

  // Sales stats
  const openDeals = deals.filter((d) => !["Paid", "Closed Lost"].includes(d.stage));
  const closedThisMonth = deals.filter(
    (d) => d.stage === "Paid" && d.created_at.startsWith(monthStr)
  );

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quick stats to complement your Daily Digest
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/digest">
            <FileText className="h-4 w-4" />
            View Daily Digest
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Field Activity Summary */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Field Activity
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Calls This Week"
            value={callsThisWeek}
            subtitle={`${callsThisMonth} this month`}
            icon={<Phone className="h-4 w-4 text-primary" />}
          />
          <StatCard
            title="Visits This Week"
            value={visitsThisWeek}
            subtitle={`${visitsThisMonth} this month`}
            icon={<MapPin className="h-4 w-4 text-primary" />}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Top diseases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Diseases Mentioned</CardTitle>
            </CardHeader>
            <CardContent>
              {topDiseases.length > 0 ? (
                <div className="space-y-2">
                  {topDiseases.map((d) => {
                    const maxCount = topDiseases[0].count;
                    return (
                      <div key={d.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{d.name}</span>
                          <span className="text-muted-foreground">{d.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${(d.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Top products */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Products Discussed</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="space-y-2">
                  {topProducts.map((p) => {
                    const maxCount = topProducts[0].count;
                    return (
                      <div key={p.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{p.name}</span>
                          <span className="text-muted-foreground">{p.count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(p.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Sales Summary */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sales Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard
            title="Open Deals"
            value={openDeals.length}
            subtitle={`$${openDeals.reduce((s, d) => s + d.value_cad, 0).toLocaleString()} total`}
            icon={<DollarSign className="h-4 w-4 text-primary" />}
          />
          <StatCard
            title="Closed This Month"
            value={closedThisMonth.length}
            subtitle={`$${closedThisMonth.reduce((s, d) => s + d.value_cad, 0).toLocaleString()}`}
            icon={<DollarSign className="h-4 w-4 text-primary" />}
          />
        </div>

        {/* Revenue by month chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
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
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
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
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

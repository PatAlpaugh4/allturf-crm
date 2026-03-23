"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react";

interface TrendSignal {
  id: string;
  signal_type: string;
  severity: string;
  title: string;
  description: string | null;
  affected_region: string | null;
  affected_companies: string[] | null;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  warning: "bg-orange-100 text-orange-700 border-orange-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

const SIGNAL_LABELS: Record<string, string> = {
  disease_outbreak: "Disease Outbreak",
  product_demand_spike: "Demand Spike",
  inventory_risk: "Inventory Risk",
  seasonal_pattern: "Seasonal Pattern",
  pricing_concern: "Pricing Concern",
};

export function FieldTrendsCard() {
  const { isAdmin } = useAuth();
  const [trends, setTrends] = useState<TrendSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function load() {
      const { data } = await supabase
        .from("field_trend_signals")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) setTrends(data as TrendSignal[]);
      setLoading(false);
    }
    load();
  }, [supabase, isAdmin]);

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Field Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : trends.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No active trend signals
          </p>
        ) : (
          <div className="space-y-2">
            {trends.map((trend) => (
              <div
                key={trend.id}
                className={`rounded-lg border p-2.5 ${
                  trend.severity === "critical"
                    ? "border-red-200 bg-red-50/50 dark:bg-red-950/20"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {trend.severity === "critical" && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  )}
                  <Badge
                    className={`text-[9px] h-4 ${SEVERITY_STYLES[trend.severity] || SEVERITY_STYLES.info}`}
                  >
                    {trend.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] h-4">
                    {SIGNAL_LABELS[trend.signal_type] || trend.signal_type}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{trend.title}</p>
                {trend.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {trend.description}
                  </p>
                )}
                {trend.affected_region && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="secondary" className="text-[9px] h-3.5">
                      {trend.affected_region}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

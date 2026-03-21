"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface DigestData {
  id: string;
  digest_date: string;
  total_calls_logged: number;
  total_follow_ups_needed: number;
  top_diseases: Array<{
    disease_name: string;
    mention_count: number;
  }> | null;
  top_products: Array<{
    product_name: string;
    request_count: number;
  }> | null;
  key_highlights: string | null;
  alerts: string | null;
  generated_at: string | null;
}

interface TrendSignal {
  id: string;
  signal_type: string;
  severity: string;
  title: string;
  description: string | null;
  data_points: number;
  is_active: boolean;
  recommended_actions: Array<{
    action: string;
    priority: string | null;
  }> | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  watch: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DigestPage() {
  const supabase = createBrowserClient();
  const { isAdmin } = useAuth();

  // Default to yesterday
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });

  const [digest, setDigest] = useState<DigestData | null>(null);
  const [trends, setTrends] = useState<TrendSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setDigest(null);

    const res = await fetch(`/api/turf/daily-digest?date=${selectedDate}`);
    if (res.ok) {
      const data = await res.json();
      setDigest(data.digest || null);
    }

    // Fetch active trend signals
    const { data: signalsData } = await supabase
      .from("field_trend_signals")
      .select("id, signal_type, severity, title, description, data_points, is_active, recommended_actions")
      .eq("is_active", true)
      .order("severity", { ascending: false })
      .limit(10);

    setTrends((signalsData as TrendSignal[]) || []);
    setLoading(false);
  }, [selectedDate, supabase]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/turf/daily-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_date: selectedDate }),
      });
      if (res.ok) {
        await fetchDigest();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAcknowledge = async (signalId: string) => {
    await supabase
      .from("field_trend_signals")
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq("id", signalId);

    setTrends((prev) => prev.filter((t) => t.id !== signalId));
  };

  const navigateDate = (direction: -1 | 1) => {
    const d = new Date(selectedDate + "T12:00:00Z");
    d.setDate(d.getDate() + direction);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Parse key_highlights into sections
  const sections = parseDigestSections(digest?.key_highlights || "");

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-6 pb-8">
      {/* Header with date picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Daily Digest
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Field intelligence summary for management
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(-1)}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-[130px]"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(1)}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No digest — generate button */}
      {!loading && !digest && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No digest for {formatDateStr(selectedDate)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate an AI-powered summary of field activity.
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="min-h-[44px] gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Digest
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Digest content */}
      {!loading && digest && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{digest.total_calls_logged}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Calls Logged</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{digest.total_follow_ups_needed}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Follow-ups Needed</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{trends.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Active Alerts</p>
              </CardContent>
            </Card>
          </div>

          {/* No activity message */}
          {digest.total_calls_logged === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No field activity recorded for this date.</p>
              </CardContent>
            </Card>
          )}

          {/* Digest sections */}
          {digest.total_calls_logged > 0 && (
            <>
              {/* Executive Summary */}
              {sections.executive_summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{sections.executive_summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Activity Overview */}
              {sections.activity_overview && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Activity Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {sections.activity_overview}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Field Intelligence */}
              {sections.field_intelligence && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      Field Intelligence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {sections.field_intelligence}
                    </p>

                    {/* Top diseases inline */}
                    {digest.top_diseases && digest.top_diseases.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {digest.top_diseases.slice(0, 6).map((d) => (
                          <Badge
                            key={d.disease_name}
                            variant="outline"
                            className="text-xs"
                          >
                            {d.disease_name}
                            <span className="ml-1 opacity-60">({d.mention_count})</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action Items */}
              {sections.action_items && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Action Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {sections.action_items}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Inventory Implications */}
              {sections.inventory && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Inventory Implications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {sections.inventory}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Trend Alerts */}
          {trends.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Active Trend Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trends.map((signal) => (
                  <div
                    key={signal.id}
                    className="surface-alert rounded-xl border p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={
                              SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.info
                            }
                          >
                            {signal.severity}
                          </Badge>
                          <span className="text-sm font-medium">{signal.title}</span>
                        </div>
                        {signal.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {signal.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAcknowledge(signal.id)}
                        className="shrink-0 text-xs h-8"
                      >
                        Acknowledge
                      </Button>
                    </div>

                    {signal.recommended_actions &&
                      signal.recommended_actions.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Recommended actions:
                          </p>
                          <ul className="space-y-0.5">
                            {signal.recommended_actions.map((action, i) => (
                              <li
                                key={i}
                                className="text-xs text-muted-foreground flex items-start gap-1.5"
                              >
                                <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-muted-foreground/50" />
                                {action.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Regenerate button for admins */}
          {isAdmin && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2 text-sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Regenerate Digest
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Generation timestamp */}
          {digest.generated_at && (
            <p className="text-center text-xs text-muted-foreground">
              Generated{" "}
              {new Date(digest.generated_at).toLocaleString("en-CA", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parse the key_highlights markdown into sections
// ---------------------------------------------------------------------------

interface ParsedSections {
  executive_summary: string;
  activity_overview: string;
  field_intelligence: string;
  action_items: string;
  inventory: string;
}

function parseDigestSections(content: string): ParsedSections {
  const sections: ParsedSections = {
    executive_summary: "",
    activity_overview: "",
    field_intelligence: "",
    action_items: "",
    inventory: "",
  };

  if (!content) return sections;

  // Split by ## headers
  const parts = content.split(/^## /m);

  // First part (before any ##) is the executive summary
  if (parts[0]) {
    sections.executive_summary = parts[0].trim();
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const newlineIdx = part.indexOf("\n");
    const heading = (newlineIdx >= 0 ? part.slice(0, newlineIdx) : part).toLowerCase();
    const body = newlineIdx >= 0 ? part.slice(newlineIdx + 1).trim() : "";

    if (heading.includes("activity")) {
      sections.activity_overview = body;
    } else if (heading.includes("intelligence") || heading.includes("field")) {
      sections.field_intelligence = body;
    } else if (heading.includes("action")) {
      sections.action_items = body;
    } else if (heading.includes("inventory")) {
      sections.inventory = body;
    }
  }

  return sections;
}

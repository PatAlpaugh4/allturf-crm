"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
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
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Eye,
  Loader2,
  Mail,
  Map,
  Package,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import type {
  DigestStructuredData,
  RepActivity,
  DemandItem,
  ReorderRequest,
  DiseaseWatch,
  ActionItemRollup,
  PipelineSnapshot,
  RevenueSignals,
  TerritoryCoverage,
  CompetitiveIntelligence,
  WeekOverWeek,
} from "@/lib/digest-generator";

interface DigestData {
  id: string;
  digest_date: string;
  total_calls_logged: number;
  total_follow_ups_needed: number;
  top_diseases: Array<{ disease_name: string; mention_count: number }> | null;
  top_products: Array<{ product_name: string; request_count: number }> | null;
  rep_activity_breakdown: DigestStructuredData | null;
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
  recommended_actions: Array<{ action: string; priority: string | null }> | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-0",
  warning: "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0",
  watch: "bg-yellow-100/70 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0",
  info: "bg-sky-100/70 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0",
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

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });

  const [digest, setDigest] = useState<DigestData | null>(null);
  const [trends, setTrends] = useState<TrendSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Guard against concurrent fetches — only the latest fetch wins
  const fetchId = useRef(0);

  const doFetch = useCallback(async (date: string, withFallback: boolean) => {
    const id = ++fetchId.current;
    setLoading(true);
    setDigest(null);
    setFetchError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (id !== fetchId.current) return; // superseded by newer fetch

      const authHeaders: Record<string, string> = {};
      if (session?.access_token) authHeaders["Authorization"] = `Bearer ${session.access_token}`;

      const fallbackParam = withFallback ? "&fallback=latest" : "";
      const res = await fetch(`/api/turf/daily-digest?date=${date}${fallbackParam}`, {
        headers: authHeaders,
      });
      if (id !== fetchId.current) return; // superseded

      if (res.ok) {
        const data = await res.json();
        if (data.digest) {
          setDigest(data.digest);
          if (data.digest.digest_date && data.digest.digest_date !== date) {
            setSelectedDate(data.digest.digest_date);
          }
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setFetchError(body.error || `API error ${res.status}`);
      }

      // Trend signals — non-critical, fire and forget
      Promise.resolve(
        supabase
          .from("field_trend_signals")
          .select("id, signal_type, severity, title, description, data_points, is_active, recommended_actions")
          .eq("is_active", true)
          .order("severity", { ascending: false })
          .limit(10)
      )
        .then(({ data: signalsData }) => {
          if (id === fetchId.current) {
            setTrends((signalsData as TrendSignal[]) || []);
          }
        })
        .catch(() => {});
    } catch (err) {
      if (id !== fetchId.current) return;
      setFetchError(err instanceof Error ? err.message : "Failed to load digest");
    } finally {
      if (id === fetchId.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial fetch only
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    doFetch(d.toISOString().split("T")[0], true);
  }, [doFetch]);

  // User-driven date change
  const changeDate = useCallback((newDate: string) => {
    setSelectedDate(newDate);
    doFetch(newDate, false);
  }, [doFetch]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/turf/daily-digest", {
        method: "POST",
        headers,
        body: JSON.stringify({ digest_date: selectedDate }),
      });
      if (res.ok) {
        doFetch(selectedDate, false);
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error || `Generation failed (${res.status})`);
      }
    } catch {
      setGenerateError("Network error — could not reach server");
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
    changeDate(d.toISOString().split("T")[0]);
  };

  // Extract structured data (new format) or fall back — guard against old flat-array format
  const structured = (() => {
    try {
      const val = digest?.rep_activity_breakdown;
      if (val != null && typeof val === "object" && !Array.isArray(val) && "executive_summary" in val) {
        return val as DigestStructuredData;
      }
    } catch {
      // Malformed data — treat as no structured data
    }
    return null;
  })();

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-8 pb-12 pt-2">
      {/* Header with date picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary/70 mb-1">Daily Digest</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatDateStr(selectedDate)}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <div className="rounded-full bg-secondary/60 p-1 flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)} className="h-8 w-8 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-2 py-1 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => changeDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-[130px]"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} className="h-8 w-8 rounded-full">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading — skeleton placeholders */}
      {loading && (
        <div className="stagger-enter space-y-8">
          {/* Stat card skeletons */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="border-border/30">
                <CardContent className="p-5 space-y-2">
                  <div className="skeleton h-8 w-16 mx-auto rounded" style={{ animationDelay: `${i * 100}ms` }} />
                  <div className="skeleton h-3 w-20 mx-auto rounded" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Briefing skeleton */}
          <Card className="border-0 shadow-[var(--shadow-elevated)]">
            <CardContent className="p-6 space-y-3">
              <div className="skeleton h-3 w-32 rounded" style={{ animationDelay: "200ms" }} />
              <div className="skeleton h-4 w-full rounded" style={{ animationDelay: "300ms" }} />
              <div className="skeleton h-4 w-5/6 rounded" style={{ animationDelay: "400ms" }} />
              <div className="skeleton h-4 w-4/6 rounded" style={{ animationDelay: "500ms" }} />
            </CardContent>
          </Card>
          {/* Section skeletons */}
          {[0, 1].map((i) => (
            <Card key={i} className="border-border/30">
              <CardContent className="p-6 space-y-3">
                <div className="skeleton h-3 w-28 rounded" style={{ animationDelay: `${600 + i * 200}ms` }} />
                <div className="skeleton h-12 w-full rounded" style={{ animationDelay: `${700 + i * 200}ms` }} />
                <div className="skeleton h-12 w-full rounded" style={{ animationDelay: `${800 + i * 200}ms` }} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No digest — generate */}
      {!loading && !digest && (
        <Card className="border-0 shadow-[var(--shadow-elevated)]">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center",
              fetchError ? "bg-rose-100 dark:bg-rose-900/30" : "bg-primary/[0.06]"
            )}>
              {fetchError ? (
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              ) : (
                <Sparkles className="h-8 w-8 text-primary/40" />
              )}
            </div>
            <div className="text-center">
              <p className="font-medium">{fetchError ? "Failed to load digest" : "No digest available"}</p>
              {fetchError ? (
                <p className="text-sm text-rose-600 dark:text-rose-400 mt-1 max-w-md">{fetchError}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">{formatDateStr(selectedDate)}</p>
              )}
            </div>
            {fetchError && (
              <Button onClick={() => doFetch(selectedDate, false)} className="min-h-[44px] gap-2">
                Try Again
              </Button>
            )}
            {isAdmin && (
              <Button onClick={handleGenerate} disabled={generating} className="min-h-[44px] gap-2">
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generate Digest</>
                )}
              </Button>
            )}
            {generateError && (
              <p className="text-sm text-rose-600 dark:text-rose-400 mt-2">{generateError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Digest content */}
      {!loading && digest && (
        <div className="stagger-enter space-y-8">
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard value={digest.total_calls_logged} label="Calls Logged" />
            <StatCard
              value={structured?.rep_activity?.length || 0}
              label="Active Reps"
              suffix={`/ ${(structured?.rep_activity?.length || 0) + (structured?.inactive_reps?.length || 0)}`}
            />
            <StatCard value={digest.total_follow_ups_needed} label="Follow-ups" accent={digest.total_follow_ups_needed > 0} />
            <StatCard value={trends.length} label="Active Alerts" accent={trends.length > 0} />
          </div>

          {/* No activity */}
          {digest.total_calls_logged === 0 && (
            <Card className="border-border/30">
              <CardContent className="py-8 text-center space-y-2">
                {structured?.diagnostics && structured.diagnostics.total > 0 ? (
                  <>
                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                      {structured.diagnostics.total} call log{structured.diagnostics.total !== 1 ? "s were" : " was"} recorded but {structured.diagnostics.total !== 1 ? "haven't" : "hasn't"} finished processing.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Statuses: {Object.entries(structured.diagnostics.statuses).map(([s, c]) => `${s}: ${c}`).join(", ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Visit the Calls page to check their status, then regenerate the digest.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No field activity recorded for this date.</p>
                )}
              </CardContent>
            </Card>
          )}

          {digest.total_calls_logged > 0 && structured && (
            <>
              {/* Week-over-week metrics bar */}
              <WeekOverWeekBar data={structured.week_over_week} />

              {/* a. Executive Summary */}
              {structured.executive_summary && (
                <Card className="relative overflow-hidden border-0 shadow-[var(--shadow-elevated)] bg-gradient-to-br from-primary/[0.04] via-card to-card">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-primary/80">
                      Executive Briefing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[15px] leading-[1.7] text-foreground/90 whitespace-pre-line">
                      {structured.executive_summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Pipeline Snapshot */}
              <PipelineSnapshotSection data={structured.pipeline_snapshot} />

              {/* Revenue Signals */}
              <RevenueSignalsSection data={structured.revenue_signals} />

              {/* b. Rep Activity Breakdown */}
              <RepActivitySection
                reps={structured.rep_activity || []}
                inactiveReps={structured.inactive_reps || []}
              />

              {/* Territory Coverage */}
              <TerritoryCoverageSection data={structured.territory_coverage} />

              {/* c. Demand Intelligence */}
              <DemandIntelligenceSection
                products={structured.demand_intelligence?.products_in_demand || []}
                reorders={structured.demand_intelligence?.reorder_requests || []}
              />

              {/* Competitor Intelligence */}
              <CompetitorIntelligenceSection data={structured.competitive_intelligence} />

              {/* d. Disease/Pest Watch */}
              <DiseaseWatchSection diseases={structured.disease_watch || []} />

              {/* e. Action Items Rollup */}
              <ActionItemsSection rollup={structured.action_items_rollup || []} />
            </>
          )}

          {/* Fallback for old-format digests (key_highlights only) */}
          {digest.total_calls_logged > 0 && !structured?.executive_summary && digest.key_highlights && (
            <Card className="relative overflow-hidden border-0 shadow-[var(--shadow-elevated)] bg-gradient-to-br from-primary/[0.04] via-card to-card">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-primary/80">
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[15px] leading-[1.7] text-foreground/90 whitespace-pre-line">{digest.key_highlights}</p>
              </CardContent>
            </Card>
          )}

          {/* Trend Alerts */}
          {trends.length > 0 && (
            <Card className="border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Active Trend Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/20">
                  {trends.map((signal) => (
                    <div key={signal.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.info}>
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
                        <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(signal.id)} className="shrink-0 text-[11px] h-7 text-muted-foreground/60 hover:text-foreground">
                          Acknowledge
                        </Button>
                      </div>
                      {signal.recommended_actions && signal.recommended_actions.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-medium text-muted-foreground">Recommended actions:</p>
                          <ul className="space-y-0.5">
                            {signal.recommended_actions.map((action, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-muted-foreground/50" />
                                {action.action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer: Regenerate + Email + timestamp */}
          <div className="flex flex-col items-center gap-3 border-t border-border/15 pt-6">
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="ghost" onClick={handleGenerate} disabled={generating} className="gap-2 text-[13px] text-muted-foreground/70 hover:text-foreground">
                  {generating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Regenerating...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" />Regenerate</>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                className="gap-2 text-[13px] text-muted-foreground/70 hover:text-foreground"
                title="Email delivery coming soon"
                onClick={() => {/* Coming soon */}}
                disabled
              >
                <Mail className="h-3.5 w-3.5" />
                Email Digest
              </Button>
            </div>
            {digest.generated_at && (
              <p className="text-[11px] text-muted-foreground/40">
                Generated{" "}
                {new Date(digest.generated_at).toLocaleString("en-CA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({ value, label, suffix, accent }: { value: number; label: string; suffix?: string; accent?: boolean }) {
  return (
    <Card className={cn(
      "bg-gradient-to-b from-card to-card/80 border-border/30",
      accent && value > 0 && "from-primary/[0.04] to-card"
    )}>
      <CardContent className="p-5 text-center">
        <p className="text-3xl font-bold tracking-tight tabular-nums">
          {value}
          {suffix && <span className="text-sm font-normal text-muted-foreground ml-0.5">{suffix}</span>}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Rep Activity Section
// ---------------------------------------------------------------------------

function RepActivitySection({
  reps,
  inactiveReps,
}: {
  reps: RepActivity[];
  inactiveReps: Array<{ name: string; territory: string | null }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayReps = expanded ? reps : reps.slice(0, 5);

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Rep Activity
          <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-muted-foreground/60">
            {reps.length} active
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/30">
          {displayReps.map((rep) => {
            const sentTotal = rep.sentiment_summary.positive + rep.sentiment_summary.neutral +
              rep.sentiment_summary.concerned + rep.sentiment_summary.urgent;
            const hasUrgent = rep.sentiment_summary.urgent > 0 || rep.sentiment_summary.concerned > 0;

            return (
              <div key={rep.rep_id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 ring-1 ring-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{rep.rep_name}</p>
                      {rep.territory && (
                        <p className="text-[10px] text-muted-foreground">{rep.territory}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="font-semibold tabular-nums">{rep.calls_logged}</span>
                    <span className="text-muted-foreground">calls</span>
                    {hasUrgent && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" title="Has urgent/concerned calls" />
                    )}
                  </div>
                </div>

                {/* Accounts */}
                {rep.accounts_touched.length > 0 && (
                  <p className="text-xs text-muted-foreground pl-10 truncate">
                    {rep.accounts_touched.join(", ")}
                  </p>
                )}

                {/* Commitments */}
                {rep.commitments.length > 0 && (
                  <div className="pl-10 space-y-0.5">
                    {rep.commitments.slice(0, 3).map((c, i) => (
                      <p key={i} className="text-xs flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {c.description}
                          {c.deadline && (
                            <span className="text-amber-600 font-medium"> (due {c.deadline})</span>
                          )}
                        </span>
                      </p>
                    ))}
                  </div>
                )}

                {/* Sentiment bar */}
                {sentTotal > 0 && (
                  <div className="flex gap-px h-1 rounded-full overflow-hidden ml-10 opacity-60">
                    {rep.sentiment_summary.positive > 0 && (
                      <div className="bg-emerald-400" style={{ flex: rep.sentiment_summary.positive }} />
                    )}
                    {rep.sentiment_summary.neutral > 0 && (
                      <div className="bg-gray-300 dark:bg-gray-600" style={{ flex: rep.sentiment_summary.neutral }} />
                    )}
                    {rep.sentiment_summary.concerned > 0 && (
                      <div className="bg-amber-400" style={{ flex: rep.sentiment_summary.concerned }} />
                    )}
                    {rep.sentiment_summary.urgent > 0 && (
                      <div className="bg-rose-400" style={{ flex: rep.sentiment_summary.urgent }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {reps.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors w-full text-center py-2 mt-2"
          >
            {expanded ? "Show less" : `Show all ${reps.length} reps`}
          </button>
        )}

        {/* Inactive reps */}
        {inactiveReps.length > 0 && (
          <div className="border-t border-border/30 mt-2 pt-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{inactiveReps.length} reps</span> did not log activity:{" "}
              {inactiveReps.map((r) => r.name).join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Demand Intelligence Section
// ---------------------------------------------------------------------------

function DemandIntelligenceSection({
  products,
  reorders,
}: {
  products: DemandItem[];
  reorders: ReorderRequest[];
}) {
  if (products.length === 0 && reorders.length === 0) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Demand Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Products in demand */}
        {products.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">Products in Demand</p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left py-1.5 pr-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Product</th>
                    <th className="text-right py-1.5 px-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Mentions</th>
                    <th className="text-right py-1.5 px-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Requests</th>
                    <th className="text-right py-1.5 pl-2 text-[11px] uppercase tracking-wider text-muted-foreground/60 font-medium">Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {products.slice(0, 8).map((p) => (
                    <tr key={p.product_name} className={p.is_low_stock ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[180px] capitalize">{p.product_name}</span>
                          {p.is_low_stock && (
                            <Badge className="text-[9px] bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 shrink-0">LOW</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.mention_count}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {p.request_count > 0 ? (
                          <span className="font-medium text-primary">{p.request_count}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">
                        {p.inventory_on_hand != null ? (
                          <span className={p.is_low_stock ? "text-amber-600 font-medium" : ""}>
                            {p.inventory_on_hand}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reorder requests */}
        {reorders.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">Reorder Requests</p>
            <div className="divide-y divide-border/20">
              {reorders.slice(0, 6).map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium capitalize truncate">{r.product_name}</span>
                    <span className="text-muted-foreground truncate">for {r.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    {r.quantity && <span className="tabular-nums">{r.quantity} units</span>}
                    {r.needed_by && (
                      <span className="text-[10px] text-muted-foreground/70">
                        by {r.needed_by}
                      </span>
                    )}
                    <span className="text-[10px]">via {r.rep_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Disease/Pest Watch Section
// ---------------------------------------------------------------------------

function DiseaseWatchSection({ diseases }: { diseases: DiseaseWatch[] }) {
  if (diseases.length === 0) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          Disease / Pest Watch
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/20">
          {diseases.slice(0, 8).map((d) => (
            <div key={d.disease_name} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium">{d.disease_name}</span>
                  {d.trending === "up" && (
                    <Badge className="text-[9px] bg-rose-100/80 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-0 gap-0.5">
                      <ArrowUp className="h-2.5 w-2.5" />
                      Trending
                    </Badge>
                  )}
                  {d.trending === "new" && (
                    <Badge className="text-[9px] bg-sky-100/80 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0">
                      New
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground/70 shrink-0">
                  <span>{d.mention_count} mentions</span>
                  <span>{d.rep_count} reps</span>
                </div>
              </div>
              {d.regions.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Regions: {d.regions.join(", ")}
                </p>
              )}
              {d.related_products.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {d.related_products.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] h-5 border-border/30 text-muted-foreground/80">
                      {p}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Action Items Rollup Section
// ---------------------------------------------------------------------------

function ActionItemsSection({ rollup }: { rollup: ActionItemRollup[] }) {
  const allItems = rollup.flatMap((r) => r.items);
  if (allItems.length === 0) return null;

  const overdueCount = allItems.filter((i) => i.status === "overdue").length;
  const dueTodayCount = allItems.filter((i) => i.status === "due_today").length;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Action Items
          <div className="flex gap-2 ml-auto">
            {overdueCount > 0 && (
              <span className="text-[11px] font-normal normal-case tracking-normal text-rose-600 dark:text-rose-400">
                {overdueCount} overdue
              </span>
            )}
            {dueTodayCount > 0 && (
              <span className="text-[11px] font-normal normal-case tracking-normal text-amber-600 dark:text-amber-400">
                {dueTodayCount} due today
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rollup.slice(0, 8).map((rep) => (
          <div key={rep.rep_id}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">{rep.rep_name}</p>
            <div className="divide-y divide-border/20">
              {rep.items.slice(0, 5).map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 text-xs py-2.5 first:pt-0 last:pb-0",
                    item.status === "overdue" && "border-l-2 border-l-rose-400/60 pl-3",
                    item.status === "due_today" && "border-l-2 border-l-amber-400/60 pl-3"
                  )}
                >
                  <Clock className={cn(
                    "h-3.5 w-3.5 shrink-0 mt-0.5",
                    item.status === "overdue" ? "text-rose-500" :
                    item.status === "due_today" ? "text-amber-500" :
                    "text-muted-foreground"
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.company_name && (
                        <span className="text-[10px] text-muted-foreground">{item.company_name}</span>
                      )}
                      {item.due_date && (
                        <span className={cn(
                          "text-[10px] font-medium",
                          item.status === "overdue" ? "text-rose-600" :
                          item.status === "due_today" ? "text-amber-600" :
                          "text-muted-foreground"
                        )}>
                          {item.status === "overdue" ? `Overdue (${item.due_date})` :
                           item.status === "due_today" ? "Due today" :
                           `Due ${item.due_date}`}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[9px] h-4 border-border/30 text-muted-foreground/80">{item.type.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {rep.items.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                +{rep.items.length - 5} more items
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Week-over-Week Bar
// ---------------------------------------------------------------------------

function WeekOverWeekBar({ data }: { data?: WeekOverWeek }) {
  if (!data) return null;

  const metrics = [
    {
      label: "Calls",
      current: data.calls_this_week,
      previous: data.calls_last_week,
      change: data.calls_change_percent,
    },
    {
      label: "Accounts",
      current: data.accounts_this_week,
      previous: data.accounts_last_week,
      change: data.accounts_last_week > 0
        ? Math.round(((data.accounts_this_week - data.accounts_last_week) / data.accounts_last_week) * 100)
        : 0,
    },
    {
      label: "Pipeline",
      current: data.pipeline_this_week,
      previous: data.pipeline_last_week,
      change: data.pipeline_last_week > 0
        ? Math.round(((data.pipeline_this_week - data.pipeline_last_week) / data.pipeline_last_week) * 100)
        : 0,
      isCurrency: true,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{m.label} (WoW)</p>
            <p className="text-sm font-semibold tabular-nums">
              {m.isCurrency ? `$${(m.current / 1000).toFixed(0)}K` : m.current}
            </p>
          </div>
          {m.change !== 0 && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              m.change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {m.change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(m.change)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Snapshot Section
// ---------------------------------------------------------------------------

function PipelineSnapshotSection({ data }: { data?: PipelineSnapshot }) {
  if (!data) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Pipeline Snapshot
          <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-muted-foreground/60">
            ${(data.total_pipeline_value / 1000).toFixed(0)}K total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New deals today */}
        {data.new_deals_count > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.new_deals_count} new deal{data.new_deals_count !== 1 ? "s" : ""}</span>{" "}
            today worth <span className="font-medium text-foreground">${(data.new_deals_value / 1000).toFixed(1)}K</span>
          </p>
        )}

        {/* Stage breakdown */}
        {data.stage_breakdown.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">By Stage</p>
            <div className="space-y-1.5">
              {data.stage_breakdown.map((s) => (
                <div key={s.stage} className="flex items-center gap-2 text-xs">
                  <span className="w-24 truncate capitalize text-muted-foreground">{s.stage.replace(/_/g, " ")}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${data.total_pipeline_value > 0 ? (s.value / data.total_pipeline_value) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground tabular-nums w-14 text-right">${(s.value / 1000).toFixed(0)}K</span>
                  <span className="text-muted-foreground/50 tabular-nums w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deals closing this week */}
        {data.deals_closing_this_week.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">Closing This Week</p>
            <div className="divide-y divide-border/20">
              {data.deals_closing_this_week.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">{d.company_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">${(d.value / 1000).toFixed(1)}K</span>
                    <Badge variant="outline" className="text-[9px] h-4 border-border/30 text-muted-foreground/80 capitalize">
                      {d.stage.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Revenue Signals Section
// ---------------------------------------------------------------------------

function RevenueSignalsSection({ data }: { data?: RevenueSignals }) {
  if (!data) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Revenue Signals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{data.quotes_sent_today}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quotes Sent</p>
            {data.quotes_total_value > 0 && (
              <p className="text-[10px] text-muted-foreground">${(data.quotes_total_value / 1000).toFixed(1)}K</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{data.orders_placed_today}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p>
            {data.orders_total_value > 0 && (
              <p className="text-[10px] text-muted-foreground">${(data.orders_total_value / 1000).toFixed(1)}K</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{data.deliveries_today}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deliveries</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">
              ${((data.quotes_total_value + data.orders_total_value) / 1000).toFixed(0)}K
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">In Motion</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Territory Coverage Section
// ---------------------------------------------------------------------------

function TerritoryCoverageSection({ data }: { data?: TerritoryCoverage }) {
  if (!data) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Map className="h-4 w-4 text-primary" />
          Territory Coverage
          <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-muted-foreground/60">
            {data.coverage_percent}% today
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold">{data.accounts_touched_today}</span>
          <span className="text-muted-foreground">of {data.total_accounts} accounts touched</span>
        </div>

        {/* Coverage bar */}
        <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              data.coverage_percent >= 50 ? "bg-emerald-500/70" :
              data.coverage_percent >= 25 ? "bg-amber-500/70" :
              "bg-rose-500/70"
            )}
            style={{ width: `${data.coverage_percent}%` }}
          />
        </div>

        {/* Dark territories */}
        {data.dark_territories.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">
              Dark Territories <span className="normal-case">(no activity in 3+ days)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.dark_territories.map((t) => (
                <Badge key={t.territory} variant="outline" className="text-[10px] border-amber-300/50 text-amber-700 dark:text-amber-400 gap-1">
                  <Eye className="h-2.5 w-2.5" />
                  {t.territory}
                  <span className="text-muted-foreground/60">{t.days_since_activity}d</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Competitor Intelligence Section
// ---------------------------------------------------------------------------

function CompetitorIntelligenceSection({ data }: { data?: CompetitiveIntelligence }) {
  if (!data || data.mentions.length === 0) return null;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Competitive Intelligence
          <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-muted-foreground/60">
            {data.total_mentions} mention{data.total_mentions !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/20">
          {data.mentions.slice(0, 6).map((m) => (
            <div key={m.competitor_name} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.competitor_name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{m.mention_count} mention{m.mention_count !== 1 ? "s" : ""}</span>
              </div>
              {m.context_snippets.length > 0 && (
                <div className="space-y-1">
                  {m.context_snippets.slice(0, 2).map((snippet, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-2 border-l-2 border-border/30">
                      {snippet}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

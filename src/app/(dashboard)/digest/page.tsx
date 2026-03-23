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
  ArrowUp,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Mail,
  Package,
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

    const { data: { session } } = await supabase.auth.getSession();
    const authHeaders: Record<string, string> = {};
    if (session?.access_token) authHeaders["Authorization"] = `Bearer ${session.access_token}`;
    const res = await fetch(`/api/turf/daily-digest?date=${selectedDate}`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setDigest(data.digest || null);
    }

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

  const [generateError, setGenerateError] = useState<string | null>(null);

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
        await fetchDigest();
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
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Extract structured data (new format) or fall back
  const structured = digest?.rep_activity_breakdown as DigestStructuredData | null;

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-5 pb-8">
      {/* Header with date picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Daily Digest
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDateStr(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)} className="h-9 w-9">
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
          <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No digest — generate */}
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
              <Button onClick={handleGenerate} disabled={generating} className="min-h-[44px] gap-2">
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generate Digest</>
                )}
              </Button>
            )}
            {generateError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{generateError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Digest content */}
      {!loading && digest && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard value={digest.total_calls_logged} label="Calls Logged" />
            <StatCard
              value={structured?.rep_activity?.length || 0}
              label="Active Reps"
              suffix={`/ ${(structured?.rep_activity?.length || 0) + (structured?.inactive_reps?.length || 0)}`}
            />
            <StatCard value={digest.total_follow_ups_needed} label="Follow-ups" />
            <StatCard value={trends.length} label="Active Alerts" />
          </div>

          {/* No activity */}
          {digest.total_calls_logged === 0 && (
            <Card>
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
              {/* a. Executive Summary */}
              {structured.executive_summary && (
                <Card className="border-primary/20 bg-primary/[0.02]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Executive Briefing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {structured.executive_summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* b. Rep Activity Breakdown */}
              <RepActivitySection
                reps={structured.rep_activity || []}
                inactiveReps={structured.inactive_reps || []}
              />

              {/* c. Demand Intelligence */}
              <DemandIntelligenceSection
                products={structured.demand_intelligence?.products_in_demand || []}
                reorders={structured.demand_intelligence?.reorder_requests || []}
              />

              {/* d. Disease/Pest Watch */}
              <DiseaseWatchSection diseases={structured.disease_watch || []} />

              {/* e. Action Items Rollup */}
              <ActionItemsSection rollup={structured.action_items_rollup || []} />
            </>
          )}

          {/* Fallback for old-format digests (key_highlights only) */}
          {digest.total_calls_logged > 0 && !structured?.executive_summary && digest.key_highlights && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line">{digest.key_highlights}</p>
              </CardContent>
            </Card>
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
                  <div key={signal.id} className="rounded-xl border p-4 space-y-2">
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
                      <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(signal.id)} className="shrink-0 text-xs h-8">
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
              </CardContent>
            </Card>
          )}

          {/* Footer: Regenerate + Email + timestamp */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2 text-sm">
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Regenerating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" />Regenerate</>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 text-sm"
                title="Email delivery coming soon"
                onClick={() => {/* Coming soon */}}
                disabled
              >
                <Mail className="h-4 w-4" />
                Email Digest
              </Button>
            </div>
            {digest.generated_at && (
              <p className="text-xs text-muted-foreground">
                Generated{" "}
                {new Date(digest.generated_at).toLocaleString("en-CA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({ value, label, suffix }: { value: number; label: string; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold">
          {value}
          {suffix && <span className="text-sm font-normal text-muted-foreground ml-0.5">{suffix}</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Rep Activity
          <Badge variant="secondary" className="text-[10px] font-normal ml-auto">
            {reps.length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayReps.map((rep) => {
          const sentTotal = rep.sentiment_summary.positive + rep.sentiment_summary.neutral +
            rep.sentiment_summary.concerned + rep.sentiment_summary.urgent;
          const hasUrgent = rep.sentiment_summary.urgent > 0 || rep.sentiment_summary.concerned > 0;

          return (
            <div key={rep.rep_id} className="rounded-lg border px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
                  <span className="font-semibold">{rep.calls_logged} calls</span>
                  {hasUrgent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Has urgent/concerned calls" />
                  )}
                </div>
              </div>

              {/* Accounts */}
              {rep.accounts_touched.length > 0 && (
                <p className="text-xs text-muted-foreground pl-9 truncate">
                  {rep.accounts_touched.join(", ")}
                </p>
              )}

              {/* Commitments */}
              {rep.commitments.length > 0 && (
                <div className="pl-9 space-y-0.5">
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
                <div className="flex gap-0.5 h-1 rounded-full overflow-hidden ml-9">
                  {rep.sentiment_summary.positive > 0 && (
                    <div className="bg-green-400" style={{ flex: rep.sentiment_summary.positive }} />
                  )}
                  {rep.sentiment_summary.neutral > 0 && (
                    <div className="bg-gray-300 dark:bg-gray-600" style={{ flex: rep.sentiment_summary.neutral }} />
                  )}
                  {rep.sentiment_summary.concerned > 0 && (
                    <div className="bg-amber-400" style={{ flex: rep.sentiment_summary.concerned }} />
                  )}
                  {rep.sentiment_summary.urgent > 0 && (
                    <div className="bg-red-400" style={{ flex: rep.sentiment_summary.urgent }} />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {reps.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline w-full text-center py-1"
          >
            {expanded ? "Show less" : `Show all ${reps.length} reps`}
          </button>
        )}

        {/* Inactive reps */}
        {inactiveReps.length > 0 && (
          <div className="rounded-lg border border-dashed px-3 py-2 mt-2">
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Demand Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Products in demand */}
        {products.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Products in Demand</p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 pr-2 font-medium">Product</th>
                    <th className="text-right py-1.5 px-2 font-medium">Mentions</th>
                    <th className="text-right py-1.5 px-2 font-medium">Requests</th>
                    <th className="text-right py-1.5 pl-2 font-medium">Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 8).map((p) => (
                    <tr key={p.product_name} className={`border-b last:border-b-0 ${p.is_low_stock ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[180px] capitalize">{p.product_name}</span>
                          {p.is_low_stock && (
                            <Badge className="text-[9px] bg-red-100 text-red-700 shrink-0">LOW</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right">{p.mention_count}</td>
                      <td className="py-1.5 px-2 text-right">
                        {p.request_count > 0 ? (
                          <span className="font-medium text-primary">{p.request_count}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        {p.inventory_on_hand != null ? (
                          <span className={p.is_low_stock ? "text-red-600 font-medium" : ""}>
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
            <p className="text-xs font-medium text-muted-foreground mb-2">Reorder Requests</p>
            <div className="space-y-1.5">
              {reorders.slice(0, 6).map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium capitalize truncate">{r.product_name}</span>
                    <span className="text-muted-foreground truncate">for {r.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    {r.quantity && <span>{r.quantity} units</span>}
                    {r.needed_by && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        by {r.needed_by}
                      </Badge>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          Disease / Pest Watch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {diseases.slice(0, 8).map((d) => (
          <div key={d.disease_name} className="rounded-lg border px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium">{d.disease_name}</span>
                {d.trending === "up" && (
                  <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-0.5">
                    <ArrowUp className="h-2.5 w-2.5" />
                    Trending
                  </Badge>
                )}
                {d.trending === "new" && (
                  <Badge className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    New
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
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
                  <Badge key={p} variant="outline" className="text-[10px] h-5">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Action Items
          <div className="flex gap-1.5 ml-auto">
            {overdueCount > 0 && (
              <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {overdueCount} overdue
              </Badge>
            )}
            {dueTodayCount > 0 && (
              <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {dueTodayCount} due today
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rollup.slice(0, 8).map((rep) => (
          <div key={rep.rep_id}>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{rep.rep_name}</p>
            <div className="space-y-1">
              {rep.items.slice(0, 5).map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${
                    item.status === "overdue"
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                      : item.status === "due_today"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                        : ""
                  }`}
                >
                  <Clock className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                    item.status === "overdue" ? "text-red-500" :
                    item.status === "due_today" ? "text-amber-500" :
                    "text-muted-foreground"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.company_name && (
                        <span className="text-[10px] text-muted-foreground">{item.company_name}</span>
                      )}
                      {item.due_date && (
                        <span className={`text-[10px] font-medium ${
                          item.status === "overdue" ? "text-red-600" :
                          item.status === "due_today" ? "text-amber-600" :
                          "text-muted-foreground"
                        }`}>
                          {item.status === "overdue" ? `Overdue (${item.due_date})` :
                           item.status === "due_today" ? "Due today" :
                           `Due ${item.due_date}`}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[9px] h-4">{item.type.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {rep.items.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  +{rep.items.length - 5} more items
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

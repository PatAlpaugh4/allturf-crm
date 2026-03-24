// ============================================================================
// Allturf CRM — Daily Digest Generator
// Gathers field activity, runs trend detection, and generates an AI-powered
// management summary stored in the daily_digests table.
//
// Future: trigger via scheduled task (cron) each morning at 7:00 AM ET.
// For now, on-demand via UI or POST /api/turf/daily-digest.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";
import { getLLM } from "@/lib/llm";
import { detectTrends } from "@/lib/trend-detector";
import type {
  TrendAction,
  TrendSeverity,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DigestDiagnostics {
  total: number;
  statuses: Record<string, number>;
}

export interface DigestResult {
  success: boolean;
  digest_id?: string;
  no_activity?: boolean;
  diagnostics?: DigestDiagnostics;
  error?: string;
}

// Per-rep activity breakdown stored in rep_activity_breakdown JSONB
export interface RepActivity {
  rep_id: string;
  rep_name: string;
  territory: string | null;
  calls_logged: number;
  accounts_touched: string[];
  commitments: Array<{ description: string; deadline: string | null }>;
  sentiment_summary: { positive: number; neutral: number; concerned: number; urgent: number };
}

// Demand intelligence stored in top_products JSONB (enhanced)
export interface DemandItem {
  product_name: string;
  product_id: string | null;
  mention_count: number;
  request_count: number;
  inventory_on_hand: number | null;
  reorder_point: number | null;
  is_low_stock: boolean;
}

export interface ReorderRequest {
  product_name: string;
  customer_name: string;
  rep_name: string;
  quantity: number | null;
  needed_by: string | null;
}

export interface ActionItemRollup {
  rep_name: string;
  rep_id: string;
  items: Array<{
    description: string;
    type: string;
    due_date: string | null;
    company_name: string | null;
    status: "pending" | "due_today" | "overdue";
  }>;
}

export interface DiseaseWatch {
  disease_name: string;
  mention_count: number;
  rep_count: number;
  regions: string[];
  trending: "up" | "stable" | "new";
  related_products: string[];
}

export interface PipelineSnapshot {
  total_pipeline_value: number;
  new_deals_count: number;
  new_deals_value: number;
  stage_breakdown: Array<{ stage: string; count: number; value: number }>;
  deals_closing_this_week: Array<{ name: string; company_name: string; value: number; stage: string }>;
}

export interface RevenueSignals {
  quotes_sent_today: number;
  quotes_total_value: number;
  orders_placed_today: number;
  orders_total_value: number;
  deliveries_today: number;
}

export interface TerritoryCoverage {
  total_accounts: number;
  accounts_touched_today: number;
  coverage_percent: number;
  dark_territories: Array<{ territory: string; days_since_activity: number }>;
}

export interface CompetitiveIntelligence {
  mentions: Array<{ competitor_name: string; mention_count: number; context_snippets: string[] }>;
  total_mentions: number;
}

export interface WeekOverWeek {
  calls_this_week: number;
  calls_last_week: number;
  calls_change_percent: number;
  accounts_this_week: number;
  accounts_last_week: number;
  pipeline_this_week: number;
  pipeline_last_week: number;
}

// All structured data embedded in the digest record
export interface DigestStructuredData {
  executive_summary: string;
  rep_activity: RepActivity[];
  inactive_reps: Array<{ name: string; territory: string | null }>;
  demand_intelligence: {
    products_in_demand: DemandItem[];
    reorder_requests: ReorderRequest[];
  };
  disease_watch: DiseaseWatch[];
  action_items_rollup: ActionItemRollup[];
  sentiment_totals: { positive: number; neutral: number; concerned: number; urgent: number };
  diagnostics?: DigestDiagnostics;
  pipeline_snapshot?: PipelineSnapshot;
  revenue_signals?: RevenueSignals;
  territory_coverage?: TerritoryCoverage;
  competitive_intelligence?: CompetitiveIntelligence;
  week_over_week?: WeekOverWeek;
}

interface DayActivity {
  totalCalls: number;
  callsByRep: Map<string, {
    repName: string;
    territory: string | null;
    calls: number;
    accounts: Set<string>;
    commitments: Array<{ description: string; deadline: string | null }>;
    sentiment: { positive: number; neutral: number; concerned: number; urgent: number };
  }>;
  inactiveReps: Array<{ id: string; full_name: string | null; territory: string | null }>;
  diseasesMentioned: Map<string, { count: number; repIds: Set<string>; territories: Set<string> }>;
  productsMentioned: Map<string, { count: number; requested: number }>;
  sentimentBreakdown: { positive: number; neutral: number; concerned: number; urgent: number };
  urgentCalls: Array<{ summary: string; rep_name: string; company_name: string | null }>;
  actionItemsByRep: Map<string, {
    repName: string;
    items: Array<{
      type: string;
      description: string;
      due_date: string | null;
      company_name: string | null;
    }>;
  }>;
  reorderRequests: Array<{
    product_name: string;
    customer_name: string;
    rep_name: string;
    quantity: number | null;
    needed_by: string | null;
  }>;
  overdueItems: Array<{
    type: string;
    description: string;
    due_date: string;
    rep_name: string;
    rep_id: string;
  }>;
  topCourses: Array<{ company_id: string; company_name: string; call_count: number }>;
  diagnostics?: DigestDiagnostics;
}

interface TrendContext {
  activeSignals: Array<{
    signal_type: string;
    severity: TrendSeverity;
    title: string;
    description: string | null;
    recommended_actions: TrendAction[] | null;
    data_points: number;
  }>;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateDailyDigest(date: Date): Promise<DigestResult> {
  const supabase = createServiceClient();
  const digestDate = formatDate(date);

  // Check if digest already exists for this date
  const { data: existing } = await supabase
    .from("daily_digests")
    .select("id")
    .eq("digest_date", digestDate)
    .single();

  if (existing) {
    await supabase.from("daily_digests").delete().eq("id", existing.id);
  }

  // Gather day's activity
  const activity = await gatherDayActivity(date, supabase);

  // No activity — store a minimal digest
  if (activity.totalCalls === 0) {
    const noActivitySummary = activity.diagnostics
      ? `${activity.diagnostics.total} call log(s) were recorded but none have finished processing. Statuses: ${Object.entries(activity.diagnostics.statuses).map(([s, c]) => `${s}: ${c}`).join(", ")}.`
      : "No field activity was recorded for this date.";

    const structuredData: DigestStructuredData = {
      executive_summary: noActivitySummary,
      rep_activity: [],
      inactive_reps: activity.inactiveReps.map((r) => ({
        name: r.full_name || "Unknown",
        territory: r.territory,
      })),
      demand_intelligence: { products_in_demand: [], reorder_requests: [] },
      disease_watch: [],
      action_items_rollup: [],
      sentiment_totals: { positive: 0, neutral: 0, concerned: 0, urgent: 0 },
      diagnostics: activity.diagnostics,
    };

    const { data: digest } = await supabase
      .from("daily_digests")
      .insert({
        digest_date: digestDate,
        total_calls_logged: 0,
        total_follow_ups_needed: 0,
        top_diseases: [],
        top_products: [],
        rep_activity_breakdown: structuredData,
        key_highlights: "No field activity recorded for this date.",
        alerts: null,
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    return {
      success: true,
      digest_id: digest?.id,
      no_activity: true,
      diagnostics: activity.diagnostics,
    };
  }

  // Run trend detection for trailing 7-day window
  await detectTrends(7).catch(() => {});

  // Gather trend context
  const trends = await gatherTrendContext(supabase);

  // Gather inventory levels for mentioned products
  const inventoryMap = await gatherInventoryLevels(activity, supabase);

  // Gather previous period disease counts for trending detection
  const prevDiseaseCounts = await gatherPreviousPeriodDiseases(date, supabase);

  // Gather new sections in parallel
  const [pipelineSnapshot, revenueSignals, territoryCoverage, weekOverWeek] = await Promise.all([
    gatherPipelineData(date, supabase).catch(() => undefined),
    gatherRevenueSignals(date, supabase).catch(() => undefined),
    gatherTerritoryCoverage(date, activity, supabase).catch(() => undefined),
    gatherWeekOverWeek(date, supabase).catch(() => undefined),
  ]);

  // Gather competitive intelligence from raw call logs
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const { data: rawCallLogs } = await supabase
    .from("call_logs")
    .select("extraction:call_log_extractions(competitor_mentions, summary)")
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString())
    .eq("processing_status", "completed");
  const competitiveIntelligence = gatherCompetitiveIntelligence(
    activity,
    (rawCallLogs || []) as Array<{ extraction: unknown }>
  );

  // Build structured data
  const repActivity = buildRepActivity(activity);
  const demandIntelligence = buildDemandIntelligence(activity, inventoryMap);
  const diseaseWatch = buildDiseaseWatch(activity, prevDiseaseCounts, supabase);
  const actionItemsRollup = buildActionItemsRollup(activity, digestDate);

  // Resolve disease → product links
  const diseaseWatchResolved = await diseaseWatch;

  // Generate AI executive summary
  const executiveSummary = await generateExecutiveSummary(
    activity, repActivity, demandIntelligence, diseaseWatchResolved, actionItemsRollup, trends,
    pipelineSnapshot, competitiveIntelligence, territoryCoverage, weekOverWeek
  );

  const structuredData: DigestStructuredData = {
    executive_summary: executiveSummary,
    rep_activity: repActivity,
    inactive_reps: activity.inactiveReps.map((r) => ({
      name: r.full_name || "Unknown",
      territory: r.territory,
    })),
    demand_intelligence: demandIntelligence,
    disease_watch: diseaseWatchResolved,
    action_items_rollup: actionItemsRollup,
    sentiment_totals: activity.sentimentBreakdown,
    pipeline_snapshot: pipelineSnapshot,
    revenue_signals: revenueSignals,
    territory_coverage: territoryCoverage,
    competitive_intelligence: competitiveIntelligence,
    week_over_week: weekOverWeek,
  };

  // Aggregate counts for top-level columns
  const topDiseases = diseaseWatchResolved.map((d) => ({
    disease_name: d.disease_name,
    mention_count: d.mention_count,
  }));

  const topProducts = demandIntelligence.products_in_demand.map((p) => ({
    product_name: p.product_name,
    request_count: p.request_count,
  }));

  const followUpCount = Array.from(activity.actionItemsByRep.values())
    .flatMap((r) => r.items)
    .filter((ai) => ai.type === "follow_up_call" || ai.type === "schedule_visit")
    .length;

  // Build key_highlights as a combined narrative for backward compatibility
  const keyHighlights = executiveSummary;

  // Insert digest
  const { data: digest, error: insertError } = await supabase
    .from("daily_digests")
    .insert({
      digest_date: digestDate,
      total_calls_logged: activity.totalCalls,
      total_follow_ups_needed: followUpCount,
      top_diseases: topDiseases,
      top_products: topProducts,
      rep_activity_breakdown: structuredData,
      key_highlights: keyHighlights,
      alerts: trends.activeSignals.length > 0
        ? JSON.stringify(trends.activeSignals)
        : null,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    return { success: false, error: `Failed to store digest: ${insertError.message}` };
  }

  return { success: true, digest_id: digest?.id };
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

async function gatherDayActivity(
  date: Date,
  supabase: ReturnType<typeof createServiceClient>
): Promise<DayActivity> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Fetch call logs with extractions + commitments/reorders
  const { data: callLogs, error: callLogsError } = await supabase
    .from("call_logs")
    .select(
      `id, rep_id, company_id, created_at,
       rep:user_profiles(full_name, territory),
       company:companies(name),
       extraction:call_log_extractions(
         summary, sentiment, diseases_mentioned, products_mentioned,
         products_requested, action_items, follow_up_needed, follow_up_date,
         confidence_score, competitor_mentions, budget_signals
       )`
    )
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString())
    .eq("processing_status", "completed");

  if (callLogsError) {
    console.error("[digest] call_logs query failed:", callLogsError.message);
  }

  // Diagnostic: when no completed logs found, check if logs exist in other statuses
  let diagnostics: DigestDiagnostics | undefined;
  if (!callLogs || callLogs.length === 0) {
    const { data: statusCheck } = await supabase
      .from("call_logs")
      .select("processing_status")
      .gte("created_at", dayStart.toISOString())
      .lte("created_at", dayEnd.toISOString());

    if (statusCheck && statusCheck.length > 0) {
      const counts = statusCheck.reduce((acc, r) => {
        const status = r.processing_status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.error("[digest] Found call logs but none completed:", JSON.stringify(counts));
      diagnostics = { total: statusCheck.length, statuses: counts };
    }
  }

  // Fetch all reps
  const { data: allReps, error: allRepsError } = await supabase
    .from("user_profiles")
    .select("id, full_name, territory")
    .eq("is_active", true);

  if (allRepsError) {
    console.error("[digest] user_profiles query failed:", allRepsError.message);
  }

  const callsByRep = new Map<string, DayActivity["callsByRep"] extends Map<string, infer V> ? V : never>();
  const diseasesMentioned = new Map<string, { count: number; repIds: Set<string>; territories: Set<string> }>();
  const productsMentioned = new Map<string, { count: number; requested: number }>();
  const sentimentBreakdown = { positive: 0, neutral: 0, concerned: 0, urgent: 0 };
  const urgentCalls: DayActivity["urgentCalls"] = [];
  const actionItemsByRep = new Map<string, { repName: string; items: Array<{ type: string; description: string; due_date: string | null; company_name: string | null }> }>();
  const reorderRequests: DayActivity["reorderRequests"] = [];
  const courseActivity = new Map<string, { name: string; count: number }>();
  const activeRepIds = new Set<string>();

  if (callLogs) {
    for (const log of callLogs) {
      activeRepIds.add(log.rep_id);

      const rep = log.rep as unknown as { full_name: string | null; territory: string | null } | null;
      const company = log.company as unknown as { name: string } | null;
      const repName = rep?.full_name || "Unknown";
      const territory = rep?.territory || null;

      // Per-rep tracking
      if (!callsByRep.has(log.rep_id)) {
        callsByRep.set(log.rep_id, {
          repName,
          territory,
          calls: 0,
          accounts: new Set(),
          commitments: [],
          sentiment: { positive: 0, neutral: 0, concerned: 0, urgent: 0 },
        });
      }
      const repData = callsByRep.get(log.rep_id)!;
      repData.calls++;
      if (company?.name) repData.accounts.add(company.name);

      // Course tracking
      if (log.company_id && company) {
        const existing = courseActivity.get(log.company_id);
        if (existing) existing.count++;
        else courseActivity.set(log.company_id, { name: company.name, count: 1 });
      }

      // Process extraction data
      const extraction = Array.isArray(log.extraction)
        ? (log.extraction as unknown[])[0]
        : log.extraction;
      if (!extraction) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ext = extraction as any;

      // Sentiment
      if (ext.sentiment && ext.sentiment in sentimentBreakdown) {
        sentimentBreakdown[ext.sentiment as keyof typeof sentimentBreakdown]++;
        repData.sentiment[ext.sentiment as keyof typeof sentimentBreakdown]++;
      }

      // Urgent calls
      if (ext.sentiment === "urgent" || ext.sentiment === "concerned") {
        urgentCalls.push({
          summary: ext.summary || "No summary available",
          rep_name: repName,
          company_name: company?.name || null,
        });
      }

      // Diseases
      if (Array.isArray(ext.diseases_mentioned)) {
        for (const disease of ext.diseases_mentioned) {
          const key = disease.toLowerCase().trim();
          const existing = diseasesMentioned.get(key);
          if (existing) {
            existing.count++;
            existing.repIds.add(log.rep_id);
            if (territory) existing.territories.add(territory);
          } else {
            const territories = new Set<string>();
            if (territory) territories.add(territory);
            diseasesMentioned.set(key, { count: 1, repIds: new Set([log.rep_id]), territories });
          }
        }
      }

      // Products
      if (Array.isArray(ext.products_mentioned)) {
        for (const product of ext.products_mentioned) {
          const key = product.toLowerCase().trim();
          const existing = productsMentioned.get(key);
          if (existing) existing.count++;
          else productsMentioned.set(key, { count: 1, requested: 0 });
        }
      }
      if (Array.isArray(ext.products_requested)) {
        for (const pr of ext.products_requested) {
          const key = (pr.product_name || "").toLowerCase().trim();
          if (!key) continue;
          const existing = productsMentioned.get(key);
          if (existing) { existing.count++; existing.requested++; }
          else productsMentioned.set(key, { count: 1, requested: 1 });
        }
      }

      // Commitments — derive from action_items (commitments no longer stored as separate column)
      if (Array.isArray(ext.action_items)) {
        for (const ai of ext.action_items) {
          if (ai.description) {
            repData.commitments.push({
              description: ai.description,
              deadline: ai.due_date || null,
            });
          }
        }
      }

      // Reorder requests — derive from products_requested
      if (Array.isArray(ext.products_requested)) {
        for (const pr of ext.products_requested) {
          if (pr.product_name) {
            reorderRequests.push({
              product_name: pr.product_name,
              customer_name: company?.name || "Unknown",
              rep_name: repName,
              quantity: pr.quantity || null,
              needed_by: null,
            });
          }
        }
      }

      // Action items
      if (Array.isArray(ext.action_items)) {
        if (!actionItemsByRep.has(log.rep_id)) {
          actionItemsByRep.set(log.rep_id, { repName, items: [] });
        }
        const repActions = actionItemsByRep.get(log.rep_id)!;
        for (const ai of ext.action_items) {
          repActions.items.push({
            type: ai.type,
            description: ai.description,
            due_date: ai.due_date || null,
            company_name: company?.name || null,
          });
        }
      }
    }
  }

  // Inactive reps
  const inactiveReps = (allReps || []).filter((r) => !activeRepIds.has(r.id));

  // Top courses
  const topCourses = Array.from(courseActivity.entries())
    .map(([company_id, data]) => ({ company_id, company_name: data.name, call_count: data.count }))
    .sort((a, b) => b.call_count - a.call_count)
    .slice(0, 8);

  // Overdue action items from previous days
  const { data: overdueExtractions, error: overdueError } = await supabase
    .from("call_log_extractions")
    .select(
      `action_items,
       call_log:call_logs!inner(rep_id, rep:user_profiles(full_name))`
    )
    .lt("created_at", dayStart.toISOString())
    .not("action_items", "is", null);

  if (overdueError) {
    console.error("[digest] overdueExtractions query failed:", overdueError.message);
  }

  const overdueItems: DayActivity["overdueItems"] = [];
  const today = formatDate(date);

  if (overdueExtractions) {
    for (const ext of overdueExtractions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = ext.action_items as any[] | null;
      if (!items) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callLog = ext.call_log as any;
      const repId = callLog?.rep_id || "";
      const repName = callLog?.rep?.full_name || "Unknown";

      for (const item of items) {
        if (item.completed) continue;
        if (item.due_date && item.due_date < today) {
          overdueItems.push({
            type: item.type,
            description: item.description,
            due_date: item.due_date,
            rep_name: repName,
            rep_id: repId,
          });
        }
      }
    }
  }

  return {
    totalCalls: callLogs?.length || 0,
    callsByRep,
    inactiveReps,
    diseasesMentioned,
    productsMentioned,
    sentimentBreakdown,
    urgentCalls,
    actionItemsByRep,
    reorderRequests,
    overdueItems: overdueItems.slice(0, 30),
    topCourses,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// New data gathering: pipeline, revenue, territory, competitors, WoW
// ---------------------------------------------------------------------------

async function gatherPipelineData(
  date: Date,
  supabase: ReturnType<typeof createServiceClient>
): Promise<PipelineSnapshot | undefined> {
  const digestDate = formatDate(date);
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const weekEndStr = formatDate(weekEnd);

  // Open pipeline — exclude terminal stages
  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, stage, value_cad, company:companies(name), created_at, expected_delivery_date")
    .not("stage", "in", '("Closed Lost","Paid","Delivered","Invoiced")');

  if (!deals || deals.length === 0) return undefined;

  const stageMap = new Map<string, { count: number; value: number }>();
  let totalValue = 0;
  let newCount = 0;
  let newValue = 0;
  const closingThisWeek: PipelineSnapshot["deals_closing_this_week"] = [];

  for (const d of deals) {
    const val = Number(d.value_cad) || 0;
    totalValue += val;

    const stage = d.stage || "unknown";
    const existing = stageMap.get(stage) || { count: 0, value: 0 };
    existing.count++;
    existing.value += val;
    stageMap.set(stage, existing);

    if (d.created_at && d.created_at.startsWith(digestDate)) {
      newCount++;
      newValue += val;
    }

    if (d.expected_delivery_date && d.expected_delivery_date <= weekEndStr && d.expected_delivery_date >= digestDate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const companyName = (d.company as any)?.name || "Unknown";
      closingThisWeek.push({ name: d.name || "Untitled", company_name: companyName, value: val, stage });
    }
  }

  return {
    total_pipeline_value: totalValue,
    new_deals_count: newCount,
    new_deals_value: newValue,
    stage_breakdown: Array.from(stageMap.entries())
      .map(([stage, data]) => ({ stage, ...data }))
      .sort((a, b) => b.value - a.value),
    deals_closing_this_week: closingThisWeek.sort((a, b) => b.value - a.value).slice(0, 10),
  };
}

async function gatherRevenueSignals(
  date: Date,
  supabase: ReturnType<typeof createServiceClient>
): Promise<RevenueSignals | undefined> {
  const digestDate = formatDate(date);

  // Quotes = deals in "Quote Sent" stage updated today
  const { data: quotes } = await supabase
    .from("deals")
    .select("value_cad")
    .eq("stage", "Quote Sent")
    .gte("updated_at", digestDate + "T00:00:00")
    .lte("updated_at", digestDate + "T23:59:59");

  // Orders = deals in "Order Placed" stage updated today
  const { data: orders } = await supabase
    .from("deals")
    .select("value_cad")
    .eq("stage", "Order Placed")
    .gte("updated_at", digestDate + "T00:00:00")
    .lte("updated_at", digestDate + "T23:59:59");

  // Deliveries
  const { data: deliveries } = await supabase
    .from("order_deliveries")
    .select("id")
    .gte("scheduled_date", digestDate)
    .lte("scheduled_date", digestDate);

  const quotesCount = quotes?.length || 0;
  const quotesValue = quotes?.reduce((s, q) => s + (Number(q.value_cad) || 0), 0) || 0;
  const ordersCount = orders?.length || 0;
  const ordersValue = orders?.reduce((s, o) => s + (Number(o.value_cad) || 0), 0) || 0;
  const deliveriesCount = deliveries?.length || 0;

  if (quotesCount === 0 && ordersCount === 0 && deliveriesCount === 0) return undefined;

  return {
    quotes_sent_today: quotesCount,
    quotes_total_value: quotesValue,
    orders_placed_today: ordersCount,
    orders_total_value: ordersValue,
    deliveries_today: deliveriesCount,
  };
}

async function gatherTerritoryCoverage(
  date: Date,
  activity: DayActivity,
  supabase: ReturnType<typeof createServiceClient>
): Promise<TerritoryCoverage | undefined> {
  const digestDate = formatDate(date);

  // Total accounts
  const { count: totalAccounts } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });

  const total = totalAccounts || 0;
  if (total === 0) return undefined;

  const touchedToday = new Set<string>();
  activity.callsByRep.forEach((rep) => {
    rep.accounts.forEach((a) => touchedToday.add(a));
  });

  // Dark territories: territories with no activity in last 3 days
  const threeDaysAgo = new Date(date);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: recentActivity } = await supabase
    .from("call_logs")
    .select("rep:user_profiles(territory)")
    .gte("created_at", threeDaysAgo.toISOString())
    .lte("created_at", digestDate + "T23:59:59")
    .eq("processing_status", "completed");

  const activeTerritoriesSet = new Set<string>();
  if (recentActivity) {
    for (const r of recentActivity) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const territory = (r.rep as any)?.territory;
      if (territory) activeTerritoriesSet.add(territory);
    }
  }

  // All territories
  const { data: allTerritories } = await supabase
    .from("user_profiles")
    .select("territory")
    .eq("is_active", true)
    .not("territory", "is", null);

  const allTerritorySet = new Set<string>();
  if (allTerritories) {
    for (const t of allTerritories) {
      if (t.territory) allTerritorySet.add(t.territory);
    }
  }

  const darkTerritories: TerritoryCoverage["dark_territories"] = [];
  Array.from(allTerritorySet).forEach((t) => {
    if (!activeTerritoriesSet.has(t)) {
      darkTerritories.push({ territory: t, days_since_activity: 3 });
    }
  });

  return {
    total_accounts: total,
    accounts_touched_today: touchedToday.size,
    coverage_percent: total > 0 ? Math.round((touchedToday.size / total) * 100) : 0,
    dark_territories: darkTerritories,
  };
}

function gatherCompetitiveIntelligence(
  activity: DayActivity,
  callLogs: Array<{ extraction: unknown }>
): CompetitiveIntelligence | undefined {
  const mentionsMap = new Map<string, { count: number; snippets: string[] }>();

  // We re-process from the callLogs to extract competitor_mentions
  // This data was fetched in gatherDayActivity but not aggregated
  for (const log of callLogs) {
    const extraction = Array.isArray(log.extraction)
      ? (log.extraction as unknown[])[0]
      : log.extraction;
    if (!extraction) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ext = extraction as any;
    if (Array.isArray(ext.competitor_mentions)) {
      for (const mention of ext.competitor_mentions) {
        const name = typeof mention === "string" ? mention : mention?.name || mention?.competitor;
        if (!name) continue;
        const key = name.trim();
        const existing = mentionsMap.get(key) || { count: 0, snippets: [] };
        existing.count++;
        const snippet = typeof mention === "object" && mention?.context ? mention.context : ext.summary?.slice(0, 80);
        if (snippet && existing.snippets.length < 3) existing.snippets.push(snippet);
        mentionsMap.set(key, existing);
      }
    }
  }

  if (mentionsMap.size === 0) return undefined;

  const mentions = Array.from(mentionsMap.entries())
    .map(([name, data]) => ({
      competitor_name: name,
      mention_count: data.count,
      context_snippets: data.snippets,
    }))
    .sort((a, b) => b.mention_count - a.mention_count);

  return {
    mentions,
    total_mentions: mentions.reduce((s, m) => s + m.mention_count, 0),
  };
}

async function gatherWeekOverWeek(
  date: Date,
  supabase: ReturnType<typeof createServiceClient>
): Promise<WeekOverWeek | undefined> {
  const dayOfWeek = date.getDay(); // 0=Sun
  const thisWeekStart = new Date(date);
  thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const thisWeekStartStr = formatDate(thisWeekStart);
  const digestDateStr = formatDate(date);
  const lastWeekStartStr = formatDate(lastWeekStart);
  const lastWeekEndStr = formatDate(lastWeekEnd);

  // This week calls
  const { count: callsThisWeek } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", thisWeekStartStr + "T00:00:00")
    .lte("created_at", digestDateStr + "T23:59:59")
    .eq("processing_status", "completed");

  // Last week calls
  const { count: callsLastWeek } = await supabase
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", lastWeekStartStr + "T00:00:00")
    .lte("created_at", lastWeekEndStr + "T23:59:59")
    .eq("processing_status", "completed");

  const tw = callsThisWeek || 0;
  const lw = callsLastWeek || 0;

  // Pipeline this vs last week
  const { data: pipelineNow } = await supabase
    .from("deals")
    .select("value_cad")
    .not("stage", "in", '("Closed Lost","Paid","Delivered","Invoiced")');

  const pipelineThisWeek = pipelineNow?.reduce((s, d) => s + (Number(d.value_cad) || 0), 0) || 0;

  // Unique accounts touched this week
  const { data: accountsThisWeekData } = await supabase
    .from("call_logs")
    .select("company_id")
    .gte("created_at", thisWeekStartStr + "T00:00:00")
    .lte("created_at", digestDateStr + "T23:59:59")
    .eq("processing_status", "completed");

  const { data: accountsLastWeekData } = await supabase
    .from("call_logs")
    .select("company_id")
    .gte("created_at", lastWeekStartStr + "T00:00:00")
    .lte("created_at", lastWeekEndStr + "T23:59:59")
    .eq("processing_status", "completed");

  const uniqueThisWeek = new Set(accountsThisWeekData?.map((r) => r.company_id).filter(Boolean) || []).size;
  const uniqueLastWeek = new Set(accountsLastWeekData?.map((r) => r.company_id).filter(Boolean) || []).size;

  return {
    calls_this_week: tw,
    calls_last_week: lw,
    calls_change_percent: lw > 0 ? Math.round(((tw - lw) / lw) * 100) : 0,
    accounts_this_week: uniqueThisWeek,
    accounts_last_week: uniqueLastWeek,
    pipeline_this_week: pipelineThisWeek,
    pipeline_last_week: pipelineThisWeek, // Approximation — no historical snapshot
  };
}

async function gatherTrendContext(
  supabase: ReturnType<typeof createServiceClient>
): Promise<TrendContext> {
  const { data: signals } = await supabase
    .from("field_trend_signals")
    .select("signal_type, severity, title, description, recommended_actions, data_points")
    .eq("is_active", true)
    .order("severity", { ascending: false })
    .limit(10);

  return { activeSignals: (signals || []) as TrendContext["activeSignals"] };
}

async function gatherInventoryLevels(
  activity: DayActivity,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, { on_hand: number; reorder_point: number; product_id: string }>> {
  const productNames = Array.from(activity.productsMentioned.keys());
  if (productNames.length === 0) return new Map();

  // Match product names to offerings
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, name")
    .eq("is_active", true);

  const nameToId = new Map<string, string>();
  if (offerings) {
    for (const o of offerings) {
      nameToId.set(o.name.toLowerCase().trim(), o.id);
    }
  }

  const productIds = productNames
    .map((name) => nameToId.get(name))
    .filter(Boolean) as string[];

  if (productIds.length === 0) return new Map();

  const { data: invRows } = await supabase
    .from("inventory")
    .select("product_id, quantity_on_hand, reorder_point")
    .in("product_id", productIds);

  const result = new Map<string, { on_hand: number; reorder_point: number; product_id: string }>();

  // Reverse map: product_id → product name
  const idToName = new Map<string, string>();
  nameToId.forEach((id, name) => {
    idToName.set(id, name);
  });

  if (invRows) {
    for (const row of invRows) {
      const name = idToName.get(row.product_id);
      if (name) {
        result.set(name, {
          on_hand: row.quantity_on_hand,
          reorder_point: row.reorder_point,
          product_id: row.product_id,
        });
      }
    }
  }

  return result;
}

async function gatherPreviousPeriodDiseases(
  date: Date,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, number>> {
  const prevEnd = new Date(date);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 7);

  const { data } = await supabase
    .from("call_log_extractions")
    .select("diseases_mentioned")
    .gte("created_at", prevStart.toISOString())
    .lte("created_at", prevEnd.toISOString());

  const counts = new Map<string, number>();
  if (data) {
    for (const row of data) {
      if (Array.isArray(row.diseases_mentioned)) {
        for (const d of row.diseases_mentioned) {
          const key = (d as string).toLowerCase().trim();
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Build structured sections
// ---------------------------------------------------------------------------

function buildRepActivity(activity: DayActivity): RepActivity[] {
  const reps: RepActivity[] = [];
  activity.callsByRep.forEach((data, repId) => {
    reps.push({
      rep_id: repId,
      rep_name: data.repName,
      territory: data.territory,
      calls_logged: data.calls,
      accounts_touched: Array.from(data.accounts),
      commitments: data.commitments,
      sentiment_summary: data.sentiment,
    });
  });
  // Sort by calls descending
  reps.sort((a, b) => b.calls_logged - a.calls_logged);
  return reps;
}

function buildDemandIntelligence(
  activity: DayActivity,
  inventoryMap: Map<string, { on_hand: number; reorder_point: number; product_id: string }>
): DigestStructuredData["demand_intelligence"] {
  const products_in_demand: DemandItem[] = Array.from(activity.productsMentioned.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, data]) => {
      const inv = inventoryMap.get(name);
      return {
        product_name: name,
        product_id: inv?.product_id || null,
        mention_count: data.count,
        request_count: data.requested,
        inventory_on_hand: inv?.on_hand ?? null,
        reorder_point: inv?.reorder_point ?? null,
        is_low_stock: inv ? inv.on_hand <= inv.reorder_point && inv.reorder_point > 0 : false,
      };
    });

  return {
    products_in_demand,
    reorder_requests: activity.reorderRequests,
  };
}

async function buildDiseaseWatch(
  activity: DayActivity,
  prevCounts: Map<string, number>,
  supabase: ReturnType<typeof createServiceClient>
): Promise<DiseaseWatch[]> {
  const diseases = Array.from(activity.diseasesMentioned.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  // Fetch product links for these diseases
  const diseaseNames = diseases.map(([name]) => name);
  const { data: diseaseRecords } = await supabase
    .from("turf_diseases_pests")
    .select("id, name")
    .in("name", diseaseNames.map((n) => n.charAt(0).toUpperCase() + n.slice(1)));

  const diseaseIdMap = new Map<string, string>();
  if (diseaseRecords) {
    for (const d of diseaseRecords) {
      diseaseIdMap.set(d.name.toLowerCase(), d.id);
    }
  }

  const diseaseIds = Array.from(diseaseIdMap.values());
  const productLinks = new Map<string, string[]>();
  if (diseaseIds.length > 0) {
    const { data: links } = await supabase
      .from("product_disease_links")
      .select("disease_pest_id, product:offerings!inner(name)")
      .in("disease_pest_id", diseaseIds)
      .limit(30);

    if (links) {
      for (const link of links) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productName = (link as any).product?.name;
        if (productName) {
          const existing = productLinks.get(link.disease_pest_id) || [];
          if (!existing.includes(productName)) existing.push(productName);
          productLinks.set(link.disease_pest_id, existing);
        }
      }
    }
  }

  return diseases.map(([name, data]) => {
    const prevCount = prevCounts.get(name) || 0;
    const diseaseId = diseaseIdMap.get(name);
    const relatedProducts = diseaseId ? productLinks.get(diseaseId) || [] : [];

    let trending: "up" | "stable" | "new";
    if (prevCount === 0) trending = "new";
    else if (data.count > prevCount) trending = "up";
    else trending = "stable";

    return {
      disease_name: name.charAt(0).toUpperCase() + name.slice(1),
      mention_count: data.count,
      rep_count: data.repIds.size,
      regions: Array.from(data.territories),
      trending,
      related_products: relatedProducts.slice(0, 3),
    };
  });
}

function buildActionItemsRollup(
  activity: DayActivity,
  digestDate: string
): ActionItemRollup[] {
  const rollup: ActionItemRollup[] = [];

  // Current day's items
  activity.actionItemsByRep.forEach((data, repId) => {
    const items = data.items.map((item) => ({
      ...item,
      status: getItemStatus(item.due_date, digestDate),
    }));
    rollup.push({ rep_name: data.repName, rep_id: repId, items });
  });

  // Merge in overdue items from previous days
  for (const overdue of activity.overdueItems) {
    let repEntry = rollup.find((r) => r.rep_id === overdue.rep_id);
    if (!repEntry) {
      repEntry = { rep_name: overdue.rep_name, rep_id: overdue.rep_id, items: [] };
      rollup.push(repEntry);
    }
    repEntry.items.push({
      description: overdue.description,
      type: overdue.type,
      due_date: overdue.due_date,
      company_name: null,
      status: "overdue" as const,
    });
  }

  // Sort: reps with overdue items first, then by total item count
  rollup.sort((a, b) => {
    const aOverdue = a.items.filter((i) => i.status === "overdue").length;
    const bOverdue = b.items.filter((i) => i.status === "overdue").length;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    return b.items.length - a.items.length;
  });

  return rollup;
}

function getItemStatus(dueDate: string | null, today: string): "pending" | "due_today" | "overdue" {
  if (!dueDate) return "pending";
  if (dueDate === today) return "due_today";
  if (dueDate < today) return "overdue";
  return "pending";
}

// ---------------------------------------------------------------------------
// AI Executive Summary
// ---------------------------------------------------------------------------

async function generateExecutiveSummary(
  activity: DayActivity,
  repActivity: RepActivity[],
  demand: DigestStructuredData["demand_intelligence"],
  diseases: DiseaseWatch[],
  actionItems: ActionItemRollup[],
  trends: TrendContext,
  pipeline?: PipelineSnapshot,
  competitive?: CompetitiveIntelligence,
  territory?: TerritoryCoverage,
  wow?: WeekOverWeek
): Promise<string> {
  const llm = getLLM();

  // Prepare compact data summaries for the prompt
  const topDiseases = diseases.slice(0, 5)
    .map((d) => `${d.disease_name}: ${d.mention_count} mentions from ${d.rep_count} reps${d.trending === "up" ? " (TRENDING UP)" : d.trending === "new" ? " (NEW)" : ""}`)
    .join("; ");

  const topProducts = demand.products_in_demand.slice(0, 5)
    .map((p) => `${p.product_name}: ${p.mention_count} mentions, ${p.request_count} requests${p.is_low_stock ? " (LOW STOCK)" : ""}`)
    .join("; ");

  const totalOverdue = actionItems.flatMap((r) => r.items).filter((i) => i.status === "overdue").length;
  const totalDueToday = actionItems.flatMap((r) => r.items).filter((i) => i.status === "due_today").length;
  const totalCommitments = repActivity.reduce((sum, r) => sum + r.commitments.length, 0);

  const urgentSummary = activity.urgentCalls.slice(0, 3)
    .map((c) => `${c.rep_name}${c.company_name ? ` at ${c.company_name}` : ""}: ${c.summary.slice(0, 100)}`)
    .join("; ");

  const activeRepSummary = repActivity.slice(0, 5)
    .map((r) => `${r.rep_name}: ${r.calls_logged} calls, ${r.accounts_touched.length} accounts`)
    .join("; ");

  const inactiveNames = activity.inactiveReps.slice(0, 8)
    .map((r) => r.full_name || "Unknown")
    .join(", ");

  const reorderSummary = activity.reorderRequests.slice(0, 5)
    .map((r) => `${r.product_name} for ${r.customer_name}${r.quantity ? ` (${r.quantity})` : ""}`)
    .join("; ");

  const trendSummary = trends.activeSignals.slice(0, 3)
    .map((s) => `[${s.severity.toUpperCase()}] ${s.title}`)
    .join("; ");

  const systemPrompt = `You are a smart field intelligence assistant for Allturf LTD, an Ontario turf products distributor with 20 sales reps.
Write a daily executive briefing in 3-4 sentences. This should feel like a trusted aide briefing the CEO — conversational, specific, and actionable.

Rules:
- Lead with the most important insight or decision that needs attention TODAY.
- Be specific: use actual numbers, product names, disease names, and rep counts.
- Highlight supply/demand mismatches (product demand vs. inventory).
- Flag commitments or deadlines that need action.
- If diseases are trending up, connect it to buying implications.
- Do NOT use corporate jargon, bullet points, or section headers.
- Do NOT use emojis.
- Write as plain text paragraphs, not markdown.`;

  const userPrompt = `Write the executive briefing for ${formatDate(new Date())}.

FIELD DATA:
- ${activity.totalCalls} calls logged by ${repActivity.length} reps (of ~20 total)
- ${activity.inactiveReps.length} reps with no activity${inactiveNames ? `: ${inactiveNames}` : ""}
- Top reps: ${activeRepSummary || "None"}
- Sentiment: ${activity.sentimentBreakdown.positive} positive, ${activity.sentimentBreakdown.neutral} neutral, ${activity.sentimentBreakdown.concerned} concerned, ${activity.sentimentBreakdown.urgent} urgent
- Diseases: ${topDiseases || "None reported"}
- Products: ${topProducts || "None mentioned"}
- Reorder requests: ${reorderSummary || "None"}
- Commitments made: ${totalCommitments}
- Action items due today: ${totalDueToday}, overdue: ${totalOverdue}
- Urgent/concerned calls: ${urgentSummary || "None"}
- Trend alerts: ${trendSummary || "None active"}
- Pipeline: ${pipeline ? `$${(pipeline.total_pipeline_value / 1000).toFixed(0)}K total, ${pipeline.new_deals_count} new deals today ($${(pipeline.new_deals_value / 1000).toFixed(0)}K), ${pipeline.deals_closing_this_week.length} closing this week` : "No pipeline data"}
- Competitors: ${competitive ? competitive.mentions.map((m) => `${m.competitor_name}: ${m.mention_count} mentions`).join("; ") : "No mentions"}
- Territory coverage: ${territory ? `${territory.coverage_percent}% today (${territory.accounts_touched_today}/${territory.total_accounts})${territory.dark_territories.length > 0 ? `, dark: ${territory.dark_territories.map((t) => t.territory).join(", ")}` : ""}` : "N/A"}
- Week-over-week: ${wow ? `Calls ${wow.calls_change_percent >= 0 ? "+" : ""}${wow.calls_change_percent}% vs last week (${wow.calls_this_week} vs ${wow.calls_last_week})` : "N/A"}`;

  try {
    const raw = await llm.chat({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.4,
    });
    return raw.trim();
  } catch (err) {
    console.error("[digest] AI summary generation failed:", err);
    // Fallback to a basic summary
    return `${activity.totalCalls} calls were logged by ${repActivity.length} reps. ${diseases.length > 0 ? `Top disease: ${diseases[0].disease_name} with ${diseases[0].mention_count} mentions.` : ""} ${demand.products_in_demand.length > 0 ? `Most discussed product: ${demand.products_in_demand[0].product_name}.` : ""} ${activity.inactiveReps.length > 0 ? `${activity.inactiveReps.length} reps did not log activity.` : ""}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

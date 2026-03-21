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

export interface DigestResult {
  success: boolean;
  digest_id?: string;
  no_activity?: boolean;
  error?: string;
}

interface DayActivity {
  totalCalls: number;
  activeRepIds: string[];
  inactiveReps: Array<{ id: string; full_name: string | null; territory: string | null }>;
  topCourses: Array<{ company_id: string; company_name: string; call_count: number }>;
  diseasesMentioned: Map<string, { count: number; repIds: Set<string> }>;
  productsMentioned: Map<string, { count: number; requested: boolean }>;
  sentimentBreakdown: { positive: number; neutral: number; concerned: number; urgent: number };
  urgentCalls: Array<{ summary: string; rep_name: string; company_name: string | null }>;
  actionItems: Array<{
    type: string;
    description: string;
    due_date: string | null;
    rep_name: string;
    company_name: string | null;
  }>;
  overdueItems: Array<{
    type: string;
    description: string;
    due_date: string;
    rep_name: string;
  }>;
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

interface DigestContent {
  executive_summary: string;
  activity_overview: string;
  field_intelligence: string;
  trend_alerts: string;
  action_items_summary: string;
  inventory_implications: string;
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
    // Delete existing to regenerate
    await supabase.from("daily_digests").delete().eq("id", existing.id);
  }

  // Gather day's activity
  const activity = await gatherDayActivity(date, supabase);

  // No activity — store a minimal digest
  if (activity.totalCalls === 0) {
    const { data: digest } = await supabase
      .from("daily_digests")
      .insert({
        digest_date: digestDate,
        total_calls_logged: 0,
        total_follow_ups_needed: 0,
        top_diseases: [],
        top_products: [],
        rep_activity_breakdown: [],
        key_highlights: "No field activity recorded for this date.",
        alerts: null,
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    return { success: true, digest_id: digest?.id, no_activity: true };
  }

  // Run trend detection for trailing 7-day window
  await detectTrends(7).catch(() => {
    // Non-fatal — trends may fail but digest can still generate
  });

  // Gather trend context
  const trends = await gatherTrendContext(supabase);

  // Build LLM prompt and generate narrative
  const content = await generateDigestNarrative(activity, trends);

  // Compute aggregated data for structured fields
  const topDiseases = Array.from(activity.diseasesMentioned.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, data]) => ({
      disease_name: name,
      mention_count: data.count,
      affected_regions: [] as string[],
      trending: "stable" as const,
    }));

  const topProducts = Array.from(activity.productsMentioned.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, data]) => ({
      product_name: name,
      product_id: null,
      request_count: data.count,
      revenue_potential: null,
    }));

  const followUpCount = activity.actionItems.filter(
    (ai) => ai.type === "follow_up_call" || ai.type === "schedule_visit"
  ).length;

  // Build rep activity breakdown
  const repBreakdown = activity.activeRepIds.map((repId) => ({
    rep_id: repId,
    rep_name: repId, // Will be resolved below
    calls_logged: 0,
    follow_ups_needed: 0,
    top_companies: [] as string[],
  }));

  // Combine narrative sections
  const keyHighlights = [
    content.executive_summary,
    "",
    "## Activity Overview",
    content.activity_overview,
    "",
    "## Field Intelligence",
    content.field_intelligence,
    "",
    "## Action Items",
    content.action_items_summary,
    "",
    "## Inventory Implications",
    content.inventory_implications,
  ].join("\n");

  const alerts = content.trend_alerts || null;

  // Insert digest
  const { data: digest, error: insertError } = await supabase
    .from("daily_digests")
    .insert({
      digest_date: digestDate,
      total_calls_logged: activity.totalCalls,
      total_follow_ups_needed: followUpCount,
      top_diseases: topDiseases,
      top_products: topProducts,
      rep_activity_breakdown: repBreakdown,
      key_highlights: keyHighlights,
      alerts,
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
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Fetch call logs for the day with extractions
  const { data: callLogs } = await supabase
    .from("call_logs")
    .select(
      `id, rep_id, company_id, created_at,
       rep:user_profiles!call_logs_rep_id_fkey(full_name, territory),
       company:companies(name),
       extraction:call_log_extractions(
         summary, sentiment, diseases_mentioned, products_mentioned,
         products_requested, action_items, follow_up_needed, follow_up_date,
         confidence_score
       )`
    )
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString())
    .eq("processing_status", "completed");

  // Fetch all reps to find inactive ones
  const { data: allReps } = await supabase
    .from("user_profiles")
    .select("id, full_name, territory")
    .eq("is_active", true);

  const activeRepIds = new Set<string>();
  const diseasesMentioned = new Map<string, { count: number; repIds: Set<string> }>();
  const productsMentioned = new Map<string, { count: number; requested: boolean }>();
  const sentimentBreakdown = { positive: 0, neutral: 0, concerned: 0, urgent: 0 };
  const urgentCalls: DayActivity["urgentCalls"] = [];
  const actionItems: DayActivity["actionItems"] = [];

  // Course activity counter
  const courseActivity = new Map<string, { name: string; count: number }>();

  if (callLogs) {
    for (const log of callLogs) {
      activeRepIds.add(log.rep_id);

      // Course tracking
      if (log.company_id && log.company) {
        const company = log.company as unknown as { name: string };
        const existing = courseActivity.get(log.company_id);
        if (existing) {
          existing.count++;
        } else {
          courseActivity.set(log.company_id, { name: company.name, count: 1 });
        }
      }

      // Process extraction data
      const extraction = Array.isArray(log.extraction)
        ? (log.extraction as unknown[])[0]
        : log.extraction;
      if (!extraction) continue;
      const ext = extraction as {
        summary: string | null;
        sentiment: string | null;
        diseases_mentioned: string[] | null;
        products_mentioned: string[] | null;
        products_requested: Array<{ product_name: string }> | null;
        action_items: Array<{ type: string; description: string; due_date: string | null }> | null;
        follow_up_needed: boolean;
        follow_up_date: string | null;
        confidence_score: number | null;
      };

      // Sentiment
      if (ext.sentiment && ext.sentiment in sentimentBreakdown) {
        sentimentBreakdown[ext.sentiment as keyof typeof sentimentBreakdown]++;
      }

      // Urgent calls
      if (ext.sentiment === "urgent" || ext.sentiment === "concerned") {
        const rep = log.rep as unknown as { full_name: string | null } | null;
        const company = log.company as unknown as { name: string } | null;
        urgentCalls.push({
          summary: ext.summary || "No summary available",
          rep_name: rep?.full_name || "Unknown rep",
          company_name: company?.name || null,
        });
      }

      // Diseases
      if (ext.diseases_mentioned) {
        for (const disease of ext.diseases_mentioned) {
          const key = disease.toLowerCase().trim();
          const existing = diseasesMentioned.get(key);
          if (existing) {
            existing.count++;
            existing.repIds.add(log.rep_id);
          } else {
            diseasesMentioned.set(key, { count: 1, repIds: new Set([log.rep_id]) });
          }
        }
      }

      // Products
      if (ext.products_mentioned) {
        for (const product of ext.products_mentioned) {
          const key = product.toLowerCase().trim();
          const existing = productsMentioned.get(key);
          if (existing) {
            existing.count++;
          } else {
            productsMentioned.set(key, { count: 1, requested: false });
          }
        }
      }
      if (ext.products_requested) {
        for (const pr of ext.products_requested) {
          const key = pr.product_name.toLowerCase().trim();
          const existing = productsMentioned.get(key);
          if (existing) {
            existing.count++;
            existing.requested = true;
          } else {
            productsMentioned.set(key, { count: 1, requested: true });
          }
        }
      }

      // Action items
      if (ext.action_items) {
        const rep = log.rep as unknown as { full_name: string | null } | null;
        const company = log.company as unknown as { name: string } | null;
        for (const ai of ext.action_items) {
          actionItems.push({
            type: ai.type,
            description: ai.description,
            due_date: ai.due_date,
            rep_name: rep?.full_name || "Unknown",
            company_name: company?.name || null,
          });
        }
      }
    }
  }

  // Find inactive reps
  const inactiveReps = (allReps || []).filter((r) => !activeRepIds.has(r.id));

  // Top courses by activity
  const topCourses = Array.from(courseActivity.entries())
    .map(([company_id, data]) => ({
      company_id,
      company_name: data.name,
      call_count: data.count,
    }))
    .sort((a, b) => b.call_count - a.call_count)
    .slice(0, 5);

  // Find overdue action items from previous days
  const { data: overdueExtractions } = await supabase
    .from("call_log_extractions")
    .select(
      `action_items,
       call_log:call_logs!inner(rep_id, rep:user_profiles(full_name))`
    )
    .lt("created_at", dayStart.toISOString())
    .not("action_items", "is", null);

  const overdueItems: DayActivity["overdueItems"] = [];
  const today = formatDate(date);

  if (overdueExtractions) {
    for (const ext of overdueExtractions) {
      const items = ext.action_items as Array<{
        type: string;
        description: string;
        due_date: string | null;
        completed: boolean;
      }> | null;
      if (!items) continue;

      const callLog = ext.call_log as unknown as {
        rep_id: string;
        rep: { full_name: string | null } | null;
      } | null;

      for (const item of items) {
        if (item.completed) continue;
        if (item.due_date && item.due_date < today) {
          overdueItems.push({
            type: item.type,
            description: item.description,
            due_date: item.due_date,
            rep_name: callLog?.rep?.full_name || "Unknown",
          });
        }
      }
    }
  }

  return {
    totalCalls: callLogs?.length || 0,
    activeRepIds: Array.from(activeRepIds),
    inactiveReps,
    topCourses,
    diseasesMentioned,
    productsMentioned,
    sentimentBreakdown,
    urgentCalls,
    actionItems,
    overdueItems: overdueItems.slice(0, 20), // Cap to prevent prompt bloat
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

  return {
    activeSignals: (signals || []) as TrendContext["activeSignals"],
  };
}

// ---------------------------------------------------------------------------
// LLM narrative generation
// ---------------------------------------------------------------------------

async function generateDigestNarrative(
  activity: DayActivity,
  trends: TrendContext
): Promise<DigestContent> {
  const llm = getLLM();

  // Build structured data for the prompt
  const diseaseSummary = Array.from(activity.diseasesMentioned.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, data]) => `${name}: ${data.count} mentions from ${data.repIds.size} reps`)
    .join("\n  ");

  const productSummary = Array.from(activity.productsMentioned.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, data]) => `${name}: ${data.count} mentions${data.requested ? " (requested)" : ""}`)
    .join("\n  ");

  const trendSummary = trends.activeSignals
    .map((s) => `[${s.severity.toUpperCase()}] ${s.title}: ${s.description || "No details"}`)
    .join("\n  ");

  const actionTypeCounts = new Map<string, number>();
  for (const ai of activity.actionItems) {
    actionTypeCounts.set(ai.type, (actionTypeCounts.get(ai.type) || 0) + 1);
  }
  const actionSummary = Array.from(actionTypeCounts.entries())
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  const urgentSummary = activity.urgentCalls
    .slice(0, 5)
    .map((c) => `${c.rep_name}${c.company_name ? ` @ ${c.company_name}` : ""}: ${c.summary.slice(0, 150)}`)
    .join("\n  ");

  const inactiveRepNames = activity.inactiveReps
    .slice(0, 10)
    .map((r) => r.full_name || "Unknown")
    .join(", ");

  const topCoursesSummary = activity.topCourses
    .map((c) => `${c.company_name}: ${c.call_count} calls`)
    .join(", ");

  const overdueSummary = activity.overdueItems
    .slice(0, 10)
    .map((o) => `${o.rep_name}: ${o.description} (due ${o.due_date})`)
    .join("\n  ");

  const systemPrompt = `You are a concise business intelligence writer for Allturf LTD, a turf products distributor with 20 sales reps in Ontario.
Write a daily management digest. Be concise and actionable — executives want a 2-minute read.
Focus on field intelligence and actionable insights, not individual rep performance metrics.
Use professional tone without jargon. Do not use emojis.

Respond in JSON with this exact schema:
{
  "executive_summary": "2-3 sentences capturing the most important takeaway from yesterday's field activity",
  "activity_overview": "Brief summary of call volume, active reps, and top courses. Mention inactive reps neutrally as 'did not log activity'.",
  "field_intelligence": "Diseases trending, products in demand, customer sentiment. Focus on patterns and implications.",
  "trend_alerts": "Summary of active trend signals with severity. If none, say 'No active trend alerts.'",
  "action_items_summary": "Grouped by type: quotes to send, visits to schedule, samples, follow-ups. Include overdue items.",
  "inventory_implications": "Products with demand spikes, seasonal commitments affecting stock. If none, say 'No immediate inventory concerns.'"
}`;

  const userPrompt = `Generate the daily digest for ${formatDate(new Date())}.

DATA:
- Total calls logged: ${activity.totalCalls}
- Active reps: ${activity.activeRepIds.length} of ~20
- Inactive reps: ${inactiveRepNames || "None"}
- Top courses: ${topCoursesSummary || "None"}

- Sentiment: ${activity.sentimentBreakdown.positive} positive, ${activity.sentimentBreakdown.neutral} neutral, ${activity.sentimentBreakdown.concerned} concerned, ${activity.sentimentBreakdown.urgent} urgent

- Diseases mentioned:
  ${diseaseSummary || "None"}

- Products mentioned:
  ${productSummary || "None"}

- Urgent/concerned calls:
  ${urgentSummary || "None"}

- Action items by type: ${actionSummary || "None"}
- Overdue items from previous days:
  ${overdueSummary || "None"}

- Active trend signals:
  ${trendSummary || "None"}`;

  const raw = await llm.chat({
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.3,
    json: true,
  });

  const parsed = JSON.parse(raw);

  return {
    executive_summary: parsed.executive_summary || "",
    activity_overview: parsed.activity_overview || "",
    field_intelligence: parsed.field_intelligence || "",
    trend_alerts: parsed.trend_alerts || "",
    action_items_summary: parsed.action_items_summary || "",
    inventory_implications: parsed.inventory_implications || "",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

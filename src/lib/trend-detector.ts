// ============================================================================
// Allturf CRM — Trend Detection System
// Identifies disease outbreaks, product demand spikes, inventory risks, and
// seasonal patterns across all reps' call activity.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";
import type {
  TrendSignalType,
  TrendSeverity,
  TrendAction,
  NudgePriority,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TrendDetectionResult {
  success: boolean;
  signals_created: number;
  signals_updated: number;
  details: {
    disease_outbreaks: number;
    product_demand_spikes: number;
    inventory_risks: number;
    seasonal_patterns: number;
  };
  errors: string[];
}

interface SignalInsert {
  signal_type: TrendSignalType;
  severity: TrendSeverity;
  title: string;
  description: string;
  affected_region: string | null;
  affected_companies: string[];
  contributing_call_ids: string[];
  data_points: number;
  first_reported_at: string;
  last_reported_at: string;
  is_active: boolean;
  recommended_actions: TrendAction[];
}

// Internal types for aggregation
interface ExtractionRow {
  id: string;
  call_log_id: string;
  diseases_mentioned: string[] | null;
  products_mentioned: string[] | null;
  products_requested: Array<{
    product_name: string;
    product_id: string | null;
    quantity: number | null;
    unit: string | null;
  }> | null;
  confidence_score: number | null;
  created_at: string;
  call_log: {
    id: string;
    rep_id: string;
    company_id: string | null;
    rep: { territory: string | null } | null;
  } | null;
}

interface ExistingSignal {
  id: string;
  signal_type: TrendSignalType;
  title: string;
  contributing_call_ids: string[] | null;
  data_points: number;
  first_reported_at: string | null;
  last_reported_at: string | null;
  affected_companies: string[] | null;
  affected_region: string | null;
  recommended_actions: TrendAction[] | null;
}

interface DiseaseCluster {
  disease: string;
  callLogIds: string[];
  repIds: Set<string>;
  companyIds: Set<string>;
  regions: Set<string>;
  firstSeen: string;
  lastSeen: string;
  mentionCount: number;
}

interface ProductCluster {
  productName: string;
  productId: string | null;
  callLogIds: string[];
  repIds: Set<string>;
  companyIds: Set<string>;
  regions: Set<string>;
  firstSeen: string;
  lastSeen: string;
  totalQuantity: number;
  requestCount: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function detectTrends(
  timeWindowDays = 7
): Promise<TrendDetectionResult> {
  const supabase = createServiceClient();
  const errors: string[] = [];
  let signalsCreated = 0;
  let signalsUpdated = 0;
  const details = {
    disease_outbreaks: 0,
    product_demand_spikes: 0,
    inventory_risks: 0,
    seasonal_patterns: 0,
  };

  // Compute time window boundary
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - timeWindowDays);
  const windowStartISO = windowStart.toISOString();

  // Fetch extractions within the time window, joined to call_log for rep_id/company_id
  const { data: extractions, error: fetchError } = await supabase
    .from("call_log_extractions")
    .select(
      `id, call_log_id, diseases_mentioned, products_mentioned, products_requested,
       confidence_score, created_at,
       call_log:call_logs!inner(id, rep_id, company_id, rep:user_profiles(territory))`
    )
    .gte("created_at", windowStartISO)
    .order("created_at", { ascending: true });

  if (fetchError) {
    return {
      success: false,
      signals_created: 0,
      signals_updated: 0,
      details,
      errors: [`Failed to fetch extractions: ${fetchError.message}`],
    };
  }

  if (!extractions || extractions.length === 0) {
    return { success: true, signals_created: 0, signals_updated: 0, details, errors: [] };
  }

  const rows = extractions as unknown as ExtractionRow[];

  // Filter out low-confidence extractions
  const validRows = rows.filter(
    (r) => r.confidence_score === null || r.confidence_score >= 0.3
  );

  // Fetch existing active signals for deduplication
  const { data: existingSignals } = await supabase
    .from("field_trend_signals")
    .select(
      "id, signal_type, title, contributing_call_ids, data_points, first_reported_at, last_reported_at, affected_companies, affected_region, recommended_actions"
    )
    .eq("is_active", true);

  const activeSignals = (existingSignals || []) as ExistingSignal[];

  // --- Detection 1: Disease outbreaks ---
  try {
    const diseaseResults = await detectDiseaseOutbreaks(validRows, activeSignals, supabase);
    signalsCreated += diseaseResults.created;
    signalsUpdated += diseaseResults.updated;
    details.disease_outbreaks = diseaseResults.created + diseaseResults.updated;
  } catch (err) {
    errors.push(`Disease detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- Detection 2: Product demand spikes ---
  try {
    const productResults = await detectProductDemandSpikes(validRows, activeSignals, supabase);
    signalsCreated += productResults.created;
    signalsUpdated += productResults.updated;
    details.product_demand_spikes = productResults.created + productResults.updated;
  } catch (err) {
    errors.push(`Product demand detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- Detection 3: Inventory risks (derived from demand spikes) ---
  try {
    // Re-fetch active signals to include any just-created demand spikes
    const { data: refreshedSignals } = await supabase
      .from("field_trend_signals")
      .select(
        "id, signal_type, title, contributing_call_ids, data_points, first_reported_at, last_reported_at, affected_companies, affected_region, recommended_actions"
      )
      .eq("is_active", true)
      .eq("signal_type", "product_demand_spike");

    const demandSignals = (refreshedSignals || []) as ExistingSignal[];
    const inventoryResults = await detectInventoryRisks(demandSignals, activeSignals, supabase);
    signalsCreated += inventoryResults.created;
    signalsUpdated += inventoryResults.updated;
    details.inventory_risks = inventoryResults.created + inventoryResults.updated;
  } catch (err) {
    errors.push(`Inventory risk detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- Detection 4: Seasonal patterns ---
  try {
    const seasonalResults = await detectSeasonalPatterns(validRows, activeSignals, supabase);
    signalsCreated += seasonalResults.created;
    signalsUpdated += seasonalResults.updated;
    details.seasonal_patterns = seasonalResults.created + seasonalResults.updated;
  } catch (err) {
    errors.push(`Seasonal pattern detection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    success: errors.length === 0,
    signals_created: signalsCreated,
    signals_updated: signalsUpdated,
    details,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Detection 1: Disease outbreaks
// ---------------------------------------------------------------------------

async function detectDiseaseOutbreaks(
  rows: ExtractionRow[],
  activeSignals: ExistingSignal[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Cluster by disease name (lowercased for dedup)
  const clusters = new Map<string, DiseaseCluster>();

  for (const row of rows) {
    if (!row.diseases_mentioned || row.diseases_mentioned.length === 0) continue;
    const callLog = row.call_log;
    if (!callLog) continue;

    for (const disease of row.diseases_mentioned) {
      const key = disease.toLowerCase().trim();
      if (!key) continue;

      let cluster = clusters.get(key);
      if (!cluster) {
        cluster = {
          disease,
          callLogIds: [],
          repIds: new Set<string>(),
          companyIds: new Set<string>(),
          regions: new Set<string>(),
          firstSeen: row.created_at,
          lastSeen: row.created_at,
          mentionCount: 0,
        };
        clusters.set(key, cluster);
      }

      cluster.callLogIds.push(row.call_log_id);
      cluster.repIds.add(callLog.rep_id);
      if (callLog.company_id) cluster.companyIds.add(callLog.company_id);
      if (callLog.rep?.territory) cluster.regions.add(callLog.rep.territory);
      if (row.created_at > cluster.lastSeen) cluster.lastSeen = row.created_at;
      cluster.mentionCount++;
    }
  }

  // Evaluate each cluster against thresholds
  for (const [, cluster] of Array.from(clusters.entries())) {
    const repCount = cluster.repIds.size;
    const mentionCount = cluster.mentionCount;

    // Threshold: 3+ call logs from 2+ reps
    if (cluster.callLogIds.length < 3 || repCount < 2) continue;

    const severity = classifyDiseaseSeverity(repCount, mentionCount);
    const regions = Array.from(cluster.regions);
    const regionStr = regions.length > 0 ? regions.join(", ") : null;

    // Fetch linked products for recommended actions
    const { data: linkedProducts } = await supabase
      .from("turf_diseases_pests")
      .select("id, name")
      .ilike("name", `%${cluster.disease.replace(/[%_]/g, "")}%`)
      .limit(1);

    let productActions: TrendAction[] = [];
    if (linkedProducts && linkedProducts.length > 0) {
      const { data: links } = await supabase
        .from("product_disease_links")
        .select("product:offerings!inner(id, name, pcp_registration_number, ontario_class)")
        .eq("disease_pest_id", linkedProducts[0].id)
        .limit(5);

      if (links) {
        const ontarioProducts = links.filter((l) => {
          const p = l.product as unknown as { ontario_class: string | null };
          return p?.ontario_class;
        });
        const productIds = ontarioProducts.map((l) => {
          const p = l.product as unknown as { id: string };
          return p.id;
        });
        const productNames = ontarioProducts.map((l) => {
          const p = l.product as unknown as { name: string; pcp_registration_number: string | null };
          return `${p.name}${p.pcp_registration_number ? ` (PCP# ${p.pcp_registration_number})` : ""}`;
        });

        if (productIds.length > 0) {
          productActions = [
            {
              action: `Verify stock levels for key treatments: ${productNames.join(", ")}`,
              target_companies: null,
              product_ids: productIds,
              priority: severity === "critical" ? "urgent" : "high",
            },
          ];
        }
      }
    }

    const actions: TrendAction[] = [
      ...productActions,
      {
        action: `Send ${cluster.disease} advisory to all reps${regionStr ? ` in ${regionStr}` : ""}`,
        target_companies: null,
        product_ids: null,
        priority: severity === "critical" ? "urgent" : ("high" as NudgePriority),
      },
      {
        action: `Update disease risk alerts on dashboard for ${cluster.disease}`,
        target_companies: Array.from(cluster.companyIds),
        product_ids: null,
        priority: "medium" as NudgePriority,
      },
    ];

    const signal: SignalInsert = {
      signal_type: "disease_outbreak",
      severity,
      title: `${cluster.disease} outbreak — ${repCount} reps, ${mentionCount} mentions`,
      description: `${cluster.disease} reported by ${repCount} reps across ${mentionCount} calls in the last week.${regionStr ? ` Affected regions: ${regionStr}.` : ""} This may indicate widespread disease pressure requiring coordinated response.`,
      affected_region: regionStr,
      affected_companies: Array.from(cluster.companyIds),
      contributing_call_ids: cluster.callLogIds,
      data_points: mentionCount,
      first_reported_at: cluster.firstSeen,
      last_reported_at: cluster.lastSeen,
      is_active: true,
      recommended_actions: actions,
    };

    const result = await upsertSignal(signal, "disease_outbreak", cluster.disease, activeSignals, supabase);
    if (result === "created") created++;
    else if (result === "updated") updated++;
  }

  return { created, updated };
}

function classifyDiseaseSeverity(repCount: number, mentionCount: number): TrendSeverity {
  if (repCount >= 5) return "critical";
  if (repCount >= 3) return "warning";
  if (repCount >= 2 && mentionCount >= 5) return "warning";
  return "watch";
}

// ---------------------------------------------------------------------------
// Detection 2: Product demand spikes
// ---------------------------------------------------------------------------

async function detectProductDemandSpikes(
  rows: ExtractionRow[],
  activeSignals: ExistingSignal[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Cluster by product name (lowercased)
  const clusters = new Map<string, ProductCluster>();

  for (const row of rows) {
    const callLog = row.call_log;
    if (!callLog) continue;

    // Collect all product mentions (from products_mentioned + products_requested)
    const allProducts: Array<{ name: string; id: string | null; qty: number | null }> = [];

    if (row.products_mentioned) {
      for (const name of row.products_mentioned) {
        allProducts.push({ name, id: null, qty: null });
      }
    }
    if (row.products_requested) {
      for (const pr of row.products_requested) {
        allProducts.push({ name: pr.product_name, id: pr.product_id, qty: pr.quantity });
      }
    }

    for (const product of allProducts) {
      const key = product.name.toLowerCase().trim();
      if (!key) continue;

      let cluster = clusters.get(key);
      if (!cluster) {
        cluster = {
          productName: product.name,
          productId: product.id,
          callLogIds: [],
          repIds: new Set<string>(),
          companyIds: new Set<string>(),
          regions: new Set<string>(),
          firstSeen: row.created_at,
          lastSeen: row.created_at,
          totalQuantity: 0,
          requestCount: 0,
        };
        clusters.set(key, cluster);
      }

      // Avoid duplicate call_log_ids within the same cluster
      if (!cluster.callLogIds.includes(row.call_log_id)) {
        cluster.callLogIds.push(row.call_log_id);
      }
      cluster.repIds.add(callLog.rep_id);
      if (callLog.company_id) cluster.companyIds.add(callLog.company_id);
      if (callLog.rep?.territory) cluster.regions.add(callLog.rep.territory);
      if (row.created_at > cluster.lastSeen) cluster.lastSeen = row.created_at;
      if (product.id && !cluster.productId) cluster.productId = product.id;
      if (product.qty) cluster.totalQuantity += product.qty;
      cluster.requestCount++;
    }
  }

  // Evaluate: 4+ calls referencing the same product
  for (const [, cluster] of Array.from(clusters.entries())) {
    if (cluster.callLogIds.length < 4) continue;

    const repCount = cluster.repIds.size;
    const severity: TrendSeverity =
      cluster.callLogIds.length >= 8 ? "critical" :
      cluster.callLogIds.length >= 6 ? "warning" : "watch";

    const regions = Array.from(cluster.regions);
    const regionStr = regions.length > 0 ? regions.join(", ") : null;

    // Cross-reference against deal_items to estimate upcoming volume
    let estimatedVolume = "";
    if (cluster.productId) {
      const { data: recentDealItems } = await supabase
        .from("deal_items")
        .select("quantity, unit_price")
        .eq("offering_id", cluster.productId)
        .limit(20);

      if (recentDealItems && recentDealItems.length > 0) {
        const totalQty = recentDealItems.reduce((sum, di) => sum + (di.quantity || 0), 0);
        const avgQty = Math.round(totalQty / recentDealItems.length);
        estimatedVolume = ` Typical order qty: ~${avgQty} units across ${recentDealItems.length} recent line items.`;
      }
    }

    const actions: TrendAction[] = [
      {
        action: `Verify stock levels for ${cluster.productName} — ${cluster.callLogIds.length} requests from ${repCount} reps in the last week`,
        target_companies: null,
        product_ids: cluster.productId ? [cluster.productId] : null,
        priority: severity === "critical" ? "urgent" : "high",
      },
      {
        action: `Consider bulk ordering ${cluster.productName} to meet anticipated demand`,
        target_companies: null,
        product_ids: cluster.productId ? [cluster.productId] : null,
        priority: "medium",
      },
      {
        action: `Alert warehouse team about increased demand for ${cluster.productName}`,
        target_companies: null,
        product_ids: cluster.productId ? [cluster.productId] : null,
        priority: "medium",
      },
    ];

    const signal: SignalInsert = {
      signal_type: "product_demand_spike",
      severity,
      title: `Demand spike: ${cluster.productName} — ${cluster.callLogIds.length} calls`,
      description: `${cluster.productName} referenced in ${cluster.callLogIds.length} calls from ${repCount} reps.${cluster.totalQuantity > 0 ? ` Total requested quantity: ${cluster.totalQuantity}.` : ""}${estimatedVolume}${regionStr ? ` Regions: ${regionStr}.` : ""}`,
      affected_region: regionStr,
      affected_companies: Array.from(cluster.companyIds),
      contributing_call_ids: cluster.callLogIds,
      data_points: cluster.requestCount,
      first_reported_at: cluster.firstSeen,
      last_reported_at: cluster.lastSeen,
      is_active: true,
      recommended_actions: actions,
    };

    const result = await upsertSignal(signal, "product_demand_spike", cluster.productName, activeSignals, supabase);
    if (result === "created") created++;
    else if (result === "updated") updated++;
  }

  return { created, updated };
}

// ---------------------------------------------------------------------------
// Detection 3: Inventory risks (derived from demand spikes)
// ---------------------------------------------------------------------------

async function detectInventoryRisks(
  demandSignals: ExistingSignal[],
  activeSignals: ExistingSignal[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const demand of demandSignals) {
    // Extract product IDs from recommended_actions
    const productIds: string[] = [];
    if (demand.recommended_actions) {
      for (const action of demand.recommended_actions) {
        if (action.product_ids) {
          for (const pid of action.product_ids) {
            if (!productIds.includes(pid)) productIds.push(pid);
          }
        }
      }
    }
    if (productIds.length === 0) continue;

    // Check active deals for these products
    const { data: committedItems } = await supabase
      .from("deal_items")
      .select("quantity, deal:deals!inner(stage, company_id)")
      .in("offering_id", productIds)
      .limit(50);

    if (!committedItems) continue;

    // Count committed quantities from active deals
    const activeItems = committedItems.filter((di) => {
      const deal = di.deal as unknown as { stage: string };
      return ["Quote Approved", "Order Placed", "Shipped"].includes(deal.stage);
    });

    const committedQty = activeItems.reduce((sum, di) => sum + (di.quantity || 0), 0);

    // Compare against historical average (all past deal_items for these products)
    const { data: historicalItems } = await supabase
      .from("deal_items")
      .select("quantity")
      .in("offering_id", productIds)
      .limit(100);

    if (!historicalItems || historicalItems.length < 5) continue; // Not enough data

    const historicalQty = historicalItems.reduce((sum, di) => sum + (di.quantity || 0), 0);
    const avgHistorical = historicalQty / historicalItems.length;

    // If committed qty is significantly above average per-item, flag risk
    const avgCommitted = activeItems.length > 0 ? committedQty / activeItems.length : 0;
    const demandMultiplier = avgHistorical > 0 ? avgCommitted / avgHistorical : 0;

    // Only flag if current demand is 1.5x+ above historical average
    if (demandMultiplier < 1.5) continue;

    const productName = demand.title.replace(/^Demand spike:\s*/, "").replace(/\s*—.*$/, "");

    const severity: TrendSeverity = demandMultiplier >= 3 ? "critical" :
      demandMultiplier >= 2 ? "warning" : "watch";

    const actions: TrendAction[] = [
      {
        action: `${productName} demand is ${demandMultiplier.toFixed(1)}x above historical average. Review inventory and reorder thresholds.`,
        target_companies: null,
        product_ids: productIds,
        priority: severity === "critical" ? "urgent" : "high",
      },
      {
        action: `Contact supplier about ${productName} availability and lead times`,
        target_companies: null,
        product_ids: productIds,
        priority: "high",
      },
    ];

    const signal: SignalInsert = {
      signal_type: "inventory_risk",
      severity,
      title: `Inventory risk: ${productName} — ${demandMultiplier.toFixed(1)}x demand`,
      description: `Current demand for ${productName} is ${demandMultiplier.toFixed(1)}x above historical average order patterns. ${activeItems.length} active orders with ${committedQty} total units committed. Demand spike signal has ${demand.data_points} data points from field reps.`,
      affected_region: demand.affected_region,
      affected_companies: demand.affected_companies || [],
      contributing_call_ids: demand.contributing_call_ids || [],
      data_points: demand.data_points,
      first_reported_at: demand.first_reported_at || new Date().toISOString(),
      last_reported_at: demand.last_reported_at || new Date().toISOString(),
      is_active: true,
      recommended_actions: actions,
    };

    const result = await upsertSignal(signal, "inventory_risk", productName, activeSignals, supabase);
    if (result === "created") created++;
    else if (result === "updated") updated++;
  }

  return { created, updated };
}

// ---------------------------------------------------------------------------
// Detection 4: Seasonal patterns
// ---------------------------------------------------------------------------

async function detectSeasonalPatterns(
  rows: ExtractionRow[],
  activeSignals: ExistingSignal[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Get current week's disease counts
  const currentDiseaseCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.diseases_mentioned) continue;
    for (const disease of row.diseases_mentioned) {
      const key = disease.toLowerCase().trim();
      currentDiseaseCounts.set(key, (currentDiseaseCounts.get(key) || 0) + 1);
    }
  }

  if (currentDiseaseCounts.size === 0) return { created, updated };

  // Compare against same calendar window last year
  const now = new Date();
  const lastYearStart = new Date(now);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
  lastYearStart.setDate(lastYearStart.getDate() - 7);
  const lastYearEnd = new Date(now);
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

  const { data: lastYearExtractions } = await supabase
    .from("call_log_extractions")
    .select("diseases_mentioned")
    .gte("created_at", lastYearStart.toISOString())
    .lte("created_at", lastYearEnd.toISOString());

  if (!lastYearExtractions || lastYearExtractions.length === 0) {
    // No historical data — skip seasonal comparison
    return { created, updated };
  }

  const lastYearDiseaseCounts = new Map<string, number>();
  for (const ext of lastYearExtractions) {
    const diseases = ext.diseases_mentioned as string[] | null;
    if (!diseases) continue;
    for (const disease of diseases) {
      const key = disease.toLowerCase().trim();
      lastYearDiseaseCounts.set(key, (lastYearDiseaseCounts.get(key) || 0) + 1);
    }
  }

  // Flag diseases significantly more prevalent than same period last year
  for (const [disease, currentCount] of Array.from(currentDiseaseCounts.entries())) {
    const lastYearCount = lastYearDiseaseCounts.get(disease) || 0;

    // Only flag if current count is meaningful (3+) AND significantly exceeds last year
    if (currentCount < 3) continue;
    if (lastYearCount > 0 && currentCount / lastYearCount < 2) continue;
    // If no data last year, only flag if count is high (5+)
    if (lastYearCount === 0 && currentCount < 5) continue;

    const displayName = disease.charAt(0).toUpperCase() + disease.slice(1);
    const comparison = lastYearCount > 0
      ? `${currentCount} mentions this week vs ${lastYearCount} same period last year (${(currentCount / lastYearCount).toFixed(1)}x)`
      : `${currentCount} mentions this week with no reports same period last year`;

    const severity: TrendSeverity = lastYearCount > 0 && currentCount / lastYearCount >= 3
      ? "warning" : "watch";

    const actions: TrendAction[] = [
      {
        action: `${displayName} is trending earlier/more intensely than typical. Brief reps on proactive treatment recommendations.`,
        target_companies: null,
        product_ids: null,
        priority: "medium",
      },
      {
        action: `Review ${displayName} product inventory against projected seasonal demand`,
        target_companies: null,
        product_ids: null,
        priority: "medium",
      },
    ];

    const signal: SignalInsert = {
      signal_type: "seasonal_pattern",
      severity,
      title: `Seasonal pattern: ${displayName} — above historical norm`,
      description: `${displayName} activity is above historical norms. ${comparison}. This may indicate an earlier onset or more intense pressure this season.`,
      affected_region: null,
      affected_companies: [],
      contributing_call_ids: [],
      data_points: currentCount,
      first_reported_at: rows[0]?.created_at || now.toISOString(),
      last_reported_at: rows[rows.length - 1]?.created_at || now.toISOString(),
      is_active: true,
      recommended_actions: actions,
    };

    const result = await upsertSignal(signal, "seasonal_pattern", displayName, activeSignals, supabase);
    if (result === "created") created++;
    else if (result === "updated") updated++;
  }

  return { created, updated };
}

// ---------------------------------------------------------------------------
// Signal upsert — deduplicates against existing active signals
// ---------------------------------------------------------------------------

async function upsertSignal(
  signal: SignalInsert,
  signalType: TrendSignalType,
  identifier: string,
  activeSignals: ExistingSignal[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<"created" | "updated" | "skipped"> {
  // Check if an active signal already exists for this type + identifier
  const identifierLower = identifier.toLowerCase();
  const existing = activeSignals.find(
    (s) =>
      s.signal_type === signalType &&
      s.title.toLowerCase().includes(identifierLower)
  );

  if (existing) {
    // Merge contributing call IDs (deduplicated)
    const existingCallIds = existing.contributing_call_ids || [];
    const mergedCallIds = Array.from(
      new Set([...existingCallIds, ...signal.contributing_call_ids])
    );

    // Merge affected companies (deduplicated)
    const existingCompanies = existing.affected_companies || [];
    const mergedCompanies = Array.from(
      new Set([...existingCompanies, ...signal.affected_companies])
    );

    // Merge affected region
    const mergedRegion = mergeRegions(existing.affected_region, signal.affected_region);

    const { error } = await supabase
      .from("field_trend_signals")
      .update({
        severity: signal.severity,
        description: signal.description,
        contributing_call_ids: mergedCallIds,
        affected_companies: mergedCompanies,
        affected_region: mergedRegion,
        data_points: signal.data_points,
        last_reported_at: signal.last_reported_at,
        recommended_actions: signal.recommended_actions,
      })
      .eq("id", existing.id);

    return error ? "skipped" : "updated";
  }

  // Create new signal
  const { error } = await supabase.from("field_trend_signals").insert(signal);
  return error ? "skipped" : "created";
}

function mergeRegions(existing: string | null, incoming: string | null): string | null {
  if (!existing && !incoming) return null;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingSet = new Set(existing.split(", ").map((r) => r.trim()));
  const incomingParts = incoming.split(", ").map((r) => r.trim());
  for (const part of incomingParts) {
    existingSet.add(part);
  }
  return Array.from(existingSet).join(", ");
}

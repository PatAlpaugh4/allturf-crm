import { NextResponse } from "next/server";
import { withApiProtection, requireAdmin } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

export const GET = withApiProtection(async (request: Request) => {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const territory = searchParams.get("territory");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    // Fetch enriched timeline entries
    let timelineQuery = supabase
      .from("call_log_extractions")
      .select(
        `id, call_log_id, summary, sentiment, diseases_mentioned, products_mentioned,
         products_requested, extracted_commitments, extracted_reorders, urgency_level,
         confidence_score, created_at,
         call_log:call_logs!inner(
           id, raw_transcript, rep_id, company_id, contact_id, created_at,
           rep:user_profiles!call_logs_rep_id_fkey(id, full_name, territory),
           company:companies(id, name),
           contact:contacts(id, first_name, last_name)
         )`,
      )
      .gte("created_at", `${startDate}T00:00:00Z`)
      .lte("created_at", `${endDate}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (territory) {
      timelineQuery = timelineQuery.eq(
        "call_log.rep.territory",
        territory,
      );
    }

    const { data: timeline, error: timelineError } = await timelineQuery;

    if (timelineError) {
      console.error("[field-timeline] Timeline query error:", timelineError);
      return NextResponse.json(
        { error: "Failed to fetch timeline" },
        { status: 500 },
      );
    }

    // Aggregate disease counts
    const diseaseCounts = new Map<string, number>();
    const productCounts = new Map<
      string,
      { discussed: number; requested: number }
    >();
    const territoryCounts = new Map<string, number>();

    for (const entry of timeline || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cl = entry.call_log as any;
      const repTerritory = cl?.rep?.territory;
      if (repTerritory) {
        territoryCounts.set(
          repTerritory,
          (territoryCounts.get(repTerritory) || 0) + 1,
        );
      }

      if (Array.isArray(entry.diseases_mentioned)) {
        for (const d of entry.diseases_mentioned) {
          diseaseCounts.set(d, (diseaseCounts.get(d) || 0) + 1);
        }
      }

      if (Array.isArray(entry.products_mentioned)) {
        for (const p of entry.products_mentioned) {
          const existing = productCounts.get(p) || {
            discussed: 0,
            requested: 0,
          };
          existing.discussed++;
          productCounts.set(p, existing);
        }
      }

      if (Array.isArray(entry.products_requested)) {
        for (const pr of entry.products_requested as Array<{
          product_name: string;
        }>) {
          const existing = productCounts.get(pr.product_name) || {
            discussed: 0,
            requested: 0,
          };
          existing.requested++;
          productCounts.set(pr.product_name, existing);
        }
      }
    }

    // Sort and return top items
    const trendingDiseases = Array.from(diseaseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const trendingProducts = Array.from(productCounts.entries())
      .sort(
        (a, b) =>
          b[1].discussed + b[1].requested - (a[1].discussed + a[1].requested),
      )
      .slice(0, 10)
      .map(([name, counts]) => ({
        name,
        discussed: counts.discussed,
        requested: counts.requested,
      }));

    const hotRegions = Array.from(territoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Fetch active trend signals
    const { data: alerts } = await supabase
      .from("field_trend_signals")
      .select("*")
      .eq("is_active", true)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch stock alerts: products below reorder point or with high demand
    const { data: inventoryRows } = await supabase
      .from("inventory")
      .select(
        `product_id, quantity_on_hand, quantity_committed, quantity_on_order, reorder_point,
         product:offerings!inner(id, name, category)`,
      )
      .eq("product.is_active", true);

    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: weeklyDemand } = await supabase
      .from("demand_signals")
      .select("product_id")
      .gte("created_at", weekAgo)
      .not("product_id", "is", null);

    const demandMap = new Map<string, number>();
    if (weeklyDemand) {
      for (const d of weeklyDemand) {
        if (d.product_id) {
          demandMap.set(d.product_id, (demandMap.get(d.product_id) || 0) + 1);
        }
      }
    }

    const stockAlerts = (inventoryRows || [])
      .map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = (row as any).product as { id: string; name: string; category: string };
        const demand = demandMap.get(row.product_id) || 0;
        const lowStock = row.quantity_on_hand <= row.reorder_point;
        const highDemand = demand >= 3;
        if (!lowStock && !highDemand) return null;
        return {
          product_id: row.product_id,
          product_name: product?.name || "Unknown",
          category: product?.category || "",
          quantity_on_hand: row.quantity_on_hand,
          reorder_point: row.reorder_point,
          quantity_on_order: row.quantity_on_order,
          demand_this_week: demand,
          low_stock: lowStock,
          high_demand: highDemand,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Low stock + high demand first
        const aScore = (a!.low_stock ? 2 : 0) + (a!.high_demand ? 1 : 0);
        const bScore = (b!.low_stock ? 2 : 0) + (b!.high_demand ? 1 : 0);
        return bScore - aScore;
      });

    return NextResponse.json({
      timeline: timeline || [],
      trending_diseases: trendingDiseases,
      trending_products: trendingProducts,
      hot_regions: hotRegions,
      alerts: alerts || [],
      stock_alerts: stockAlerts,
    });
  } catch (err) {
    console.error("[field-timeline] Error:", err);
    return NextResponse.json(
      { error: "Failed to load field timeline" },
      { status: 500 },
    );
  }
});

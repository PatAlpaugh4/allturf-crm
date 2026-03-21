import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET: List all inventory with product info + demand signals this week
export const GET = withApiProtection(async () => {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("inventory")
      .select(
        `*, product:offerings!inner(id, name, category, pcp_registration_number, is_active)`,
      )
      .eq("product.is_active", true)
      .order("last_updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch demand signal counts for the past 7 days per product
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: demandCounts } = await supabase
      .from("demand_signals")
      .select("product_id")
      .gte("created_at", weekAgo)
      .not("product_id", "is", null);

    const demandMap = new Map<string, number>();
    if (demandCounts) {
      for (const d of demandCounts) {
        if (d.product_id) {
          demandMap.set(d.product_id, (demandMap.get(d.product_id) || 0) + 1);
        }
      }
    }

    const enriched = (data || []).map((row) => ({
      ...row,
      demand_this_week: demandMap.get(row.product_id) || 0,
    }));

    return NextResponse.json({ inventory: enriched });
  } catch (err) {
    console.error("[/api/v1/inventory GET] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 },
    );
  }
});

// PUT: Update inventory quantities (admin only)
export const PUT = withApiProtection(async (request: Request) => {
  try {
    const supabase = createServiceClient();

    // Admin check
    const authHeader = request.headers.get("authorization");
    const token =
      authHeader?.replace("Bearer ", "") ||
      request.headers
        .get("cookie")
        ?.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { product_id, quantity_on_hand, quantity_committed, quantity_on_order, reorder_point, notes } = body;

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 },
      );
    }

    // Upsert — create if doesn't exist, update if it does
    const { data, error } = await supabase
      .from("inventory")
      .upsert(
        {
          product_id,
          ...(quantity_on_hand != null ? { quantity_on_hand } : {}),
          ...(quantity_committed != null ? { quantity_committed } : {}),
          ...(quantity_on_order != null ? { quantity_on_order } : {}),
          ...(reorder_point != null ? { reorder_point } : {}),
          ...(notes !== undefined ? { notes } : {}),
          last_updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "product_id" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inventory: data });
  } catch (err) {
    console.error("[/api/v1/inventory PUT] Error:", err);
    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 },
    );
  }
});

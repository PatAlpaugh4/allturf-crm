import { NextResponse } from "next/server";
import { withApiProtection, clampInt } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

export const GET = withApiProtection(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const signalType = searchParams.get("signal_type");
    const region = searchParams.get("region");
    const days = clampInt(searchParams.get("days"), 7, 1, 365);
    const limit = clampInt(searchParams.get("limit"), 100, 1, 500);

    const supabase = createServiceClient();

    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    let query = supabase
      .from("demand_signals")
      .select(
        `*, product:offerings(id, name, category),
         source_rep:user_profiles(id, full_name, territory),
         company:companies(id, name)`,
      )
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (productId) query = query.eq("product_id", productId);
    if (signalType) query = query.eq("signal_type", signalType);
    if (region) query = query.eq("region", region);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signals: data || [], total: count });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch demand signals" },
      { status: 500 },
    );
  }
});

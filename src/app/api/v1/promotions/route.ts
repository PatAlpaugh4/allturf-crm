import { NextResponse } from "next/server";
import { withApiProtection, requireAdmin } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET: List active promotions (optionally filter by product_id)
export const GET = withApiProtection(async (request: Request) => {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const includeExpired = searchParams.get("include_expired") === "true";

    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("promotions")
      .select(`*, product:offerings(id, name, category)`)
      .order("end_date", { ascending: true });

    if (!includeExpired) {
      query = query.eq("active", true).gte("end_date", today);
    }

    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ promotions: data || [] });
  } catch (err) {
    console.error("[/api/v1/promotions GET] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch promotions" },
      { status: 500 },
    );
  }
});

// POST: Create a promotion (admin only)
export const POST = withApiProtection(async (request: Request) => {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const user = auth.user;

    const supabase = createServiceClient();

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title, description, product_id, discount_type, discount_value, min_quantity, start_date, end_date } = body as Record<string, string | number | null>;

    if (!title || !start_date || !end_date) {
      return NextResponse.json(
        { error: "title, start_date, and end_date are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("promotions")
      .insert({
        title,
        description: description || null,
        product_id: product_id || null,
        discount_type: discount_type || null,
        discount_value: discount_value != null ? discount_value : null,
        min_quantity: min_quantity != null ? min_quantity : null,
        start_date,
        end_date,
        active: true,
        created_by: user.id,
      })
      .select(`*, product:offerings(id, name, category)`)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ promotion: data }, { status: 201 });
  } catch (err) {
    console.error("[/api/v1/promotions POST] Error:", err);
    return NextResponse.json(
      { error: "Failed to create promotion" },
      { status: 500 },
    );
  }
});

import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list deals with company, contact, items, and deliveries
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const companyId = searchParams.get("company_id");
  const season = searchParams.get("season");
  const assignedRepId = searchParams.get("assigned_rep_id");

  let query = supabase
    .from("deals")
    .select(`
      *,
      company:companies(id, name, city, province),
      contact:contacts(id, first_name, last_name, email, phone),
      deal_items(*, offering:offerings(id, name, category, pcp_registration_number)),
      order_deliveries(id, scheduled_date, actual_date, status)
    `)
    .order("created_at", { ascending: false });

  if (stage) query = query.eq("stage", stage);
  if (companyId) query = query.eq("company_id", companyId);
  if (season) query = query.eq("season", season);
  if (assignedRepId) query = query.eq("assigned_rep_id", assignedRepId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a deal with optional items
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { items, ...dealData } = body;

  // Defaults
  if (!dealData.stage) dealData.stage = "Quote Draft";
  if (dealData.value_cad == null) dealData.value_cad = 0;

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .insert(dealData)
    .select()
    .single();

  if (dealErr) return NextResponse.json({ error: dealErr.message }, { status: 500 });

  // Insert items if provided
  if (items && Array.isArray(items) && items.length > 0) {
    const itemRows = items.map((item: Record<string, unknown>) => ({
      ...item,
      deal_id: deal.id,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      discount_percent: item.discount_percent || 0,
    }));
    await supabase.from("deal_items").insert(itemRows);
  }

  // Re-fetch with joins
  const { data: full } = await supabase
    .from("deals")
    .select(`
      *,
      company:companies(id, name),
      deal_items(*, offering:offerings(id, name, category)),
      order_deliveries(id, scheduled_date, status)
    `)
    .eq("id", deal.id)
    .single();

  return NextResponse.json(full, { status: 201 });
});

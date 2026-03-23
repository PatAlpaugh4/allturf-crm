import { NextResponse } from "next/server";
import { withApiProtection, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_DEAL_FIELDS = [
  "name", "stage", "value_cad", "season", "company_id", "contact_id",
  "assigned_rep_id", "notes", "expected_close_date", "source",
  "probability", "lost_reason",
] as const;

// GET — list deals with company, contact, items, and deliveries
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const companyId = searchParams.get("company_id");
  const season = searchParams.get("season");
  const assignedRepId = searchParams.get("assigned_rep_id");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("deals")
    .select(`
      *,
      company:companies(id, name, city, province),
      contact:contacts(id, first_name, last_name, email, phone),
      deal_items(*, offering:offerings(id, name, category, pcp_registration_number)),
      order_deliveries(id, scheduled_date, actual_date, status)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { items, ...rest } = body;
  const dealData = pickFields(rest, ALLOWED_DEAL_FIELDS);

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

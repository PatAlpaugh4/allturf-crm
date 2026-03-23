import { NextResponse } from "next/server";
import { withApiProtection, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "deal_id", "scheduled_date", "actual_date", "status", "notes",
  "delivery_method", "tracking_number",
] as const;

// GET — list deliveries with deal info
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get("deal_id");
  const status = searchParams.get("status");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("order_deliveries")
    .select("*, deal:deals(id, name, company_id, stage, company:companies(id, name))")
    .order("scheduled_date", { ascending: true })
    .range(offset, offset + limit - 1);

  if (dealId) query = query.eq("deal_id", dealId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a delivery
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.deal_id) {
    return NextResponse.json({ error: "deal_id is required" }, { status: 400 });
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from("order_deliveries")
    .insert(insert)
    .select("*, deal:deals(id, name, company:companies(id, name))")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list deliveries with deal info
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get("deal_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("order_deliveries")
    .select("*, deal:deals(id, name, company_id, stage, company:companies(id, name))")
    .order("scheduled_date", { ascending: true });

  if (dealId) query = query.eq("deal_id", dealId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a delivery
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.deal_id) {
    return NextResponse.json({ error: "deal_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("order_deliveries")
    .insert(body)
    .select("*, deal:deals(id, name, company:companies(id, name))")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

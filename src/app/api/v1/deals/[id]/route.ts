import { NextResponse } from "next/server";
import { withApiProtection, requireAdmin, isValidUUID, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_FIELDS = [
  "name", "stage", "value_cad", "season", "company_id", "contact_id",
  "assigned_rep_id", "notes", "expected_close_date", "source",
  "probability", "lost_reason",
] as const;

// GET — single deal with all relations
export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("deals")
    .select(`
      *,
      company:companies(id, name, city, province),
      contact:contacts(id, first_name, last_name, email, phone, role),
      deal_items(*, offering:offerings(id, name, category, pcp_registration_number, application_rate_min, application_rate_max, application_rate_unit, moa_group)),
      order_deliveries(*)
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// PUT — update deal
export const PUT = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = pickFields(body, ALLOWED_FIELDS);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      company:companies(id, name),
      deal_items(*, offering:offerings(id, name, category)),
      order_deliveries(id, scheduled_date, status)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// DELETE — remove deal
export const DELETE = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const auth = await requireAdmin(_request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

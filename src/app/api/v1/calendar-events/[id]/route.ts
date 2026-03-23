import { NextResponse } from "next/server";
import { withApiProtection, isValidUUID, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_FIELDS = [
  "title", "start_date", "end_date", "start_time", "end_time",
  "event_type", "team_member", "company_id", "contact_id",
  "notes", "location", "description",
] as const;

export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

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
    .from("calendar_events")
    .update(updates)
    .eq("id", id)
    .select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

export const DELETE = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

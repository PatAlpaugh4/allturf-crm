import { NextResponse } from "next/server";
import { withApiProtection, isValidUUID } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — single call log with extraction and nudges
export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("call_logs")
    .select(`
      *,
      company:companies(id, name, city, province),
      contact:contacts(id, first_name, last_name, email, phone),
      rep:user_profiles(id, full_name),
      extraction:call_log_extractions(*),
      nudges:rep_nudges(*)
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// PATCH — update call log (e.g., rep corrects transcription)
export const PATCH = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only allow updating specific fields
  const allowedFields: Record<string, unknown> = {};
  if (body.raw_transcript !== undefined) allowedFields.raw_transcript = body.raw_transcript;
  if (body.company_id !== undefined) allowedFields.company_id = body.company_id || null;
  if (body.contact_id !== undefined) allowedFields.contact_id = body.contact_id || null;
  if (body.processing_status !== undefined) allowedFields.processing_status = body.processing_status;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("call_logs")
    .update(allowedFields)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-fetch with joins
  const { data } = await supabase
    .from("call_logs")
    .select(`
      *,
      company:companies(id, name),
      contact:contacts(id, first_name, last_name),
      extraction:call_log_extractions(*)
    `)
    .eq("id", id)
    .single();

  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// DELETE — remove call log
export const DELETE = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const { error } = await supabase
    .from("call_logs")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

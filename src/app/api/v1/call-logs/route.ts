import { NextResponse } from "next/server";
import { withApiProtection, clampInt } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list call logs with extractions and nudges
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("rep_id");
  const companyId = searchParams.get("company_id");
  const status = searchParams.get("processing_status");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("call_logs")
    .select(`
      *,
      company:companies(id, name, city),
      contact:contacts(id, first_name, last_name),
      rep:user_profiles(id, full_name),
      extraction:call_log_extractions(*),
      nudges:rep_nudges(id, nudge_type, priority, title, message, is_dismissed, is_completed)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (repId) query = query.eq("rep_id", repId);
  if (companyId) query = query.eq("company_id", companyId);
  if (status) query = query.eq("processing_status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a new call log
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.rep_id) {
    return NextResponse.json({ error: "rep_id is required" }, { status: 400 });
  }
  if (!body.input_type) {
    return NextResponse.json({ error: "input_type is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("call_logs")
    .insert({
      rep_id: body.rep_id,
      company_id: body.company_id || null,
      contact_id: body.contact_id || null,
      activity_id: body.activity_id || null,
      input_type: body.input_type,
      raw_transcript: body.raw_transcript || null,
      duration_seconds: body.duration_seconds || null,
      processing_status: "pending",
    })
    .select(`
      *,
      company:companies(id, name),
      contact:contacts(id, first_name, last_name)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

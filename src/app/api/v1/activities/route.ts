import { NextResponse } from "next/server";
import { withApiProtection, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "type", "subject", "notes", "contact_id", "deal_id", "company_id",
  "assigned_rep_id", "visit_report_id", "date", "duration_minutes",
  "outcome", "status",
] as const;

// GET — list activities with visit report link
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contact_id");
  const dealId = searchParams.get("deal_id");
  const type = searchParams.get("type");
  const repId = searchParams.get("assigned_rep_id");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("activities")
    .select(`
      *,
      contact:contacts(id, first_name, last_name, company:companies(id, name)),
      deal:deals(id, name, stage),
      assigned_rep:user_profiles(id, full_name),
      visit_report:visit_reports(id, visit_date, overall_condition, company:companies(id, name))
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (contactId) query = query.eq("contact_id", contactId);
  if (dealId) query = query.eq("deal_id", dealId);
  if (type) query = query.eq("type", type);
  if (repId) query = query.eq("assigned_rep_id", repId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create an activity
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from("activities")
    .insert(insert)
    .select(`
      *,
      contact:contacts(id, first_name, last_name),
      deal:deals(id, name, stage),
      visit_report:visit_reports(id, visit_date, overall_condition)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

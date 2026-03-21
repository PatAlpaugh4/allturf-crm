import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list calendar events with optional date range and team_member filter
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const teamMember = searchParams.get("team_member");
  const eventType = searchParams.get("event_type");

  let query = supabase
    .from("calendar_events")
    .select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)")
    .order("start_date")
    .order("start_time");

  if (startDate) query = query.gte("start_date", startDate);
  if (endDate) query = query.lte("start_date", endDate);
  if (teamMember) query = query.eq("team_member", teamMember);
  if (eventType) query = query.eq("event_type", eventType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a calendar event
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.title || !body.start_date || !body.event_type || !body.team_member) {
    return NextResponse.json(
      { error: "title, start_date, event_type, and team_member are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(body)
    .select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

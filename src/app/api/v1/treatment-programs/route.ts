import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list treatment programs with items
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const status = searchParams.get("status");
  const seasonYear = searchParams.get("season_year");

  let query = supabase
    .from("projects")
    .select(`
      *,
      company:companies(id, name, city),
      contact:contacts(id, first_name, last_name),
      project_tasks(*, product:offerings(id, name, category, pcp_registration_number, application_rate_unit))
    `)
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);
  if (status) query = query.eq("status", status);
  if (seasonYear) query = query.eq("season_year", parseInt(seasonYear));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a treatment program with items
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { items, ...programData } = body;

  // Defaults
  if (!programData.status) programData.status = "Not Started";
  if (!programData.project_type) programData.project_type = "Custom";
  if (!programData.team_members) programData.team_members = [];
  if (programData.value_cad == null) programData.value_cad = 0;
  if (programData.spent_to_date == null) programData.spent_to_date = 0;

  const { data: program, error: progErr } = await supabase
    .from("projects")
    .insert(programData)
    .select()
    .single();

  if (progErr) return NextResponse.json({ error: progErr.message }, { status: 500 });

  // Insert items if provided
  if (items && Array.isArray(items) && items.length > 0) {
    const taskRows = items.map((item: Record<string, unknown>, idx: number) => ({
      ...item,
      project_id: program.id,
      sort_order: item.sort_order ?? idx,
      status: item.status || "To Do",
      priority: item.priority || "Normal",
    }));
    await supabase.from("project_tasks").insert(taskRows);
  }

  // Re-fetch with joins
  const { data: full } = await supabase
    .from("projects")
    .select(`
      *,
      company:companies(id, name),
      project_tasks(*, product:offerings(id, name, category))
    `)
    .eq("id", program.id)
    .single();

  return NextResponse.json(full, { status: 201 });
});

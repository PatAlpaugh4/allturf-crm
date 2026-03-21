import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list visit reports with nested observations and recommendations
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const repId = searchParams.get("rep_id");
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = supabase
    .from("visit_reports")
    .select(`
      *,
      company:companies(id, name, city),
      contact:contacts(id, first_name, last_name),
      rep:user_profiles(id, full_name),
      visit_observations(*, disease_pest:turf_diseases_pests(id, name, type)),
      visit_recommendations(*, product:offerings(id, name, category, pcp_registration_number))
    `)
    .order("visit_date", { ascending: false })
    .limit(limit);

  if (companyId) query = query.eq("company_id", companyId);
  if (repId) query = query.eq("rep_id", repId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create visit report with nested observations and recommendations
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.visit_date) {
    return NextResponse.json({ error: "visit_date is required" }, { status: 400 });
  }

  // Extract nested data
  const { observations, recommendations, ...reportData } = body;

  // Insert the report
  const { data: report, error: reportErr } = await supabase
    .from("visit_reports")
    .insert(reportData)
    .select()
    .single();

  if (reportErr) return NextResponse.json({ error: reportErr.message }, { status: 500 });

  // Insert observations if provided
  if (observations && Array.isArray(observations) && observations.length > 0) {
    const obsRows = observations.map((obs: Record<string, unknown>) => ({
      ...obs,
      visit_report_id: report.id,
    }));
    await supabase.from("visit_observations").insert(obsRows);
  }

  // Insert recommendations if provided
  if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
    const recRows = recommendations.map((rec: Record<string, unknown>) => ({
      ...rec,
      visit_report_id: report.id,
    }));
    await supabase.from("visit_recommendations").insert(recRows);
  }

  // Re-fetch with all joins
  const { data: full } = await supabase
    .from("visit_reports")
    .select(`
      *,
      company:companies(id, name),
      visit_observations(*, disease_pest:turf_diseases_pests(id, name, type)),
      visit_recommendations(*, product:offerings(id, name, category))
    `)
    .eq("id", report.id)
    .single();

  return NextResponse.json(full, { status: 201 });
});

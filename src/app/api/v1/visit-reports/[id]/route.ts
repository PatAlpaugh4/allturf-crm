import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — single visit report with all nested data
export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { data, error } = await supabase
    .from("visit_reports")
    .select(`
      *,
      company:companies(id, name, city, province),
      contact:contacts(id, first_name, last_name, email, phone),
      rep:user_profiles(id, full_name),
      visit_observations(*, disease_pest:turf_diseases_pests(id, name, type, severity)),
      visit_recommendations(*, product:offerings(id, name, category, pcp_registration_number, moa_group), disease_pest:turf_diseases_pests(id, name))
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// PUT — update visit report
export const PUT = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;
  const body = await request.json();

  // Handle nested updates separately
  const { observations, recommendations, ...reportData } = body;

  // Update report
  if (Object.keys(reportData).length > 0) {
    const { error } = await supabase
      .from("visit_reports")
      .update(reportData)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace observations if provided
  if (observations && Array.isArray(observations)) {
    await supabase.from("visit_observations").delete().eq("visit_report_id", id);
    if (observations.length > 0) {
      const obsRows = observations.map((obs: Record<string, unknown>) => ({
        ...obs,
        visit_report_id: id,
      }));
      await supabase.from("visit_observations").insert(obsRows);
    }
  }

  // Replace recommendations if provided
  if (recommendations && Array.isArray(recommendations)) {
    await supabase.from("visit_recommendations").delete().eq("visit_report_id", id);
    if (recommendations.length > 0) {
      const recRows = recommendations.map((rec: Record<string, unknown>) => ({
        ...rec,
        visit_report_id: id,
      }));
      await supabase.from("visit_recommendations").insert(recRows);
    }
  }

  // Re-fetch
  const { data } = await supabase
    .from("visit_reports")
    .select(`
      *,
      company:companies(id, name),
      visit_observations(*, disease_pest:turf_diseases_pests(id, name, type)),
      visit_recommendations(*, product:offerings(id, name, category))
    `)
    .eq("id", id)
    .single();

  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// DELETE — remove visit report (cascades observations and recommendations)
export const DELETE = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { error } = await supabase
    .from("visit_reports")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

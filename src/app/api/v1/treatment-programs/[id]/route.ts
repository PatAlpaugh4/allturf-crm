import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — single treatment program with all items
export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      company:companies(id, name, city),
      contact:contacts(id, first_name, last_name),
      deal:deals(id, name, stage, value_cad),
      project_tasks(*, product:offerings(id, name, category, pcp_registration_number, application_rate_min, application_rate_max, application_rate_unit, moa_group))
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// PUT — update treatment program and optionally replace items
export const PUT = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;
  const body = await request.json();

  const { items, ...programData } = body;

  if (Object.keys(programData).length > 0) {
    const { error } = await supabase
      .from("projects")
      .update(programData)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace items if provided
  if (items && Array.isArray(items)) {
    await supabase.from("project_tasks").delete().eq("project_id", id);
    if (items.length > 0) {
      const taskRows = items.map((item: Record<string, unknown>, idx: number) => ({
        ...item,
        project_id: id,
        sort_order: item.sort_order ?? idx,
        status: item.status || "To Do",
        priority: item.priority || "Normal",
      }));
      await supabase.from("project_tasks").insert(taskRows);
    }
  }

  const { data } = await supabase
    .from("projects")
    .select(`
      *,
      company:companies(id, name),
      project_tasks(*, product:offerings(id, name, category))
    `)
    .eq("id", id)
    .single();

  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// DELETE — remove treatment program (cascades items)
export const DELETE = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

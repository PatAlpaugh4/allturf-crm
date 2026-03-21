import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { data, error } = await supabase
    .from("offerings")
    .select(`
      *,
      product_disease_links(*, disease_pest:turf_diseases_pests(id, name, type, scientific_name, symptoms, severity))
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

export const PUT = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;
  const body = await request.json();

  const { disease_links, ...offeringData } = body;

  if (Object.keys(offeringData).length > 0) {
    const { error } = await supabase.from("offerings").update(offeringData).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace disease links if provided
  if (disease_links && Array.isArray(disease_links)) {
    await supabase.from("product_disease_links").delete().eq("product_id", id);
    if (disease_links.length > 0) {
      const linkRows = disease_links.map((link: Record<string, unknown>) => ({
        ...link,
        product_id: id,
      }));
      await supabase.from("product_disease_links").insert(linkRows);
    }
  }

  const { data } = await supabase
    .from("offerings")
    .select("*, product_disease_links(id, efficacy, is_primary, disease_pest:turf_diseases_pests(id, name, type))")
    .eq("id", id)
    .single();

  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

export const DELETE = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { error } = await supabase.from("offerings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

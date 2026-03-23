import { NextResponse } from "next/server";
import { withApiProtection, sanitizeSearch, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "name", "category", "description", "price", "unit", "size",
  "active_ingredients", "pcp_registration_number", "ontario_class",
  "moa_group", "application_rate_min", "application_rate_max",
  "application_rate_unit", "re_entry_interval_hours", "is_active",
  "notes", "manufacturer",
] as const;

// GET — list offerings with disease links and all product fields
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const activeOnly = searchParams.get("active");
  const moaGroup = searchParams.get("moa_group");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("offerings")
    .select(`
      *,
      product_disease_links(id, efficacy, is_primary, disease_pest:turf_diseases_pests(id, name, type))
    `)
    .order("name")
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category", category);
  if (activeOnly === "true") query = query.eq("is_active", true);
  if (moaGroup) query = query.eq("moa_group", moaGroup);
  if (search) {
    const s = sanitizeSearch(search);
    query = query.or(`name.ilike.%${s}%,active_ingredients.cs.{${s}}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create an offering
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || !body.category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  const { disease_links, ...rest } = body;
  const offeringData = pickFields(rest, ALLOWED_FIELDS);

  if (offeringData.price == null) offeringData.price = 0;
  if (offeringData.is_active == null) offeringData.is_active = true;

  const { data: offering, error: offErr } = await supabase
    .from("offerings")
    .insert(offeringData)
    .select()
    .single();

  if (offErr) return NextResponse.json({ error: offErr.message }, { status: 500 });

  // Insert disease links if provided
  if (disease_links && Array.isArray(disease_links) && disease_links.length > 0) {
    const linkRows = disease_links.map((link: Record<string, unknown>) => ({
      ...link,
      product_id: offering.id,
    }));
    await supabase.from("product_disease_links").insert(linkRows);
  }

  // Re-fetch with links
  const { data: full } = await supabase
    .from("offerings")
    .select("*, product_disease_links(id, efficacy, is_primary, disease_pest:turf_diseases_pests(id, name, type))")
    .eq("id", offering.id)
    .single();

  return NextResponse.json(full, { status: 201 });
});

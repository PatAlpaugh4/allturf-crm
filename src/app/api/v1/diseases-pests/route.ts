import { NextResponse } from "next/server";
import { withApiProtection, sanitizeSearch, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "name", "type", "scientific_name", "description", "symptoms",
  "favorable_conditions", "severity", "ontario_common",
  "management_cultural", "management_chemical", "grass_types_affected",
  "active_months", "image_url",
] as const;

// GET — list diseases/pests with optional search and type filter
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const ontarioOnly = searchParams.get("ontario_common");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("turf_diseases_pests")
    .select("*")
    .order("name")
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type);
  if (ontarioOnly === "true") query = query.eq("ontario_common", true);
  if (search) query = query.ilike("name", `%${sanitizeSearch(search)}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a disease/pest entry
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || !body.type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from("turf_diseases_pests")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

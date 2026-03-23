import { NextResponse } from "next/server";
import { withApiProtection, sanitizeSearch, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "name", "industry", "city", "province", "postal_code", "address",
  "phone", "email", "website", "notes", "status", "assigned_rep_id",
  "territory", "region", "tier",
] as const;

// GET — list companies with golf course profiles joined
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry");
  const search = searchParams.get("search");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("companies")
    .select(`
      *,
      golf_course_profiles(id, num_holes, course_type, green_grass, fairway_grass, maintenance_level, ipm_program)
    `)
    .order("name")
    .range(offset, offset + limit - 1);

  if (industry) query = query.eq("industry", industry);
  if (search) query = query.ilike("name", `%${sanitizeSearch(search)}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a company
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from("companies")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

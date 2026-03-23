import { NextResponse } from "next/server";
import { withApiProtection, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "company_id", "num_holes", "course_type", "green_grass", "fairway_grass",
  "tee_grass", "rough_grass", "maintenance_level", "ipm_program",
  "irrigation_system", "soil_type", "annual_rounds", "budget_range", "notes",
] as const;

// GET — list all golf course profiles (with company join)
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");

  let query = supabase
    .from("golf_course_profiles")
    .select("*, company:companies(id, name, city, province)")
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a golf course profile
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from("golf_course_profiles")
    .insert(insert)
    .select("*, company:companies(id, name, city, province)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

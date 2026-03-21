import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list companies with golf course profiles joined
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry");
  const search = searchParams.get("search");

  let query = supabase
    .from("companies")
    .select(`
      *,
      golf_course_profiles(id, num_holes, course_type, green_grass, fairway_grass, maintenance_level, ipm_program)
    `)
    .order("name");

  if (industry) query = query.eq("industry", industry);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a company
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("companies")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

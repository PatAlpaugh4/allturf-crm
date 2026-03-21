import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list knowledge base entries with search
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const grassType = searchParams.get("grass_type");
  const season = searchParams.get("season");

  let query = supabase
    .from("turf_knowledge_base")
    .select("*")
    .order("category")
    .order("title");

  if (category) query = query.eq("category", category);
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  if (grassType) query = query.contains("grass_types", [grassType]);
  if (season) query = query.contains("seasonal_relevance", [season]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a knowledge base entry
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.category || !body.title) {
    return NextResponse.json(
      { error: "category and title are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("turf_knowledge_base")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

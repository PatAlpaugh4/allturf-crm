import { NextResponse } from "next/server";
import { withApiProtection, sanitizeSearch, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "category", "title", "content", "grass_types", "seasonal_relevance",
  "tags", "source", "image_url",
] as const;

// GET — list knowledge base entries with search
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const grassType = searchParams.get("grass_type");
  const season = searchParams.get("season");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("turf_knowledge_base")
    .select("*")
    .order("category")
    .order("title")
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category", category);
  if (search) {
    const s = sanitizeSearch(search);
    query = query.or(`title.ilike.%${s}%,content.ilike.%${s}%`);
  }
  if (grassType) query = query.contains("grass_types", [grassType]);
  if (season) query = query.contains("seasonal_relevance", [season]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a knowledge base entry
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.category || !body.title) {
    return NextResponse.json(
      { error: "category and title are required" },
      { status: 400 }
    );
  }

  const insert = pickFields(body, ALLOWED_FIELDS);

  const { data, error } = await supabase
    .from("turf_knowledge_base")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

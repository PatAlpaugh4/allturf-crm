import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: Single promotion by ID
export const GET = withApiProtection(async (_request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  const { data, error } = await supabase
    .from("promotions")
    .select(`*, product:offerings(id, name, category)`)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// PUT: Update promotion (admin only)
export const PUT = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  // Admin check
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader?.replace("Bearer ", "") ||
    request.headers
      .get("cookie")
      ?.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1];

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("promotions")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, product:offerings(id, name, category)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

// DELETE: Deactivate promotion (admin only — soft delete via active=false)
export const DELETE = withApiProtection(async (request: Request, ctx?: RouteContext) => {
  const supabase = createServiceClient();
  const { id } = await ctx!.params;

  // Admin check
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader?.replace("Bearer ", "") ||
    request.headers
      .get("cookie")
      ?.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1];

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("promotions")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}) as (request: Request, ctx: RouteContext) => Promise<NextResponse>;

import { NextResponse } from "next/server";
import { withApiProtection, sanitizeSearch } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

// GET — list contacts with company join
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const status = searchParams.get("status");
  const role = searchParams.get("role");
  const search = searchParams.get("search");

  let query = supabase
    .from("contacts")
    .select("*, company:companies(id, name, city, province)")
    .order("last_name")
    .order("first_name");

  if (companyId) query = query.eq("company_id", companyId);
  if (status) query = query.eq("status", status);
  if (role) query = query.eq("role", role);
  if (search) {
    const s = sanitizeSearch(search);
    query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST — create a contact
export const POST = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const body = await request.json();

  if (!body.first_name || !body.last_name) {
    return NextResponse.json({ error: "first_name and last_name are required" }, { status: 400 });
  }

  if (!body.status) body.status = "New";

  const { data, error } = await supabase
    .from("contacts")
    .insert(body)
    .select("*, company:companies(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

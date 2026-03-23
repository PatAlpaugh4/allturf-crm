import { NextResponse } from "next/server";
import { withApiProtection, sanitizeSearch, clampInt, pickFields } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

const ALLOWED_FIELDS = [
  "first_name", "last_name", "email", "phone", "role", "status",
  "company_id", "notes", "title", "preferred_contact_method",
] as const;

// GET — list contacts with company join
export const GET = withApiProtection(async (request: Request) => {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");
  const status = searchParams.get("status");
  const role = searchParams.get("role");
  const search = searchParams.get("search");
  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

  let query = supabase
    .from("contacts")
    .select("*, company:companies(id, name, city, province)")
    .order("last_name")
    .order("first_name")
    .range(offset, offset + limit - 1);

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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.first_name || !body.last_name) {
    return NextResponse.json({ error: "first_name and last_name are required" }, { status: 400 });
  }

  const insert = pickFields(body, ALLOWED_FIELDS);
  if (!insert.status) insert.status = "New";

  const { data, error } = await supabase
    .from("contacts")
    .insert(insert)
    .select("*, company:companies(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

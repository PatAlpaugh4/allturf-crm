import { NextResponse } from "next/server";
import { withApiProtection, clampInt } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

export const GET = withApiProtection(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const repId = searchParams.get("rep_id");
    const nudgeType = searchParams.get("nudge_type");
    const status = searchParams.get("status"); // "active", "dismissed", "completed", "all"
    const limit = clampInt(searchParams.get("limit"), 50, 1, 100);
    const offset = clampInt(searchParams.get("offset"), 0, 0, 10000);

    if (!repId) {
      return NextResponse.json(
        { error: "rep_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    let query = supabase
      .from("rep_nudges")
      .select(
        `*, company:companies(id, name), contact:contacts(id, first_name, last_name),
         call_log:call_logs(id, created_at)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Admins passing "all" as rep_id see all nudges; otherwise filter by rep
    if (repId !== "all") {
      query = query.eq("rep_id", repId);
    }

    // Status filter
    if (status === "active" || !status) {
      query = query.eq("is_dismissed", false).eq("is_completed", false);
    } else if (status === "dismissed") {
      query = query.eq("is_dismissed", true);
    } else if (status === "completed") {
      query = query.eq("is_completed", true);
    }
    // "all" — no filter

    // Type filter
    if (nudgeType) {
      query = query.eq("nudge_type", nudgeType);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ nudges: data, total: count });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch nudges" },
      { status: 500 }
    );
  }
});

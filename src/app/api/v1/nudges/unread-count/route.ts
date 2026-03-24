import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

export const GET = withApiProtection(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const repId = searchParams.get("rep_id");

    if (!repId) {
      return NextResponse.json(
        { error: "rep_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    let query = supabase
      .from("rep_nudges")
      .select("id", { count: "exact", head: true })
      .eq("is_dismissed", false)
      .eq("is_completed", false);

    if (repId !== "all") {
      query = query.eq("rep_id", repId);
    }

    const { count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (err) {
    console.error("[/api/v1/nudges/unread-count GET] Error:", err);
    return NextResponse.json(
      { error: "Failed to get unread count" },
      { status: 500 }
    );
  }
});

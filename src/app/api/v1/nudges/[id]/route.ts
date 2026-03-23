import { NextResponse } from "next/server";
import { withApiProtection, isValidUUID } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";

export const PATCH = withApiProtection(
  async (
    request: Request,
    { params }: { params: { id: string } }
  ) => {
    try {
      const { id } = params;

      if (!isValidUUID(id)) {
        return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
      }

      const body = await request.json();

      // Only allow updating specific fields
      const allowed: Record<string, unknown> = {};
      if (typeof body.is_dismissed === "boolean") {
        allowed.is_dismissed = body.is_dismissed;
        if (body.is_dismissed) allowed.dismissed_at = new Date().toISOString();
      }
      if (typeof body.is_completed === "boolean") {
        allowed.is_completed = body.is_completed;
        if (body.is_completed) allowed.completed_at = new Date().toISOString();
      }

      if (Object.keys(allowed).length === 0) {
        return NextResponse.json(
          { error: "No valid fields to update. Allowed: is_dismissed, is_completed" },
          { status: 400 }
        );
      }

      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("rep_nudges")
        .update(allowed)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ error: "Nudge not found" }, { status: 404 });
      }

      return NextResponse.json(data);
    } catch (err) {
      console.error("[/api/v1/nudges/[id] PATCH] Error:", err);
      return NextResponse.json(
        { error: "Failed to update nudge" },
        { status: 500 }
      );
    }
  }
);

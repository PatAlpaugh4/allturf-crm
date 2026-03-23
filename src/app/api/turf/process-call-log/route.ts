import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";
import { processCallLog } from "@/lib/call-processor";

// Future Option B: This endpoint could be replaced by a Supabase Database
// Webhook on call_logs INSERT, triggering processCallLog automatically.

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body = await request.json();

    if (!body.call_log_id || typeof body.call_log_id !== "string") {
      return NextResponse.json(
        { error: "call_log_id is required and must be a string" },
        { status: 400 }
      );
    }

    // Verify call_log exists and is pending
    const supabase = createServiceClient();
    const { data: callLog, error: fetchError } = await supabase
      .from("call_logs")
      .select("id, processing_status")
      .eq("id", body.call_log_id)
      .single();

    if (fetchError || !callLog) {
      return NextResponse.json(
        { error: "Call log not found" },
        { status: 404 }
      );
    }

    if (callLog.processing_status !== "pending") {
      return NextResponse.json(
        { error: `Call log status is '${callLog.processing_status}', expected 'pending'` },
        { status: 409 }
      );
    }

    const result = await processCallLog(body.call_log_id);

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch {
    return NextResponse.json(
      { error: "Processing failed. Please try again." },
      { status: 500 }
    );
  }
});

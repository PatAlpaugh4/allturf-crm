import { NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api";
import { detectTrends } from "@/lib/trend-detector";

// Run periodically (daily via cron) or triggered on demand by a manager.
// POST /api/turf/detect-trends
// Body (all optional): { time_window_days?: number }

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const timeWindowDays =
      typeof body.time_window_days === "number" && body.time_window_days > 0 && body.time_window_days <= 90
        ? body.time_window_days
        : 7;

    const result = await detectTrends(timeWindowDays);

    return NextResponse.json(result, {
      status: result.success ? 200 : 207, // 207 Multi-Status if partial errors
    });
  } catch (err) {
    console.error("[/api/turf/detect-trends] Error:", err);
    return NextResponse.json(
      { error: "Trend detection failed. Please try again." },
      { status: 500 }
    );
  }
});

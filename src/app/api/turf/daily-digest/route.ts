import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { withApiProtection } from "@/lib/api";
import { generateDailyDigest } from "@/lib/digest-generator";

// Future: trigger via cron job each morning at 7:00 AM ET.
// For now, on-demand via the digest UI or direct API call.

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body = await request.json().catch(() => ({}));

    // Default to yesterday if no date provided
    let targetDate: Date;
    if (body.digest_date && typeof body.digest_date === "string") {
      targetDate = new Date(body.digest_date + "T12:00:00Z"); // noon UTC to avoid timezone issues
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid digest_date format. Use YYYY-MM-DD." },
          { status: 400 }
        );
      }
    } else {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
    }

    const result = await generateDailyDigest(targetDate);

    const response: Record<string, unknown> = { ...result };
    if (result.no_activity && result.diagnostics) {
      response.hint = `Found ${result.diagnostics.total} call log(s) but none with status 'completed'. Statuses: ${JSON.stringify(result.diagnostics.statuses)}`;
    }

    return NextResponse.json(response, {
      status: result.success ? 200 : 500,
    });
  } catch {
    return NextResponse.json(
      { error: "Digest generation failed. Please try again." },
      { status: 500 }
    );
  }
});

// GET: Retrieve an existing digest by date
export const GET = withApiProtection(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { error: "date query parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const fallback = searchParams.get("fallback");
    const supabase = createServiceClient();
    let { data: digest } = await supabase
      .from("daily_digests")
      .select("*")
      .eq("digest_date", dateStr)
      .maybeSingle();

    // Only fall back to latest digest when explicitly requested (initial page load)
    if (!digest && fallback === "latest") {
      const { data: latest } = await supabase
        .from("daily_digests")
        .select("*")
        .order("digest_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      digest = latest;
    }

    return NextResponse.json({ digest: digest || null });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve digest." },
      { status: 500 }
    );
  }
});

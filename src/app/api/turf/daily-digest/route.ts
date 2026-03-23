import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { withApiProtection, requireAdmin } from "@/lib/api";
import { generateDailyDigest } from "@/lib/digest-generator";

// Future: trigger via cron job each morning at 7:00 AM ET.
// For now, on-demand via the digest UI or direct API call.

export const POST = withApiProtection(async (request: Request) => {
  try {
    const adminCheck = await requireAdmin(request);
    if (adminCheck.error) return adminCheck.error;

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

    return NextResponse.json(result, {
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
    const adminCheck = await requireAdmin(request);
    if (adminCheck.error) return adminCheck.error;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { error: "date query parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: digest, error } = await supabase
      .from("daily_digests")
      .select("*")
      .eq("digest_date", dateStr)
      .single();

    if (error || !digest) {
      return NextResponse.json({ digest: null });
    }

    return NextResponse.json({ digest });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve digest." },
      { status: 500 }
    );
  }
});

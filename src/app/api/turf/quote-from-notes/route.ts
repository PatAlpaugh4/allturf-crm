import { NextResponse } from "next/server";
import { withApiProtection, sanitizeForPrompt } from "@/lib/api";
import { getLLM } from "@/lib/llm";
import { buildTurfContext, flattenContext } from "@/lib/turf-context";
import {
  buildSystemPrompt,
  validateRecommendations,
  type ProductRecommendationInput,
} from "@/lib/turf-safety";

interface QuoteFromNotesRequest {
  notes: string;
  course_id?: string;
}

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body: QuoteFromNotesRequest = await request.json();

    if (!body.notes || typeof body.notes !== "string") {
      return NextResponse.json(
        { error: "notes is required and must be a string" },
        { status: 400 }
      );
    }

    // Build context with the full product catalog for matching
    const context = await buildTurfContext({
      courseId: body.course_id,
      keywords: body.notes
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 10),
    });

    const contextStr = flattenContext(context);

    // Compose user prompt
    const userPrompt = [
      `CONVERSATION NOTES:\n${sanitizeForPrompt(body.notes)}`,
      contextStr ? `\n--- DATABASE CONTEXT ---\n${contextStr}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Call LLM
    const llm = getLLM();
    const raw = await llm.chat({
      system: buildSystemPrompt("quoteFromNotes"),
      user: userPrompt,
      temperature: 0.2,
      json: true,
    });

    const parsed = JSON.parse(raw);

    // Post-processing — validate extracted items against the database
    if (parsed.extracted_items && Array.isArray(parsed.extracted_items)) {
      const recs: ProductRecommendationInput[] = parsed.extracted_items.map(
        (item: Record<string, unknown>) => ({
          product_id: item.product_id as string | undefined,
          product_name: item.product_name as string | undefined,
          application_rate: item.application_rate as number | undefined,
          application_rate_unit: item.application_rate_unit as string | undefined,
          pcp_registration_number: item.pcp_registration_number as string | null | undefined,
        })
      );

      const { validated, result } = await validateRecommendations(
        recs,
        body.course_id
      );

      // Merge validated data back
      parsed.extracted_items = parsed.extracted_items
        .map((item: Record<string, unknown>) => {
          const v = validated.find(
            (r) =>
              r.product_id === item.product_id ||
              r.product_name === item.product_name
          );
          if (!v) return null;
          return {
            ...item,
            application_rate: v.application_rate ?? item.application_rate,
            pcp_registration_number:
              v.pcp_registration_number ?? item.pcp_registration_number,
          };
        })
        .filter(Boolean);

      parsed.validation = result;
    }

    // Clamp overall confidence
    if (typeof parsed.confidence === "number") {
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/turf/quote-from-notes] Error:", err);
    return NextResponse.json(
      { error: "Quote extraction failed. Please try again." },
      { status: 500 }
    );
  }
});

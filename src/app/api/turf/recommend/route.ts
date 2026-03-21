import { NextResponse } from "next/server";
import { withApiProtection, sanitizeForPrompt } from "@/lib/api";
import { getLLM } from "@/lib/llm";
import { buildTurfContext, flattenContext } from "@/lib/turf-context";
import {
  buildSystemPrompt,
  validateRecommendations,
  type ProductRecommendationInput,
} from "@/lib/turf-safety";

interface RecommendRequest {
  diagnosis: string;
  course_id?: string;
  target_area?: string;
  budget?: number;
  exclude_moa_groups?: string[];
}

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body: RecommendRequest = await request.json();

    if (!body.diagnosis || typeof body.diagnosis !== "string") {
      return NextResponse.json(
        { error: "diagnosis is required and must be a string" },
        { status: 400 }
      );
    }

    // Determine product category from diagnosis context
    const keywords = body.diagnosis
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const context = await buildTurfContext({
      courseId: body.course_id,
      keywords,
    });

    const contextStr = flattenContext(context);

    // Compose user prompt
    const userPrompt = [
      `DIAGNOSIS: ${sanitizeForPrompt(body.diagnosis)}`,
      body.target_area
        ? `TARGET AREA: ${sanitizeForPrompt(body.target_area)}`
        : null,
      body.budget ? `BUDGET: $${body.budget} CAD` : null,
      body.exclude_moa_groups && body.exclude_moa_groups.length > 0
        ? `EXCLUDE MOA GROUPS (already used recently): ${body.exclude_moa_groups.join(", ")}`
        : null,
      contextStr ? `\n--- DATABASE CONTEXT ---\n${contextStr}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Call LLM
    const llm = getLLM();
    const raw = await llm.chat({
      system: buildSystemPrompt("recommend"),
      user: userPrompt,
      temperature: 0.2,
      json: true,
    });

    const parsed = JSON.parse(raw);

    // Post-processing validation — the critical safety step
    if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      const { validated, result } = await validateRecommendations(
        parsed.recommendations as ProductRecommendationInput[],
        body.course_id
      );

      parsed.recommendations = validated;
      parsed.validation = result;

      // Merge validation warnings into the response
      if (result.warnings.length > 0) {
        parsed.moa_rotation_warnings = [
          ...(parsed.moa_rotation_warnings || []),
          ...result.warnings.filter((w: string) => w.includes("RESISTANCE RISK")),
        ];
        parsed.tank_mix_warnings = [
          ...(parsed.tank_mix_warnings || []),
          ...result.warnings.filter((w: string) => w.includes("TANK MIX")),
        ];
        parsed.rate_adjustments = result.warnings.filter(
          (w: string) => w.includes("Clamped") || w.includes("Adjusted")
        );
      }

      // Add errors for removed products
      if (result.errors.length > 0) {
        parsed.registration_errors = result.errors;
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/turf/recommend] Error:", err);
    return NextResponse.json(
      { error: "Recommendation failed. Please try again." },
      { status: 500 }
    );
  }
});

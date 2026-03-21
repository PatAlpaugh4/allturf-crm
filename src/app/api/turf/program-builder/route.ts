import { NextResponse } from "next/server";
import { withApiProtection, sanitizeForPrompt } from "@/lib/api";
import { getLLM } from "@/lib/llm";
import { buildTurfContext, flattenContext } from "@/lib/turf-context";
import {
  buildSystemPrompt,
  validateRecommendations,
  type ProductRecommendationInput,
} from "@/lib/turf-safety";

interface ProgramBuilderRequest {
  course_id: string;
  season_year: number;
  program_type: string;
  goals?: string;
  budget_cap?: number;
}

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body: ProgramBuilderRequest = await request.json();

    if (!body.course_id || typeof body.course_id !== "string") {
      return NextResponse.json(
        { error: "course_id is required" },
        { status: 400 }
      );
    }

    if (!body.season_year || typeof body.season_year !== "number") {
      return NextResponse.json(
        { error: "season_year is required and must be a number" },
        { status: 400 }
      );
    }

    if (!body.program_type || typeof body.program_type !== "string") {
      return NextResponse.json(
        { error: "program_type is required" },
        { status: 400 }
      );
    }

    // Build context — need full course profile, products, treatment history, weather
    const context = await buildTurfContext({
      courseId: body.course_id,
      keywords: [
        "program",
        "seasonal",
        body.program_type.toLowerCase(),
      ],
    });

    const contextStr = flattenContext(context);

    // Compose user prompt
    const userPrompt = [
      `COURSE ID: ${body.course_id}`,
      `SEASON YEAR: ${body.season_year}`,
      `PROGRAM TYPE: ${sanitizeForPrompt(body.program_type)}`,
      body.goals ? `GOALS: ${sanitizeForPrompt(body.goals)}` : null,
      body.budget_cap ? `BUDGET CAP: $${body.budget_cap} CAD` : null,
      contextStr ? `\n--- DATABASE CONTEXT ---\n${contextStr}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Call LLM
    const llm = getLLM();
    const raw = await llm.chat({
      system: buildSystemPrompt("programBuilder"),
      user: userPrompt,
      temperature: 0.3,
      json: true,
    });

    const parsed = JSON.parse(raw);

    // Post-processing — validate all program items
    if (parsed.items && Array.isArray(parsed.items)) {
      const recs: ProductRecommendationInput[] = parsed.items.map(
        (item: Record<string, unknown>) => ({
          product_id: item.product_id as string | undefined,
          product_name: item.product_name as string | undefined,
          application_rate: item.application_rate as number | undefined,
          application_rate_unit: item.application_rate_unit as string | undefined,
          moa_group: item.moa_group as string | null | undefined,
          pcp_registration_number: item.pcp_registration_number as string | null | undefined,
        })
      );

      const { validated, result } = await validateRecommendations(
        recs,
        body.course_id
      );

      // Merge validated data back into items
      parsed.items = parsed.items
        .map((item: Record<string, unknown>) => {
          const v = validated.find(
            (r) =>
              r.product_id === item.product_id ||
              r.product_name === item.product_name
          );
          if (!v) return null; // removed by validation
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

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/turf/program-builder] Error:", err);
    return NextResponse.json(
      { error: "Program generation failed. Please try again." },
      { status: 500 }
    );
  }
});

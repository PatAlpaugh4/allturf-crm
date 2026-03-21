import { NextResponse } from "next/server";
import { withApiProtection, sanitizeForPrompt } from "@/lib/api";
import { getLLM } from "@/lib/llm";
import { buildTurfContext, flattenContext } from "@/lib/turf-context";
import {
  buildSystemPrompt,
  validateRecommendations,
  type ProductRecommendationInput,
} from "@/lib/turf-safety";
import { createServiceClient } from "@/lib/supabase";

interface BudgetOptimizerRequest {
  course_id: string;
  program_id?: string;
  budget: number;
  priorities?: string;
}

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body: BudgetOptimizerRequest = await request.json();

    if (!body.course_id || typeof body.course_id !== "string") {
      return NextResponse.json(
        { error: "course_id is required" },
        { status: 400 }
      );
    }

    if (!body.budget || typeof body.budget !== "number" || body.budget <= 0) {
      return NextResponse.json(
        { error: "budget is required and must be a positive number" },
        { status: 400 }
      );
    }

    // Build standard context
    const context = await buildTurfContext({
      courseId: body.course_id,
      keywords: ["budget", "optimization", "cost", "program"],
    });

    const contextStr = flattenContext(context);

    // If a program_id is provided, fetch the current program items
    let programContext = "";
    if (body.program_id) {
      const supabase = createServiceClient();
      const { data: tasks } = await supabase
        .from("project_tasks")
        .select(
          "title, application_date, application_rate, target_area, product:offerings(name, price, moa_group, pcp_registration_number, application_rate_unit)"
        )
        .eq("project_id", body.program_id)
        .order("sort_order", { ascending: true });

      if (tasks && tasks.length > 0) {
        const lines = tasks.map((t) => {
          const product = t.product as unknown as {
            name: string;
            price: number;
            moa_group: string | null;
            pcp_registration_number: string | null;
            application_rate_unit: string | null;
          } | null;
          return [
            t.title,
            product?.name,
            product?.pcp_registration_number
              ? `PCP#${product.pcp_registration_number}`
              : null,
            t.application_date,
            t.application_rate
              ? `rate:${t.application_rate} ${product?.application_rate_unit || ""}`
              : null,
            t.target_area,
            product?.price ? `$${product.price}` : null,
            product?.moa_group ? `MOA:${product.moa_group}` : null,
          ]
            .filter(Boolean)
            .join(" | ");
        });
        programContext =
          "CURRENT PROGRAM ITEMS:\n" + lines.join("\n");
      }
    }

    // Compose user prompt
    const userPrompt = [
      `COURSE ID: ${body.course_id}`,
      `BUDGET: $${body.budget} CAD`,
      body.priorities
        ? `PRIORITIES: ${sanitizeForPrompt(body.priorities)}`
        : null,
      programContext || null,
      contextStr ? `\n--- DATABASE CONTEXT ---\n${contextStr}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Call LLM
    const llm = getLLM();
    const raw = await llm.chat({
      system: buildSystemPrompt("budgetOptimizer"),
      user: userPrompt,
      temperature: 0.3,
      json: true,
    });

    const parsed = JSON.parse(raw);

    // Post-processing — validate optimized items
    if (parsed.optimized_items && Array.isArray(parsed.optimized_items)) {
      const recs: ProductRecommendationInput[] = parsed.optimized_items.map(
        (item: Record<string, unknown>) => ({
          product_id: item.product_id as string | undefined,
          product_name: item.product_name as string | undefined,
          application_rate: item.application_rate as number | undefined,
          application_rate_unit: item.application_rate_unit as string | undefined,
          pcp_registration_number: item.pcp_registration_number as
            | string
            | null
            | undefined,
        })
      );

      const { validated, result } = await validateRecommendations(
        recs,
        body.course_id
      );

      // Merge validated data back
      parsed.optimized_items = parsed.optimized_items
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

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/turf/budget-optimizer] Error:", err);
    return NextResponse.json(
      { error: "Budget optimization failed. Please try again." },
      { status: 500 }
    );
  }
});

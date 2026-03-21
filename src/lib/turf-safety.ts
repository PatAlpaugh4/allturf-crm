// ============================================================================
// Allturf CRM — Turf Safety Validation (Phase 5.3)
// 3-layer safety model for all AI consultation routes.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";
import type { Offering } from "@/lib/types";

// ============================================================================
// Layer 1 — Safety system prompt (injected into every AI call)
// ============================================================================
export const SAFETY_SYSTEM_PROMPT = `You are an AI turf management consultant for Allturf LTD, operating under strict Canadian regulatory requirements.

SAFETY RULES (non-negotiable — violating these is illegal under Canadian law):
1. NEVER recommend pesticide application rates exceeding the PMRA label maximum. Always stay at or below the product's registered maximum rate.
2. NEVER recommend products that are not registered for use in Ontario (ontario_class must not be null).
3. ALWAYS include the PCP registration number when referencing any product.
4. ALWAYS consider Mode of Action (MOA) rotation. Check the treatment history and flag if the same MOA group was used in the previous 2 applications on the same area. Recommend rotating to a different MOA group to prevent resistance.
5. FLAG any tank mix incompatibilities. Only recommend tank mixes that appear in each product's compatible_tank_mixes list.
6. When your confidence in a diagnosis is below 0.5, explicitly recommend that the superintendent consult a certified agronomist before proceeding.
7. Always specify the application rate unit (e.g., L/ha, mL/100m², kg/ha).
8. Never fabricate product data — only reference products provided in the context.`;

// ============================================================================
// Layer 2 — Task-specific prompt builders
// ============================================================================
export const TASK_PROMPTS = {
  diagnose: `Analyze the symptoms described and provide a diagnosis.
Respond in JSON with this exact schema:
{
  "diagnoses": [{
    "issue_name": "string",
    "type": "Disease|Pest|Weed",
    "confidence": 0.0-1.0,
    "scientific_name": "string|null",
    "symptoms_matched": ["string"],
    "contributing_factors": ["string"],
    "severity": "Excellent|Good|Fair|Poor|Critical",
    "cultural_recommendations": ["string"],
    "reasoning": "string"
  }],
  "follow_up_questions": ["string"],
  "requires_agronomist": boolean
}`,

  recommend: `Recommend products for the given diagnosis and course conditions.
Respond in JSON with this exact schema:
{
  "recommendations": [{
    "product_name": "string",
    "product_id": "string",
    "pcp_registration_number": "string",
    "category": "string",
    "application_rate": number,
    "application_rate_unit": "string",
    "target_area": "string",
    "mode_of_action": "string|null",
    "moa_group": "string|null",
    "efficacy": "Excellent|Good|Fair|Preventive Only",
    "moa_rotation_safe": boolean,
    "tank_mix_compatible_with": ["string"],
    "re_entry_interval_hours": number|null,
    "rain_fast_hours": number|null,
    "estimated_cost_cad": number|null,
    "notes": "string"
  }],
  "moa_rotation_warnings": ["string"],
  "tank_mix_warnings": ["string"]
}`,

  programBuilder: `Design a seasonal treatment program for the given course and goals.
Respond in JSON with this exact schema:
{
  "program_name": "string",
  "items": [{
    "month": "string",
    "product_name": "string",
    "product_id": "string",
    "pcp_registration_number": "string",
    "application_rate": number,
    "application_rate_unit": "string",
    "target_area": "string",
    "moa_group": "string|null",
    "estimated_cost_cad": number,
    "notes": "string"
  }],
  "total_estimated_cost_cad": number,
  "budget_notes": "string",
  "moa_rotation_plan": "string"
}`,

  visitPrep: `Generate a pre-visit briefing for the sales rep.
Respond in JSON with this exact schema:
{
  "company_name": "string",
  "superintendent_name": "string|null",
  "course_profile_summary": "string",
  "recent_weather": {
    "avg_temp_c": number|null,
    "total_rainfall_mm": number|null,
    "gdd_cumulative": number|null,
    "is_spray_window": boolean
  },
  "active_issues": [{"issue_name":"string","type":"string","severity":"string","current_status":"string"}],
  "recent_treatments": [{"product_name":"string","application_date":"string","moa_group":"string|null"}],
  "upcoming_deliveries": [{"deal_name":"string","scheduled_date":"string","status":"string"}],
  "moa_rotation_alerts": ["string"],
  "seasonal_risk_factors": ["string"],
  "suggested_talking_points": ["string"]
}`,

  quoteFromNotes: `Extract product mentions from conversation notes and match them to the catalog.
Respond in JSON with this exact schema:
{
  "extracted_items": [{
    "product_name": "string",
    "product_id": "string",
    "pcp_registration_number": "string",
    "quantity": number|null,
    "application_rate": number|null,
    "application_rate_unit": "string|null",
    "target_area": "string|null",
    "notes": "string"
  }],
  "unmatched_mentions": ["string"],
  "confidence": 0.0-1.0
}`,

  budgetOptimizer: `Optimize a treatment program to fit within the given budget.
Respond in JSON with this exact schema:
{
  "optimized_items": [{
    "product_name": "string",
    "product_id": "string",
    "pcp_registration_number": "string",
    "application_rate": number,
    "application_rate_unit": "string",
    "estimated_cost_cad": number,
    "notes": "string"
  }],
  "total_cost_cad": number,
  "savings_cad": number,
  "tradeoffs": ["string"],
  "risk_notes": ["string"]
}`,
} as const;

export type TaskType = keyof typeof TASK_PROMPTS;

// ============================================================================
// Layer 3 — Post-processing validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  clamped: boolean;
}

export interface ProductRecommendationInput {
  product_id?: string;
  product_name?: string;
  application_rate?: number;
  application_rate_unit?: string;
  moa_group?: string | null;
  pcp_registration_number?: string | null;
  tank_mix_compatible_with?: string[];
}

/**
 * Validates a list of AI-recommended products against the database.
 * Clamps rates, checks Ontario registration, MOA rotation, and tank mix compatibility.
 */
export async function validateRecommendations(
  recommendations: ProductRecommendationInput[],
  courseId?: string
): Promise<{
  validated: ProductRecommendationInput[];
  result: ValidationResult;
}> {
  const supabase = createServiceClient();
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    clamped: false,
  };

  // Fetch all referenced products from DB for validation
  const productIds = recommendations
    .map((r) => r.product_id)
    .filter((id): id is string => !!id);

  let productsMap = new Map<string, Offering>();

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("offerings")
      .select("*")
      .in("id", productIds);

    if (products) {
      productsMap = new Map(products.map((p) => [p.id, p as Offering]));
    }
  }

  // Fetch recent treatment history for MOA rotation check
  let recentMoaGroups: string[] = [];
  if (courseId) {
    const { data: recentTreatments } = await supabase
      .from("visit_recommendations")
      .select(
        "product:offerings(moa_group), visit_report:visit_reports!inner(company_id, visit_date)"
      )
      .eq("visit_report.company_id", courseId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (recentTreatments) {
      recentMoaGroups = recentTreatments
        .map((t) => {
          const product = t.product as unknown as { moa_group: string | null } | null;
          return product?.moa_group;
        })
        .filter((g): g is string => !!g);
    }
  }

  const validated = recommendations.map((rec) => {
    const product = rec.product_id ? productsMap.get(rec.product_id) : null;

    if (!product && rec.product_id) {
      result.errors.push(
        `Product ${rec.product_name || rec.product_id} not found in database.`
      );
      result.valid = false;
      return rec;
    }

    if (product) {
      // --- Check 1: Ontario registration ---
      if (!product.ontario_class) {
        result.errors.push(
          `${product.name} (PCP#${product.pcp_registration_number || "N/A"}) is NOT registered for Ontario use. Removing from recommendations.`
        );
        result.valid = false;
        return { ...rec, _removed: true } as ProductRecommendationInput;
      }

      // --- Check 2: Clamp application rate to label max ---
      if (
        rec.application_rate != null &&
        product.application_rate_max != null &&
        rec.application_rate > product.application_rate_max
      ) {
        result.warnings.push(
          `${product.name}: AI recommended rate ${rec.application_rate} ${rec.application_rate_unit || ""} exceeds PMRA label maximum of ${product.application_rate_max} ${product.application_rate_unit || ""}. Clamped to label maximum.`
        );
        rec = { ...rec, application_rate: product.application_rate_max };
        result.clamped = true;
      }

      // --- Check 2b: Clamp to label min if below ---
      if (
        rec.application_rate != null &&
        product.application_rate_min != null &&
        rec.application_rate < product.application_rate_min
      ) {
        result.warnings.push(
          `${product.name}: AI recommended rate ${rec.application_rate} is below label minimum of ${product.application_rate_min}. Adjusted to label minimum.`
        );
        rec = { ...rec, application_rate: product.application_rate_min };
        result.clamped = true;
      }

      // --- Check 3: MOA rotation ---
      if (product.moa_group && recentMoaGroups.includes(product.moa_group)) {
        result.warnings.push(
          `RESISTANCE RISK: ${product.name} (MOA: ${product.moa_group}) uses the same mode of action as one of the last 2 treatments on this course. Consider rotating to a different MOA group.`
        );
      }

      // --- Check 4: Tank mix compatibility ---
      if (
        rec.tank_mix_compatible_with &&
        rec.tank_mix_compatible_with.length > 0 &&
        product.compatible_tank_mixes
      ) {
        const incompatible = rec.tank_mix_compatible_with.filter(
          (mixId) => !product.compatible_tank_mixes!.includes(mixId)
        );
        if (incompatible.length > 0) {
          result.warnings.push(
            `TANK MIX WARNING: ${product.name} has not been verified as compatible with products: ${incompatible.join(", ")}. Check label before mixing.`
          );
        }
      }

      // Ensure PCP number is attached
      if (!rec.pcp_registration_number && product.pcp_registration_number) {
        rec = { ...rec, pcp_registration_number: product.pcp_registration_number };
      }
    }

    return rec;
  });

  // Remove any products flagged as not Ontario-registered
  const finalValidated = validated.filter(
    (r) => !(r as Record<string, unknown>)._removed
  );

  return { validated: finalValidated, result };
}

/**
 * Builds the full system prompt by combining safety layer + task-specific layer.
 */
export function buildSystemPrompt(task: TaskType): string {
  return `${SAFETY_SYSTEM_PROMPT}\n\n--- TASK ---\n${TASK_PROMPTS[task]}`;
}

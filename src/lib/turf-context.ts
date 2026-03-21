// ============================================================================
// Allturf CRM — Turf Context Builder (Phase 5.2)
// Assembles domain context for AI prompts from the database.
// Caps total output at ~6000 tokens (~24 000 chars) for Groq compatibility.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";

const MAX_CONTEXT_CHARS = 24_000; // ~6000 tokens at ~4 chars/token

// ---------------------------------------------------------------------------
// Types for context sections
// ---------------------------------------------------------------------------
export interface TurfContext {
  courseProfile: string;
  treatmentHistory: string;
  knowledgeBase: string;
  matchingProducts: string;
  weather: string;
  totalChars: number;
}

// ---------------------------------------------------------------------------
// Main context builder
// ---------------------------------------------------------------------------
export async function buildTurfContext(params: {
  courseId?: string;
  keywords?: string[];
  productCategory?: string;
  diseasePestName?: string;
}): Promise<TurfContext> {
  const supabase = createServiceClient();
  const sections: TurfContext = {
    courseProfile: "",
    treatmentHistory: "",
    knowledgeBase: "",
    matchingProducts: "",
    weather: "",
    totalChars: 0,
  };

  let budget = MAX_CONTEXT_CHARS;

  // 1. Course profile (~800 chars)
  if (params.courseId) {
    const { data: profile } = await supabase
      .from("golf_course_profiles")
      .select(
        "*, companies!inner(name, city, province)"
      )
      .eq("company_id", params.courseId)
      .single();

    if (profile) {
      const company = profile.companies as { name: string; city: string | null; province: string | null };
      const lines = [
        `Course: ${company.name}`,
        company.city ? `Location: ${company.city}, ${company.province || "ON"}` : null,
        profile.num_holes ? `Holes: ${profile.num_holes}` : null,
        profile.total_acreage ? `Acreage: ${profile.total_acreage}` : null,
        profile.course_type ? `Type: ${profile.course_type}` : null,
        profile.green_grass ? `Greens: ${profile.green_grass}` : null,
        profile.fairway_grass ? `Fairways: ${profile.fairway_grass}` : null,
        profile.rough_grass ? `Rough: ${profile.rough_grass}` : null,
        profile.soil_type ? `Soil: ${profile.soil_type}` : null,
        profile.irrigation_type ? `Irrigation: ${profile.irrigation_type}` : null,
        profile.maintenance_level ? `Maintenance level: ${profile.maintenance_level}` : null,
        profile.usda_zone ? `USDA zone: ${profile.usda_zone}` : null,
        profile.ipm_program ? "IPM program: Yes" : null,
        profile.annual_turf_budget_min || profile.annual_turf_budget_max
          ? `Budget range: $${profile.annual_turf_budget_min ?? "?"} – $${profile.annual_turf_budget_max ?? "?"}`
          : null,
      ].filter(Boolean);
      sections.courseProfile = lines.join("\n");
      budget -= sections.courseProfile.length;
    }
  }

  // 2. Treatment history — last 2 years for MOA rotation (~2000 chars)
  if (params.courseId && budget > 0) {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const { data: recommendations } = await supabase
      .from("visit_recommendations")
      .select(
        `
        application_rate,
        target_area,
        notes,
        created_at,
        product:offerings(name, moa_group, category, pcp_registration_number),
        disease_pest:turf_diseases_pests(name, type),
        visit_report:visit_reports!inner(company_id, visit_date)
      `
      )
      .eq("visit_report.company_id", params.courseId)
      .gte("visit_report.visit_date", twoYearsAgo.toISOString().split("T")[0])
      .order("created_at", { ascending: false })
      .limit(30);

    if (recommendations && recommendations.length > 0) {
      const lines = recommendations.map((r) => {
        const product = r.product as unknown as { name: string; moa_group: string | null; category: string; pcp_registration_number: string | null } | null;
        const disease = r.disease_pest as unknown as { name: string; type: string } | null;
        const report = r.visit_report as unknown as { visit_date: string } | null;
        return [
          report?.visit_date,
          product?.name,
          product?.moa_group ? `MOA:${product.moa_group}` : null,
          product?.pcp_registration_number ? `PCP#${product.pcp_registration_number}` : null,
          disease?.name ? `for ${disease.name}` : null,
          r.application_rate ? `rate:${r.application_rate}` : null,
          r.target_area,
        ]
          .filter(Boolean)
          .join(" | ");
      });

      const section = "TREATMENT HISTORY (last 2 years):\n" + lines.join("\n");
      sections.treatmentHistory = truncateToFit(section, Math.min(budget, 4000));
      budget -= sections.treatmentHistory.length;
    }
  }

  // 3. Knowledge base — keyword matching (~1500 chars)
  if (params.keywords && params.keywords.length > 0 && budget > 0) {
    const { data: entries } = await supabase
      .from("turf_knowledge_base")
      .select("title, category, content, symptoms, conditions, keywords")
      .overlaps("keywords", params.keywords)
      .limit(8);

    if (entries && entries.length > 0) {
      const lines = entries.map(
        (e) =>
          `[${e.category}] ${e.title}: ${e.content || ""}${e.symptoms ? ` Symptoms: ${e.symptoms}` : ""}${e.conditions ? ` Conditions: ${e.conditions}` : ""}`
      );
      const section = "KNOWLEDGE BASE:\n" + lines.join("\n");
      sections.knowledgeBase = truncateToFit(section, Math.min(budget, 3000));
      budget -= sections.knowledgeBase.length;
    }
  }

  // 4. Matching products (~1500 chars)
  if (budget > 0) {
    let query = supabase
      .from("offerings")
      .select(
        "id, name, category, manufacturer, active_ingredients, pcp_registration_number, application_rate_min, application_rate_max, application_rate_unit, moa_group, mode_of_action, compatible_tank_mixes, ontario_class, price, signal_word, re_entry_interval_hours, rain_fast_hours"
      )
      .eq("is_active", true)
      .not("ontario_class", "is", null);

    if (params.productCategory) {
      query = query.eq("category", params.productCategory);
    }

    const { data: products } = await query.limit(15);

    if (products && products.length > 0) {
      const lines = products.map((p) =>
        [
          p.name,
          `PCP#${p.pcp_registration_number || "N/A"}`,
          p.category,
          p.moa_group ? `MOA:${p.moa_group}` : null,
          p.application_rate_min || p.application_rate_max
            ? `rate:${p.application_rate_min ?? "?"}–${p.application_rate_max ?? "?"} ${p.application_rate_unit || ""}`
            : null,
          p.manufacturer,
          `$${p.price}`,
          p.ontario_class ? `ON-class:${p.ontario_class}` : null,
        ]
          .filter(Boolean)
          .join(" | ")
      );
      const section = "AVAILABLE PRODUCTS (Ontario-registered):\n" + lines.join("\n");
      sections.matchingProducts = truncateToFit(section, Math.min(budget, 3000));
      budget -= sections.matchingProducts.length;
    }
  }

  // 5. Weather snapshots — latest 7 days (~500 chars)
  if (params.courseId && budget > 0) {
    const { data: weather } = await supabase
      .from("weather_snapshots")
      .select("snapshot_date, temp_high_c, temp_low_c, temp_avg_c, rainfall_mm, humidity_avg, wind_avg_kmh, gdd_daily, gdd_cumulative, is_spray_window")
      .eq("company_id", params.courseId)
      .order("snapshot_date", { ascending: false })
      .limit(7);

    if (weather && weather.length > 0) {
      const lines = weather.map(
        (w) =>
          `${w.snapshot_date}: ${w.temp_low_c ?? "?"}–${w.temp_high_c ?? "?"}°C, rain:${w.rainfall_mm ?? 0}mm, humidity:${w.humidity_avg ?? "?"}%, wind:${w.wind_avg_kmh ?? "?"}km/h, GDD:${w.gdd_daily ?? "?"}(cum:${w.gdd_cumulative ?? "?"})${w.is_spray_window ? " [SPRAY OK]" : ""}`
      );
      const section = "RECENT WEATHER:\n" + lines.join("\n");
      sections.weather = truncateToFit(section, Math.min(budget, 1000));
      budget -= sections.weather.length;
    }
  }

  sections.totalChars =
    MAX_CONTEXT_CHARS - budget;

  return sections;
}

// ---------------------------------------------------------------------------
// Flatten context into a single string for prompt injection
// ---------------------------------------------------------------------------
export function flattenContext(ctx: TurfContext): string {
  return [
    ctx.courseProfile,
    ctx.treatmentHistory,
    ctx.knowledgeBase,
    ctx.matchingProducts,
    ctx.weather,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Helper — truncate a string to fit within a character budget
// ---------------------------------------------------------------------------
function truncateToFit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 20) + "\n[...truncated]";
}

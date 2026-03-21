import { NextResponse } from "next/server";
import { withApiProtection, sanitizeForPrompt } from "@/lib/api";
import { getLLM } from "@/lib/llm";
import { buildTurfContext, flattenContext } from "@/lib/turf-context";
import { buildSystemPrompt } from "@/lib/turf-safety";

interface DiagnoseRequest {
  symptoms: string;
  grass_type?: string;
  season?: string;
  weather_context?: string;
  course_id?: string;
}

export const POST = withApiProtection(async (request: Request) => {
  try {
    const body: DiagnoseRequest = await request.json();

    if (!body.symptoms || typeof body.symptoms !== "string") {
      return NextResponse.json(
        { error: "symptoms is required and must be a string" },
        { status: 400 }
      );
    }

    // Build context from database
    const keywords = extractKeywords(body.symptoms);
    const context = await buildTurfContext({
      courseId: body.course_id,
      keywords,
    });

    const contextStr = flattenContext(context);

    // Compose the user prompt
    const userPrompt = [
      `SYMPTOMS: ${sanitizeForPrompt(body.symptoms)}`,
      body.grass_type ? `GRASS TYPE: ${sanitizeForPrompt(body.grass_type)}` : null,
      body.season ? `SEASON: ${sanitizeForPrompt(body.season)}` : null,
      body.weather_context
        ? `WEATHER: ${sanitizeForPrompt(body.weather_context)}`
        : null,
      contextStr ? `\n--- DATABASE CONTEXT ---\n${contextStr}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Call LLM with safety + task prompt
    const llm = getLLM();
    const raw = await llm.chat({
      system: buildSystemPrompt("diagnose"),
      user: userPrompt,
      temperature: 0.1,
      json: true,
    });

    const parsed = JSON.parse(raw);

    // Post-processing: clamp confidence values to 0-1 range
    if (parsed.diagnoses && Array.isArray(parsed.diagnoses)) {
      for (const d of parsed.diagnoses) {
        if (typeof d.confidence === "number") {
          d.confidence = Math.max(0, Math.min(1, d.confidence));
        }
      }

      // If any diagnosis has low confidence, ensure requires_agronomist is set
      const hasLowConfidence = parsed.diagnoses.some(
        (d: { confidence?: number }) =>
          typeof d.confidence === "number" && d.confidence < 0.5
      );
      if (hasLowConfidence) {
        parsed.requires_agronomist = true;
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/turf/diagnose] Error:", err);
    return NextResponse.json(
      { error: "Diagnosis failed. Please try again." },
      { status: 500 }
    );
  }
});

function extractKeywords(symptoms: string): string[] {
  const commonTerms = [
    "dollar spot", "snow mold", "pythium", "brown patch", "fairy ring",
    "anthracnose", "summer patch", "red thread", "fusarium", "rust",
    "leaf spot", "necrotic ring", "take-all", "gray leaf",
    "grub", "chinch", "crane fly", "weevil", "webworm", "cutworm", "armyworm",
    "crabgrass", "broadleaf", "plantain", "dandelion", "clover",
    "wilting", "yellowing", "brown", "patch", "ring", "lesion", "mycelium",
    "fungus", "disease", "pest", "insect", "weed",
  ];

  const lower = symptoms.toLowerCase();
  const matched = commonTerms.filter((term) => lower.includes(term));

  // Also add individual words > 3 chars as keywords
  const words = lower
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return Array.from(new Set([...matched, ...words])).slice(0, 15);
}

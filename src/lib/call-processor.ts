// ============================================================================
// Allturf CRM — Call Log Processing Pipeline
// Extracts structured intelligence from raw call transcripts via LLM,
// matches to CRM records, generates nudges, and creates activity records.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";
import { getLLM } from "@/lib/llm";
import { SAFETY_SYSTEM_PROMPT } from "@/lib/turf-safety";
import { sanitizeForPrompt } from "@/lib/api";
import {
  matchContacts,
  matchCompanies,
  matchDiseases,
  matchProducts,
} from "@/lib/fuzzy-match";
import type {
  NudgeType,
  NudgePriority,
  Sentiment,
  ProductRequest,
  ActionItem,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProcessingResult {
  success: boolean;
  call_log_id: string;
  extraction_id?: string;
  activity_id?: string;
  nudges_created: number;
  warnings: string[];
  error?: string;
}

interface LLMExtraction {
  summary: string;
  sentiment: Sentiment;
  diseases_mentioned: string[];
  products_mentioned: string[];
  products_requested: Array<{
    product_name: string;
    quantity: number | null;
    unit: string | null;
    urgency: string | null;
    notes: string | null;
  }>;
  competitor_mentions: string[];
  budget_signals: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  action_items: Array<{
    type: string;
    description: string;
    due_date: string | null;
    priority: string | null;
  }>;
  key_topics: string[];
  confidence_score: number;
  contact_names: string[];
  company_names: string[];
  // A9: Richer extraction fields
  commitments: Array<{
    description: string;
    deadline: string | null;
    owner: string | null;
  }>;
  reorders: Array<{
    product_name: string;
    quantity: number | null;
    unit: string | null;
    needed_by: string | null;
  }>;
  urgency_level: "routine" | "soon" | "urgent" | "emergency";
}

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_TASK_PROMPT = `You are analyzing a sales rep's call notes or voice dictation from a turf products distributor.
These transcripts are often conversational dictations recorded from a vehicle — expect informal language,
partial sentences, and patterns like "Just left [course]", "Talked to [name]", "They need [product]",
"He said he'd [commitment]", "Gotta send [action] by [date]".

Extract structured intelligence from the transcript.

Respond in JSON with this exact schema:
{
  "summary": "string — 2-3 sentence summary of the conversation",
  "sentiment": "positive|neutral|concerned|urgent",
  "diseases_mentioned": ["string — turf disease or pest names mentioned"],
  "products_mentioned": ["string — product names mentioned in any context"],
  "products_requested": [{"product_name": "string", "quantity": null, "unit": null, "urgency": null, "notes": null}],
  "competitor_mentions": ["string — competitor company or product names"],
  "budget_signals": "string|null — any budget-related comments",
  "follow_up_needed": true,
  "follow_up_date": "YYYY-MM-DD|null — explicit date if mentioned",
  "action_items": [{"type": "send_quote|schedule_visit|send_sample|follow_up_call|check_inventory|order_product|other", "description": "string", "due_date": "YYYY-MM-DD|null", "priority": "low|medium|high|urgent"}],
  "key_topics": ["string — main themes discussed"],
  "confidence_score": 0.0-1.0,
  "contact_names": ["string — person names mentioned (first name, last name, or both)"],
  "company_names": ["string — golf course or company names mentioned"],
  "commitments": [{"description": "string — what was promised or agreed to", "deadline": "YYYY-MM-DD|null", "owner": "rep|customer|null — who owns the commitment"}],
  "reorders": [{"product_name": "string", "quantity": null, "unit": null, "needed_by": "YYYY-MM-DD|null"}],
  "urgency_level": "routine|soon|urgent|emergency"
}

Rules:
- Only include items explicitly mentioned or strongly implied in the transcript.
- Do not invent or assume information not present.
- Set confidence_score lower (< 0.5) if the transcript is garbled, very short, or ambiguous.
- For follow_up_date, deadlines, and needed_by dates, convert relative dates (e.g., "Friday", "next week", "end of month") using today's date context.
- Include all product names even if only briefly mentioned.
- "commitments" are promises or agreements made during the conversation (e.g., "I'll send a quote", "He agreed to trial", "She wants a demo next week").
- "reorders" are repeat/refill product requests — the customer has ordered before and needs more (e.g., "running low on Banner", "need another pallet of Primo").
- "urgency_level": routine = standard follow-up, soon = within a few days, urgent = needs attention today, emergency = crop/turf at risk.`;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function processCallLog(callLogId: string): Promise<ProcessingResult> {
  const supabase = createServiceClient();
  const warnings: string[] = [];

  // Fetch call_log and verify status
  const { data: callLog, error: fetchError } = await supabase
    .from("call_logs")
    .select("*")
    .eq("id", callLogId)
    .single();

  if (fetchError || !callLog) {
    return {
      success: false,
      call_log_id: callLogId,
      nudges_created: 0,
      warnings: [],
      error: `Call log not found: ${fetchError?.message || "no data"}`,
    };
  }

  if (callLog.processing_status !== "pending") {
    return {
      success: false,
      call_log_id: callLogId,
      nudges_created: 0,
      warnings: [],
      error: `Call log status is '${callLog.processing_status}', expected 'pending'`,
    };
  }

  // Mark as processing
  await supabase
    .from("call_logs")
    .update({ processing_status: "processing" })
    .eq("id", callLogId);

  // Step 1: LLM extraction
  let extraction: LLMExtraction;
  try {
    extraction = await extractFromTranscript(callLog.raw_transcript || "");
  } catch (err) {
    await supabase
      .from("call_logs")
      .update({ processing_status: "failed" })
      .eq("id", callLogId);
    return {
      success: false,
      call_log_id: callLogId,
      nudges_created: 0,
      warnings: [],
      error: `LLM extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Step 2: CRM matching (non-fatal)
  let matchedProducts = new Map<string, { id: string; pcp_registration_number: string | null }>();
  let matchedContacts = new Map<string, { id: string; company_id: string | null }>();
  let matchedCompanies = new Map<string, { id: string }>();
  let matchedDiseases = new Map<string, { id: string }>();

  try {
    const allProductNames = [
      ...extraction.products_mentioned,
      ...extraction.products_requested.map((p) => p.product_name),
    ];
    const uniqueProductNames = Array.from(new Set(allProductNames));

    [matchedProducts, matchedContacts, matchedCompanies, matchedDiseases] =
      await Promise.all([
        matchProducts(uniqueProductNames, supabase),
        matchContacts(extraction.contact_names, supabase),
        matchCompanies(extraction.company_names, supabase),
        matchDiseases(extraction.diseases_mentioned, supabase),
      ]);
  } catch (err) {
    warnings.push(`CRM matching partially failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Populate product_id on products_requested
  const productsRequested: ProductRequest[] = extraction.products_requested.map((p) => ({
    product_name: p.product_name,
    product_id: matchedProducts.get(p.product_name)?.id || null,
    quantity: p.quantity,
    unit: p.unit,
    urgency: p.urgency,
    notes: p.notes,
  }));

  // Update call_log with matched company/contact if missing
  const updates: Record<string, string> = {};
  if (!callLog.company_id && extraction.company_names.length > 0) {
    const firstCompany = matchedCompanies.get(extraction.company_names[0]);
    if (firstCompany) updates.company_id = firstCompany.id;
  }
  if (!callLog.contact_id && extraction.contact_names.length > 0) {
    const firstContact = matchedContacts.get(extraction.contact_names[0]);
    if (firstContact) {
      updates.contact_id = firstContact.id;
      // Also set company_id from contact if still missing
      if (!callLog.company_id && !updates.company_id && firstContact.company_id) {
        updates.company_id = firstContact.company_id;
      }
    }
  }
  if (Object.keys(updates).length > 0) {
    await supabase.from("call_logs").update(updates).eq("id", callLogId);
  }

  const effectiveCompanyId = updates.company_id || callLog.company_id;
  const effectiveContactId = updates.contact_id || callLog.contact_id;

  // Step 3: Nudge generation (non-fatal)
  let nudgesCreated = 0;
  try {
    nudgesCreated = await generateNudges({
      callLog: { ...callLog, company_id: effectiveCompanyId, contact_id: effectiveContactId },
      extraction,
      matchedProducts,
      matchedDiseases,
      supabase,
    });
  } catch (err) {
    warnings.push(`Nudge generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 4: Activity creation (non-fatal)
  let activityId: string | undefined;
  try {
    if (extraction.confidence_score >= 0.5) {
      activityId = await createActivity({
        callLogId,
        repId: callLog.rep_id,
        companyId: effectiveCompanyId,
        contactId: effectiveContactId,
        rawTranscript: callLog.raw_transcript || "",
        summary: extraction.summary,
        supabase,
      });
    } else {
      warnings.push("Confidence below 0.5 — activity not created, flagged for rep review.");
    }
  } catch (err) {
    warnings.push(`Activity creation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Validate action items
  const actionItems: ActionItem[] = (extraction.action_items || []).map((ai) => ({
    type: validateActionItemType(ai.type),
    description: ai.description,
    due_date: ai.due_date || null,
    company_id: effectiveCompanyId || null,
    contact_id: effectiveContactId || null,
    priority: validateNudgePriority(ai.priority) || "medium",
    completed: false,
  }));

  // Insert extraction record
  const { data: extractionRecord } = await supabase
    .from("call_log_extractions")
    .insert({
      call_log_id: callLogId,
      summary: extraction.summary,
      sentiment: validateSentiment(extraction.sentiment),
      diseases_mentioned: extraction.diseases_mentioned,
      products_mentioned: extraction.products_mentioned,
      products_requested: productsRequested,
      competitor_mentions: extraction.competitor_mentions,
      budget_signals: extraction.budget_signals,
      follow_up_needed: extraction.follow_up_needed,
      follow_up_date: extraction.follow_up_date,
      action_items: actionItems,
      key_topics: extraction.key_topics,
      confidence_score: Math.max(0, Math.min(1, extraction.confidence_score)),
      extracted_contact_name: extraction.contact_names[0] || null,
      extracted_company_name: extraction.company_names[0] || null,
      extracted_products_requested: extraction.products_requested.map((p) => p.product_name),
      extracted_quantities: extraction.products_requested
        .filter((p) => p.quantity != null)
        .map((p) => ({ product: p.product_name, quantity: p.quantity, unit: p.unit })),
      extracted_commitments: extraction.commitments,
      extracted_reorders: extraction.reorders,
      urgency_level: extraction.urgency_level,
    })
    .select("id")
    .single();

  // Step 5: Demand signal generation (non-fatal)
  try {
    await generateDemandSignals({
      callLogId,
      repId: callLog.rep_id,
      companyId: effectiveCompanyId,
      extraction,
      matchedProducts,
      supabase,
    });
  } catch (err) {
    warnings.push(`Demand signal generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Update call_log to completed
  await supabase
    .from("call_logs")
    .update({
      processing_status: "completed",
      processed_at: new Date().toISOString(),
      ...(activityId ? { activity_id: activityId } : {}),
    })
    .eq("id", callLogId);

  return {
    success: true,
    call_log_id: callLogId,
    extraction_id: extractionRecord?.id,
    activity_id: activityId,
    nudges_created: nudgesCreated,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Step 1: LLM extraction
// ---------------------------------------------------------------------------

async function extractFromTranscript(transcript: string): Promise<LLMExtraction> {
  const llm = getLLM();
  const systemPrompt = `${SAFETY_SYSTEM_PROMPT}\n\n--- TASK ---\n${EXTRACTION_TASK_PROMPT}`;

  const today = new Date().toISOString().split("T")[0];
  const userPrompt = `Today's date: ${today}\n\nTRANSCRIPT:\n${sanitizeForPrompt(transcript)}`;

  const raw = await llm.chat({
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.1,
    json: true,
  });

  const parsed = JSON.parse(raw);

  // Defensive structure validation with defaults
  const VALID_URGENCY_LEVELS = ["routine", "soon", "urgent", "emergency"] as const;
  const rawUrgency = typeof parsed.urgency_level === "string" ? parsed.urgency_level : "routine";

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    sentiment: parsed.sentiment || "neutral",
    diseases_mentioned: Array.isArray(parsed.diseases_mentioned) ? parsed.diseases_mentioned : [],
    products_mentioned: Array.isArray(parsed.products_mentioned) ? parsed.products_mentioned : [],
    products_requested: Array.isArray(parsed.products_requested) ? parsed.products_requested : [],
    competitor_mentions: Array.isArray(parsed.competitor_mentions) ? parsed.competitor_mentions : [],
    budget_signals: parsed.budget_signals || null,
    follow_up_needed: Boolean(parsed.follow_up_needed),
    follow_up_date: typeof parsed.follow_up_date === "string" ? parsed.follow_up_date : null,
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    key_topics: Array.isArray(parsed.key_topics) ? parsed.key_topics : [],
    confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0.5,
    contact_names: Array.isArray(parsed.contact_names) ? parsed.contact_names : [],
    company_names: Array.isArray(parsed.company_names) ? parsed.company_names : [],
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
    reorders: Array.isArray(parsed.reorders) ? parsed.reorders : [],
    urgency_level: (VALID_URGENCY_LEVELS as readonly string[]).includes(rawUrgency)
      ? (rawUrgency as LLMExtraction["urgency_level"])
      : "routine",
  };
}

// ---------------------------------------------------------------------------
// Step 3: Nudge generation
// ---------------------------------------------------------------------------

interface NudgeContext {
  callLog: { id: string; rep_id: string; company_id: string | null; contact_id: string | null };
  extraction: LLMExtraction;
  matchedProducts: Map<string, { id: string; pcp_registration_number: string | null }>;
  matchedDiseases: Map<string, { id: string }>;
  supabase: ReturnType<typeof createServiceClient>;
}

interface NudgeInsert {
  rep_id: string;
  company_id: string | null;
  contact_id: string | null;
  call_log_id: string;
  nudge_type: NudgeType;
  priority: NudgePriority;
  title: string;
  message: string;
  suggested_action: string | null;
  due_date: string | null;
}

async function generateNudges(ctx: NudgeContext): Promise<number> {
  const { callLog, extraction, matchedProducts, matchedDiseases, supabase } = ctx;
  const nudges: NudgeInsert[] = [];

  // Check existing active nudges to prevent duplicates (max 3 of same type per rep+company)
  const { data: existingNudges } = await supabase
    .from("rep_nudges")
    .select("nudge_type")
    .eq("rep_id", callLog.rep_id)
    .eq("is_dismissed", false)
    .eq("is_completed", false);

  const existingCounts = new Map<string, number>();
  if (existingNudges) {
    for (const n of existingNudges) {
      const key = n.nudge_type;
      existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
    }
  }

  function canAddNudge(type: NudgeType): boolean {
    return (existingCounts.get(type) || 0) < 5 && nudges.length < 10;
  }

  // Determine priority based on sentiment and follow-up urgency
  const basePriority = determinePriority(extraction);

  // 1. Follow-up needed → action_reminder
  if (extraction.follow_up_needed && canAddNudge("action_reminder")) {
    nudges.push({
      rep_id: callLog.rep_id,
      company_id: callLog.company_id,
      contact_id: callLog.contact_id,
      call_log_id: callLog.id,
      nudge_type: "action_reminder",
      priority: basePriority,
      title: "Follow-up required",
      message: extraction.summary
        ? `Follow up needed: ${extraction.summary.slice(0, 200)}`
        : "Follow-up action required from recent call.",
      suggested_action: extraction.action_items?.[0]?.description || null,
      due_date: extraction.follow_up_date || null,
    });
  }

  // 2. Product requested, check for open quotes
  for (const pr of extraction.products_requested) {
    if (!canAddNudge("action_reminder")) break;
    const matched = matchedProducts.get(pr.product_name);
    if (!matched || !callLog.company_id) continue;

    // Check if there's already an active deal for this company
    const { data: activeDeal } = await supabase
      .from("deals")
      .select("id")
      .eq("company_id", callLog.company_id)
      .in("stage", ["Quote Draft", "Quote Sent", "Quote Approved", "Order Placed"])
      .limit(1);

    if (!activeDeal || activeDeal.length === 0) {
      nudges.push({
        rep_id: callLog.rep_id,
        company_id: callLog.company_id,
        contact_id: callLog.contact_id,
        call_log_id: callLog.id,
        nudge_type: "action_reminder",
        priority: "high",
        title: `Quote needed: ${pr.product_name}`,
        message: `${pr.product_name} was requested${pr.quantity ? ` (${pr.quantity} ${pr.unit || "units"})` : ""} but no active quote exists for this course.${matched.pcp_registration_number ? ` PCP# ${matched.pcp_registration_number}` : ""}`,
        suggested_action: "Create a quote for the requested product.",
        due_date: null,
      });
    }
  }

  // 3. Disease mentioned → cross_sell (check product_disease_links)
  for (const diseaseName of extraction.diseases_mentioned) {
    if (!canAddNudge("cross_sell")) break;
    const diseaseMatch = matchedDiseases.get(diseaseName);
    if (!diseaseMatch) continue;

    const { data: linkedProducts } = await supabase
      .from("product_disease_links")
      .select("product:offerings!inner(id, name, pcp_registration_number, ontario_class)")
      .eq("disease_pest_id", diseaseMatch.id)
      .limit(3);

    if (linkedProducts && linkedProducts.length > 0) {
      // Only include Ontario-registered products
      const ontarioProducts = linkedProducts.filter((lp) => {
        const product = lp.product as unknown as { ontario_class: string | null };
        return product?.ontario_class;
      });

      if (ontarioProducts.length > 0) {
        const productInfo = ontarioProducts
          .map((lp) => {
            const product = lp.product as unknown as {
              name: string;
              pcp_registration_number: string | null;
            };
            return `${product.name}${product.pcp_registration_number ? ` (PCP# ${product.pcp_registration_number})` : ""}`;
          })
          .join(", ");

        nudges.push({
          rep_id: callLog.rep_id,
          company_id: callLog.company_id,
          contact_id: callLog.contact_id,
          call_log_id: callLog.id,
          nudge_type: "cross_sell",
          priority: "medium",
          title: `Treatment options for ${diseaseName}`,
          message: `${diseaseName} was mentioned. Consider recommending: ${productInfo}`,
          suggested_action: `Discuss treatment options for ${diseaseName} on next contact.`,
          due_date: null,
        });
      }
    }
  }

  // 4. Competitor mentioned → related_info
  for (const competitor of extraction.competitor_mentions) {
    if (!canAddNudge("related_info")) break;
    nudges.push({
      rep_id: callLog.rep_id,
      company_id: callLog.company_id,
      contact_id: callLog.contact_id,
      call_log_id: callLog.id,
      nudge_type: "related_info",
      priority: "medium",
      title: `Competitor mentioned: ${competitor}`,
      message: `"${competitor}" was mentioned during the call. Review competitive positioning.`,
      suggested_action: null,
      due_date: null,
    });
  }

  // 5. Disease mentioned + knowledge_base has tips → related_info
  for (const diseaseName of extraction.diseases_mentioned) {
    if (!canAddNudge("related_info")) break;
    const { data: kbEntries } = await supabase
      .from("turf_knowledge_base")
      .select("title")
      .or(`title.ilike.%${diseaseName.replace(/[%_]/g, "")}%,keywords.cs.{${diseaseName.replace(/[%_]/g, "").toLowerCase()}}`)
      .limit(1);

    if (kbEntries && kbEntries.length > 0) {
      nudges.push({
        rep_id: callLog.rep_id,
        company_id: callLog.company_id,
        contact_id: callLog.contact_id,
        call_log_id: callLog.id,
        nudge_type: "related_info",
        priority: "low",
        title: `Knowledge base: ${diseaseName}`,
        message: `Reference material available: "${kbEntries[0].title}". Share with superintendent for added value.`,
        suggested_action: null,
        due_date: null,
      });
    }
  }

  // 6. Product seasonal availability mismatch → inventory_alert
  const currentMonth = new Date().toLocaleString("en-US", { month: "long" }).toLowerCase();
  const currentSeason = getSeason(new Date().getMonth());

  for (const pr of extraction.products_requested) {
    if (!canAddNudge("inventory_alert")) break;
    const matched = matchedProducts.get(pr.product_name);
    if (!matched) continue;

    const { data: offering } = await supabase
      .from("offerings")
      .select("name, seasonal_availability, pcp_registration_number")
      .eq("id", matched.id)
      .single();

    if (
      offering?.seasonal_availability &&
      Array.isArray(offering.seasonal_availability) &&
      offering.seasonal_availability.length > 0
    ) {
      const availableLower = offering.seasonal_availability.map((s: string) => s.toLowerCase());
      if (
        !availableLower.includes(currentSeason) &&
        !availableLower.includes(currentMonth)
      ) {
        nudges.push({
          rep_id: callLog.rep_id,
          company_id: callLog.company_id,
          contact_id: callLog.contact_id,
          call_log_id: callLog.id,
          nudge_type: "inventory_alert",
          priority: "medium",
          title: `Seasonal availability: ${offering.name}`,
          message: `${offering.name}${offering.pcp_registration_number ? ` (PCP# ${offering.pcp_registration_number})` : ""} may not be available in ${currentSeason}. Available: ${offering.seasonal_availability.join(", ")}.`,
          suggested_action: "Check inventory and confirm availability with warehouse.",
          due_date: null,
        });
      }
    }
  }

  // 7. Promo check — if a mentioned/requested product has an active promotion
  const today = new Date().toISOString().split("T")[0];
  const allMentionedProductIds = new Set<string>();
  for (const pr of extraction.products_requested) {
    const m = matchedProducts.get(pr.product_name);
    if (m) allMentionedProductIds.add(m.id);
  }
  for (const name of extraction.products_mentioned) {
    const m = matchedProducts.get(name);
    if (m) allMentionedProductIds.add(m.id);
  }

  if (allMentionedProductIds.size > 0 && canAddNudge("promo_available")) {
    const { data: activePromos } = await supabase
      .from("promotions")
      .select("*, product:offerings(id, name)")
      .eq("active", true)
      .gte("end_date", today)
      .lte("start_date", today);

    if (activePromos) {
      for (const promo of activePromos) {
        if (!canAddNudge("promo_available")) break;
        // Match: promo is for a specific product that was mentioned, or promo is for all products (product_id is null)
        const isRelevant = !promo.product_id || allMentionedProductIds.has(promo.product_id);
        if (!isRelevant) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productName = (promo as any).product?.name || "Multiple products";
        const contactLabel = extraction.contact_names[0] || "the superintendent";
        const courseLabel = extraction.company_names[0] || "this course";

        // Build discount label
        let discountLabel = "";
        if (promo.discount_value != null) {
          if (promo.discount_type === "percentage") discountLabel = ` — ${promo.discount_value}% off`;
          else if (promo.discount_type === "fixed_amount") discountLabel = ` — $${promo.discount_value} off`;
          else if (promo.discount_type === "volume_pricing") discountLabel = " — volume pricing";
          else if (promo.discount_type === "bundle") discountLabel = " — bundle deal";
        }

        const minQtyNote = promo.min_quantity ? ` for orders over ${promo.min_quantity} units` : "";
        const message = `${productName} is currently${discountLabel}${minQtyNote} (ends ${promo.end_date}).${promo.description ? ` ${promo.description}` : ""} Mention this to ${contactLabel} at ${courseLabel}.`;

        nudges.push({
          rep_id: callLog.rep_id,
          company_id: callLog.company_id,
          contact_id: callLog.contact_id,
          call_log_id: callLog.id,
          nudge_type: "promo_available",
          priority: "high",
          title: `${promo.title}${discountLabel}`,
          message,
          suggested_action: `Offer the ${productName} promotion to ${contactLabel}.`,
          due_date: promo.end_date,
        });
      }
    }
  }

  // 8. Cross-rep disease intelligence — if 2+ other reps reported same disease in 72hrs
  for (const diseaseName of extraction.diseases_mentioned) {
    if (!canAddNudge("disease_alert")) break;
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data: recentMentions } = await supabase
      .from("call_log_extractions")
      .select(`
        call_log_id,
        products_mentioned,
        call_log:call_logs!inner(rep_id, company_id, rep:user_profiles(full_name), company:companies(name))
      `)
      .contains("diseases_mentioned", [diseaseName])
      .gt("created_at", cutoff)
      .neq("call_log.rep_id", callLog.rep_id)
      .limit(5);

    if (recentMentions && recentMentions.length >= 2) {
      const repDetails = recentMentions.slice(0, 3).map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cl = m.call_log as any;
        const repName = cl?.rep?.full_name || "A rep";
        const courseName = cl?.company?.name || "a course";
        const product = m.products_mentioned?.[0] || null;
        return product
          ? `${repName} at ${courseName} used ${product}`
          : `${repName} at ${courseName}`;
      });

      nudges.push({
        rep_id: callLog.rep_id,
        company_id: callLog.company_id,
        contact_id: callLog.contact_id,
        call_log_id: callLog.id,
        nudge_type: "disease_alert",
        priority: "high",
        title: `${recentMentions.length + 1} reps reported ${diseaseName} this week`,
        message: `${diseaseName} is trending in the region. ${repDetails.join(". ")}. Recommend checking with your accounts.`,
        suggested_action: `Proactively ask your accounts about ${diseaseName} conditions.`,
        due_date: null,
      });
    }
  }

  // 9. Related product suggestion — disease discussed but top product not mentioned
  for (const diseaseName of extraction.diseases_mentioned) {
    if (!canAddNudge("cross_sell")) break;
    const diseaseMatch = matchedDiseases.get(diseaseName);
    if (!diseaseMatch) continue;

    const { data: topProducts } = await supabase
      .from("product_disease_links")
      .select("product:offerings!inner(id, name, pcp_registration_number, ontario_class)")
      .eq("disease_pest_id", diseaseMatch.id)
      .eq("offerings.is_active", true)
      .not("offerings.ontario_class", "is", null)
      .limit(1);

    if (topProducts && topProducts.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topProduct = (topProducts[0] as any).product as {
        id: string;
        name: string;
        pcp_registration_number: string | null;
      };

      // Only suggest if the product wasn't already mentioned
      const alreadyMentioned = extraction.products_mentioned.some(
        (p) => p.toLowerCase() === topProduct.name.toLowerCase()
      );
      if (!alreadyMentioned && callLog.company_id) {
        // Check if this course has purchased this product this season
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const { data: purchases } = await supabase
          .from("deal_items")
          .select("id, deal:deals!inner(company_id, stage)")
          .eq("deals.company_id", callLog.company_id)
          .eq("offering_id", topProduct.id)
          .in("deals.stage", ["Paid", "Order Placed"])
          .gt("created_at", yearStart)
          .limit(1);

        if (!purchases || purchases.length === 0) {
          const courseLabel = extraction.company_names[0] || "this course";
          nudges.push({
            rep_id: callLog.rep_id,
            company_id: callLog.company_id,
            contact_id: callLog.contact_id,
            call_log_id: callLog.id,
            nudge_type: "cross_sell",
            priority: "medium",
            title: `Consider ${topProduct.name} for ${diseaseName}`,
            message: `${topProduct.name}${topProduct.pcp_registration_number ? ` (PCP# ${topProduct.pcp_registration_number})` : ""} is rated for ${diseaseName} and ${courseLabel} hasn't purchased it this season.`,
            suggested_action: `Discuss ${topProduct.name} as a treatment option for ${diseaseName}.`,
            due_date: null,
          });
        }
      }
    }
  }

  // 10. Reorders → inventory_alert
  for (const reorder of extraction.reorders) {
    if (!canAddNudge("inventory_alert")) break;
    const matched = matchedProducts.get(reorder.product_name);
    nudges.push({
      rep_id: callLog.rep_id,
      company_id: callLog.company_id,
      contact_id: callLog.contact_id,
      call_log_id: callLog.id,
      nudge_type: "inventory_alert",
      priority: reorder.needed_by ? "high" : "medium",
      title: `Reorder: ${reorder.product_name}`,
      message: `${reorder.product_name} reorder requested${reorder.quantity ? ` — ${reorder.quantity} ${reorder.unit || "units"}` : ""}${reorder.needed_by ? `. Needed by ${reorder.needed_by}` : ""}.${matched?.pcp_registration_number ? ` PCP# ${matched.pcp_registration_number}` : ""}`,
      suggested_action: "Check inventory and process reorder.",
      due_date: reorder.needed_by || null,
    });
  }

  // 11. Commitments with deadlines → action_reminder
  for (const commitment of extraction.commitments) {
    if (!canAddNudge("action_reminder")) break;
    if (commitment.owner === "customer") continue;

    const contactLabel = extraction.contact_names[0] || null;
    const courseLabel = extraction.company_names[0] || null;
    const contextSuffix = contactLabel && courseLabel
      ? ` — ${contactLabel} at ${courseLabel}`
      : contactLabel ? ` — ${contactLabel}` : courseLabel ? ` — ${courseLabel}` : "";

    nudges.push({
      rep_id: callLog.rep_id,
      company_id: callLog.company_id,
      contact_id: callLog.contact_id,
      call_log_id: callLog.id,
      nudge_type: "action_reminder",
      priority: commitment.deadline ? "high" : "medium",
      title: `You promised: ${commitment.description.slice(0, 50)}`,
      message: commitment.description + contextSuffix + (commitment.deadline ? ` (Due: ${commitment.deadline})` : ""),
      suggested_action: commitment.description,
      due_date: commitment.deadline || null,
    });
  }

  // 12. Urgent dictations → elevated priority nudge
  if (extraction.urgency_level === "emergency" && canAddNudge("action_reminder")) {
    nudges.push({
      rep_id: callLog.rep_id,
      company_id: callLog.company_id,
      contact_id: callLog.contact_id,
      call_log_id: callLog.id,
      nudge_type: "action_reminder",
      priority: "urgent",
      title: "Emergency flagged in call",
      message: `This call was flagged as emergency-level urgency. ${extraction.summary.slice(0, 200)}`,
      suggested_action: "Review and act immediately.",
      due_date: new Date().toISOString().split("T")[0],
    });
  }

  // Insert nudges
  if (nudges.length > 0) {
    await supabase.from("rep_nudges").insert(nudges);
  }

  return nudges.length;
}

// ---------------------------------------------------------------------------
// Step 4: Activity creation
// ---------------------------------------------------------------------------

async function createActivity(params: {
  callLogId: string;
  repId: string;
  companyId: string | null;
  contactId: string | null;
  rawTranscript: string;
  summary: string;
  supabase: ReturnType<typeof createServiceClient>;
}): Promise<string> {
  const { data, error } = await params.supabase
    .from("activities")
    .insert({
      type: "Phone Call",
      summary: params.rawTranscript.slice(0, 500),
      ai_summary: params.summary,
      assigned_rep_id: params.repId,
      contact_id: params.contactId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create activity: ${error?.message || "no data"}`);
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// Step 5: Demand signal generation
// ---------------------------------------------------------------------------

async function generateDemandSignals(params: {
  callLogId: string;
  repId: string;
  companyId: string | null;
  extraction: LLMExtraction;
  matchedProducts: Map<string, { id: string; pcp_registration_number: string | null }>;
  supabase: ReturnType<typeof createServiceClient>;
}): Promise<void> {
  const { callLogId, repId, companyId, extraction, matchedProducts, supabase } = params;

  // Look up rep territory for region tagging
  const { data: repProfile } = await supabase
    .from("user_profiles")
    .select("territory")
    .eq("id", repId)
    .single();
  const region = repProfile?.territory || null;

  const signals: Array<{
    product_id: string | null;
    product_name: string;
    signal_type: string;
    source_call_log_id: string;
    source_rep_id: string;
    company_id: string | null;
    quantity_mentioned: number | null;
    region: string | null;
  }> = [];

  // Products requested → "request" signal
  for (const pr of extraction.products_requested) {
    const matched = matchedProducts.get(pr.product_name);
    signals.push({
      product_id: matched?.id || null,
      product_name: pr.product_name,
      signal_type: "request",
      source_call_log_id: callLogId,
      source_rep_id: repId,
      company_id: companyId,
      quantity_mentioned: pr.quantity,
      region,
    });
  }

  // Reorders → "reorder" signal
  for (const ro of extraction.reorders) {
    const matched = matchedProducts.get(ro.product_name);
    signals.push({
      product_id: matched?.id || null,
      product_name: ro.product_name,
      signal_type: "reorder",
      source_call_log_id: callLogId,
      source_rep_id: repId,
      company_id: companyId,
      quantity_mentioned: ro.quantity,
      region,
    });
  }

  // Products mentioned (but not requested) → "inquiry" signal
  for (const name of extraction.products_mentioned) {
    // Skip if already covered by a request or reorder
    const alreadySignaled = signals.some(
      (s) => s.product_name.toLowerCase() === name.toLowerCase(),
    );
    if (alreadySignaled) continue;
    const matched = matchedProducts.get(name);
    signals.push({
      product_id: matched?.id || null,
      product_name: name,
      signal_type: "inquiry",
      source_call_log_id: callLogId,
      source_rep_id: repId,
      company_id: companyId,
      quantity_mentioned: null,
      region,
    });
  }

  if (signals.length > 0) {
    await supabase.from("demand_signals").insert(signals);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determinePriority(extraction: LLMExtraction): NudgePriority {
  if (extraction.sentiment === "urgent") return "urgent";

  if (extraction.follow_up_date) {
    const followUpDate = new Date(extraction.follow_up_date);
    const now = new Date();
    const diffDays = (followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) return "high";
  }

  return "medium";
}

function getSeason(month: number): string {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "concerned", "urgent"];

function validateSentiment(value: string): Sentiment {
  if (VALID_SENTIMENTS.includes(value as Sentiment)) return value as Sentiment;
  return "neutral";
}

const VALID_ACTION_ITEM_TYPES = [
  "send_quote", "schedule_visit", "send_sample",
  "follow_up_call", "check_inventory", "order_product", "other",
] as const;

function validateActionItemType(value: string): (typeof VALID_ACTION_ITEM_TYPES)[number] {
  if ((VALID_ACTION_ITEM_TYPES as readonly string[]).includes(value)) {
    return value as (typeof VALID_ACTION_ITEM_TYPES)[number];
  }
  return "other";
}

const VALID_NUDGE_PRIORITIES: NudgePriority[] = ["low", "medium", "high", "urgent"];

function validateNudgePriority(value: string | null | undefined): NudgePriority | null {
  if (value && VALID_NUDGE_PRIORITIES.includes(value as NudgePriority)) {
    return value as NudgePriority;
  }
  return null;
}

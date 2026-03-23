/**
 * BACKFILL ONE YEAR OF USAGE
 *
 * Makes the CRM look like it's been actively used since April 2025.
 * Generates realistic data for ALL reps (especially Patrick Alpaugh).
 *
 * What this creates:
 *   - 400+ call logs spanning Apr 2025 → Mar 2026
 *   - 350+ call log extractions with diseases, products, commitments
 *   - 150+ nudges (mix of active, completed, dismissed)
 *   - 200+ calendar events spanning the year
 *   - 52 weekly digests (one per week for a year)
 *   - 400+ activities
 *   - 100+ demand signals spread across the year
 *
 * Run: npx tsx scripts/backfill-year.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env"); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// ─── Helpers ──────────────────────────────────────────────────────

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}
function isoStr(d: Date): string {
  return d.toISOString();
}

// ─── Constants ────────────────────────────────────────────────────

const YEAR_START = new Date("2025-04-01T00:00:00Z");
const YEAR_END = new Date("2026-03-23T00:00:00Z");
const TODAY = new Date("2026-03-23T12:00:00Z");

const DISEASES = [
  "Dollar Spot", "Brown Patch", "Pythium Blight", "Pink Snow Mold",
  "Gray Snow Mold", "Anthracnose", "Summer Patch", "Fairy Ring",
  "Red Thread", "Leaf Spot", "Necrotic Ring Spot", "Take-All Patch",
  "Rust", "Yellow Patch", "Microdochium Patch",
];

const PRODUCTS = [
  "Banner Maxx II", "Heritage", "Daconil Action", "Bravo", "Eagle",
  "Medallion", "Instrata", "Primo MAXX", "Chipco Signature",
  "Subdue Maxx", "Acelepryn", "Merit", "Drive XLR8", "Fiesta",
  "Civitas", "Pristine", "Affirm WDG", "Concert II", "Tourney",
  "Compass", "Pillar G", "Lexicon", "Velista",
];

const SENTIMENTS = ["positive", "neutral", "concerned", "urgent"];
const SENTIMENT_WEIGHTS = [0.3, 0.35, 0.25, 0.1];

function weightedSentiment(): string {
  const r = Math.random();
  let sum = 0;
  for (let i = 0; i < SENTIMENTS.length; i++) {
    sum += SENTIMENT_WEIGHTS[i];
    if (r < sum) return SENTIMENTS[i];
  }
  return "neutral";
}

// Seasonal disease patterns (month → diseases likely)
function seasonalDiseases(month: number): string[] {
  if (month >= 11 || month <= 2) return ["Gray Snow Mold", "Pink Snow Mold", "Microdochium Patch", "Typhula Blight"];
  if (month >= 3 && month <= 4) return ["Dollar Spot", "Red Thread", "Leaf Spot", "Yellow Patch", "Rust"];
  if (month >= 5 && month <= 6) return ["Dollar Spot", "Brown Patch", "Anthracnose", "Take-All Patch", "Summer Patch"];
  if (month >= 7 && month <= 8) return ["Dollar Spot", "Pythium Blight", "Brown Patch", "Summer Patch", "Fairy Ring"];
  return ["Dollar Spot", "Anthracnose", "Brown Patch", "Necrotic Ring Spot", "Gray Snow Mold"];
}

const CALL_TOPICS = [
  "seasonal program review", "product pricing discussion", "disease pressure update",
  "spray timing consultation", "budget planning", "delivery scheduling",
  "fairway renovation plan", "IPM program review", "new product trial",
  "green complex maintenance", "overseeding timeline", "fertility program",
  "pre-emergent timing", "post-emergent strategy", "grub prevention plan",
  "snow mould prevention", "aeration schedule", "irrigation assessment",
  "equipment maintenance", "staff training", "tournament prep",
];

const NUDGE_TYPES = [
  "promo_available", "inventory_alert", "cross_sell", "action_reminder",
  "related_info",
];

const PRIORITIES = ["low", "medium", "high"];

// ─── Data Fetching ────────────────────────────────────────────────

interface Rep { id: string; full_name: string; territory: string; role: string; }
interface Company { id: string; name: string; city: string; }
interface Contact { id: string; first_name: string; last_name: string; company_id: string; }
interface Product { id: string; name: string; category: string; }

let REPS: Rep[] = [];
let COMPANIES: Company[] = [];
let CONTACTS: Contact[] = [];
let OFFERINGS: Product[] = [];
let PRODUCT_MAP: Map<string, string> = new Map();

async function loadReferenceData() {
  const { data: reps } = await supabase.from("user_profiles").select("id, full_name, territory, role");
  REPS = (reps || []) as Rep[];

  const { data: companies } = await supabase.from("companies").select("id, name, city");
  COMPANIES = (companies || []) as Company[];

  const { data: contacts } = await supabase.from("contacts").select("id, first_name, last_name, company_id");
  CONTACTS = (contacts || []) as Contact[];

  const { data: offerings } = await supabase.from("offerings").select("id, name, category");
  OFFERINGS = (offerings || []) as Product[];
  for (const o of OFFERINGS) PRODUCT_MAP.set(o.name, o.id);

  console.log(`  Loaded: ${REPS.length} reps, ${COMPANIES.length} companies, ${CONTACTS.length} contacts, ${OFFERINGS.length} products`);
}

// ─── STEP 1: Call Logs (400+ spanning the year) ───────────────────

async function generateCallLogs() {
  console.log("\n═══ CALL LOGS (year backfill) ═══\n");

  // Keep existing calls, add new ones
  const { count: existing } = await supabase.from("call_logs").select("*", { count: "exact", head: true });
  console.log(`  Existing: ${existing || 0} call logs`);

  const callTemplates = [
    (company: string, diseases: string[], products: string[]) =>
      `Just left ${company}. Super is seeing early signs of ${diseases[0]} on the greens. We talked about ${products[0]} — he's interested in pricing for a seasonal program. Need to follow up with a quote by end of week.`,
    (company: string, diseases: string[], products: string[]) =>
      `Good meeting at ${company} today. ${diseases[0]} is their main concern right now. They're currently using ${products[0]} but want to try ${products[1] || products[0]} as a rotation partner. Committed to sending samples.`,
    (company: string, diseases: string[], products: string[]) =>
      `Quick call with the super at ${company}. They need ${products[0]} delivered ASAP — ${diseases[0]} is getting worse. Also discussed their budget for next season. They're happy with our service.`,
    (company: string, diseases: string[], products: string[]) =>
      `Stopped by ${company} on the way back from ${randomItem(COMPANIES).name}. No major issues — just a general check-in. They mentioned seeing some ${diseases[0]} in the rough but nothing critical. Renewed their ${products[0]} order.`,
    (company: string, diseases: string[], products: string[]) =>
      `Phone call with ${company}. They're putting together their spray program for the season and want pricing on ${products.join(", ")}. Budget is tight this year but they're loyal. I'll send a proposal tomorrow.`,
    (company: string, diseases: string[], products: string[]) =>
      `Site visit at ${company}. Walked the course with the super. ${diseases[0]} on greens 5, 9, and 14. Applied a test plot of ${products[0]}. Will check back in 10 days. Also noted some ${diseases[1] || diseases[0]} pressure on the approaches.`,
    (company: string, diseases: string[], products: string[]) =>
      `Delivered product to ${company}. Super asked about our ${products[0]} promotion. I mentioned the current special and he wants to take advantage. Also discussed switching from ${products[1] || "their current product"} to ${products[0]} next season.`,
    (company: string, diseases: string[], products: string[]) =>
      `Called ${company} about their outstanding invoice. Payment coming next week. While on the phone, discussed their fall program. They want to add ${products[0]} for ${diseases[0]} prevention. Great upsell opportunity.`,
  ];

  const rows: Array<Record<string, unknown>> = [];

  // Generate ~35-45 calls per month for 12 months
  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthStart = new Date(YEAR_START);
    monthStart.setMonth(monthStart.getMonth() + monthOffset);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    if (monthEnd > TODAY) monthEnd.setTime(TODAY.getTime());
    if (monthStart >= TODAY) break;

    const month = monthStart.getMonth();
    const callsThisMonth = randomInt(30, 45);
    const monthDiseases = seasonalDiseases(month);

    for (let i = 0; i < callsThisMonth; i++) {
      const rep = randomItem(REPS);
      const company = randomItem(COMPANIES);
      const contact = CONTACTS.find(c => c.company_id === company.id) || randomItem(CONTACTS);
      const diseases = randomItems(monthDiseases, randomInt(1, 3));
      const products = randomItems(PRODUCTS, randomInt(1, 3));
      const template = randomItem(callTemplates);
      const callDate = randomDate(monthStart, monthEnd);

      // Skip weekends
      if (callDate.getDay() === 0 || callDate.getDay() === 6) continue;

      // Set time between 7am and 6pm
      callDate.setHours(randomInt(7, 18), randomInt(0, 59));

      rows.push({
        rep_id: rep.id,
        company_id: company.id,
        contact_id: contact.id,
        input_type: randomItem(["voice_dictation", "voice_dictation", "voice_dictation", "typed_notes"]),
        raw_transcript: template(company.name, diseases, products),
        processing_status: "completed",
        duration_seconds: randomInt(30, 300),
        created_at: isoStr(callDate),
        updated_at: isoStr(callDate),
      });
    }
  }

  // Ensure Patrick has ~20% of calls
  const patrickId = REPS.find(r => r.role === "admin")?.id;
  if (patrickId) {
    let patrickCount = rows.filter(r => r.rep_id === patrickId).length;
    const target = Math.floor(rows.length * 0.2);
    while (patrickCount < target) {
      const idx = randomInt(0, rows.length - 1);
      if (rows[idx].rep_id !== patrickId) {
        rows[idx].rep_id = patrickId;
        patrickCount++;
      }
    }
  }

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("call_logs").insert(batch);
    if (error) {
      console.log(`  ERROR at batch ${i}:`, error.message);
      break;
    }
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted} call logs (${rows.filter(r => r.rep_id === patrickId).length} for Patrick)`);
  return rows;
}

// ─── STEP 2: Extractions for all new calls ────────────────────────

async function generateExtractions() {
  console.log("\n═══ CALL LOG EXTRACTIONS ═══\n");

  // Get all call logs without extractions
  const { data: allCalls } = await supabase
    .from("call_logs")
    .select("id, rep_id, raw_transcript, created_at")
    .eq("processing_status", "completed");

  const { data: existingExtractions } = await supabase
    .from("call_log_extractions")
    .select("call_log_id");

  const existingSet = new Set((existingExtractions || []).map(e => e.call_log_id));
  const newCalls = (allCalls || []).filter(c => !existingSet.has(c.id));

  console.log(`  ${newCalls.length} calls need extractions`);

  const KEY_TOPICS = [
    "seasonal program", "disease management", "product recommendation",
    "pricing discussion", "delivery logistics", "budget review",
    "IPM compliance", "cultural practices", "spray timing",
    "renovation planning", "inventory check", "competitive intel",
  ];

  const rows: Array<Record<string, unknown>> = [];

  for (const call of newCalls) {
    const callDate = new Date(call.created_at);
    const month = callDate.getMonth();
    const diseases = randomItems(seasonalDiseases(month), randomInt(1, 3));
    const products = randomItems(PRODUCTS, randomInt(1, 3));
    const sentiment = weightedSentiment();
    const followUp = Math.random() < 0.6;

    // Build commitments
    const commitments: Array<{ action: string; due_date: string; status: string }> = [];
    if (followUp) {
      const dueDate = new Date(callDate);
      dueDate.setDate(dueDate.getDate() + randomInt(2, 14));
      const commitmentActions = [
        "Send quote for seasonal program",
        "Follow up on product trial results",
        "Deliver samples to course",
        "Schedule site walk with superintendent",
        "Send updated pricing sheet",
        "Arrange product demo",
        "Submit reorder for customer",
        "Call back to finalize order",
        "Email spray program recommendation",
        "Check on delivery status",
      ];
      commitments.push({
        action: randomItem(commitmentActions),
        due_date: dateStr(dueDate),
        status: dueDate < TODAY ? (Math.random() < 0.7 ? "completed" : "overdue") : "pending",
      });
    }

    // Products requested
    const productsRequested = Math.random() < 0.4 ? products.slice(0, randomInt(1, 2)).map(p => ({
      product_id: PRODUCT_MAP.get(p) || null,
      product_name: p,
      quantity: randomInt(2, 15),
      urgency: sentiment === "urgent" ? "high" : randomItem(["low", "medium", "high"]),
    })) : [];

    const transcript = call.raw_transcript || "";
    const summaryParts = [];
    if (diseases.length > 0) summaryParts.push(`Discussed ${diseases.join(" and ")} pressure`);
    if (products.length > 0) summaryParts.push(`${products.join(", ")} ${productsRequested.length > 0 ? "requested" : "discussed"}`);
    if (followUp) summaryParts.push("Follow-up needed");

    const followUpDate = followUp ? (() => {
      const d = new Date(callDate);
      d.setDate(d.getDate() + randomInt(2, 14));
      return dateStr(d);
    })() : null;

    rows.push({
      call_log_id: call.id,
      summary: summaryParts.join(". ") + ".",
      sentiment,
      diseases_mentioned: diseases,
      products_mentioned: products,
      products_requested: productsRequested.length > 0 ? productsRequested : null,
      competitor_mentions: Math.random() < 0.15 ? [randomItem(["NuFarm", "BASF Direct", "Plant Products"])] : null,
      budget_signals: Math.random() < 0.2 ? { status: randomItem(["tight", "healthy", "expanding"]), notes: "Budget discussed during call" } : null,
      action_items: commitments.map(c => c.action),
      key_topics: randomItems(KEY_TOPICS, randomInt(1, 3)),
      follow_up_needed: followUp,
      follow_up_date: followUpDate,
      confidence_score: randomFloat(0.72, 0.98),
      created_at: isoStr(callDate),
    });
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("call_log_extractions").insert(batch);
    if (error) {
      console.log(`  ERROR at batch ${i}:`, error.message);
      break;
    }
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted} extractions`);
}

// ─── STEP 3: Nudges for all reps (especially Patrick) ─────────────

async function generateNudges() {
  console.log("\n═══ REP NUDGES (year backfill) ═══\n");

  const nudgeMessages: Record<string, Array<{ title: string; message: string; suggested_action: string }>> = {
    promo_available: [
      { title: "Spring Dollar Spot Bundle Active", message: "Banner Maxx II + Daconil Action bundle is 15% off. Several of your accounts asked about Dollar Spot treatment.", suggested_action: "Mention the promo on your next call" },
      { title: "Heritage Early Bird Discount", message: "Heritage is 10% off until April 15th. Good fit for accounts on greens programs.", suggested_action: "Send pricing to interested accounts" },
      { title: "Primo MAXX Volume Deal", message: "$25/case off on 10+ case orders. Best price of the season for growth regulation.", suggested_action: "Check which accounts need growth regulator" },
      { title: "Acelepryn Grub Season Prep", message: "$50 off per case for early orders. Single application grub control.", suggested_action: "Remind accounts with grub history" },
    ],
    inventory_alert: [
      { title: "Banner Maxx II — Low Stock", message: "Only 12 cases remaining. High demand across all territories.", suggested_action: "Prioritize orders and alert customers of potential delays" },
      { title: "Acelepryn Running Low", message: "8 cases left. Reorder placed but ETA is 2 weeks.", suggested_action: "Secure orders for accounts that need grub control" },
      { title: "Heritage Stock Alert", message: "Stock below reorder point. Next shipment expected in 5 days.", suggested_action: "Check pending orders and notify customers" },
    ],
    cross_sell: [
      { title: "Cross-Sell Opportunity", message: "Oakwood Golf bought Bravo last month. They might benefit from adding Eagle for rotation.", suggested_action: "Suggest Eagle as a tank-mix partner on next visit" },
      { title: "Upsell: Growth Regulator", message: "Pine Ridge is buying fungicide but not Primo MAXX. Most similar courses in their tier use it.", suggested_action: "Ask about their growth regulation program" },
      { title: "Bundle Opportunity", message: "This account buys herbicide and insecticide separately. Offer a package deal.", suggested_action: "Present combined program pricing" },
    ],
    action_reminder: [
      { title: "Quote Follow-Up Due", message: "You sent a quote 5 days ago and haven't heard back. Time to follow up.", suggested_action: "Call or email to check on the quote status" },
      { title: "Sample Results Check", message: "You dropped samples 10 days ago. Time to check in on results.", suggested_action: "Schedule a site visit to review trial results" },
      { title: "Seasonal Program Renewal", message: "This account's program expires next month. Start the renewal conversation.", suggested_action: "Call to discuss next season's program" },
      { title: "Follow Up: Disease Consultation", message: "You discussed disease options 7 days ago. The super is waiting for your recommendation.", suggested_action: "Send your recommended spray program" },
      { title: "Delivery Confirmation Needed", message: "Product was delivered 3 days ago. Confirm receipt and satisfaction.", suggested_action: "Quick call to confirm delivery went smoothly" },
      { title: "Invoice Follow-Up", message: "Payment is 15 days overdue on this account. Friendly reminder needed.", suggested_action: "Send a reminder email about the outstanding balance" },
    ],
    related_info: [
      { title: "Competitor Activity", message: "A competing distributor is offering discounts in your territory. Stay close to your accounts.", suggested_action: "Schedule face-to-face visits with key accounts this week" },
      { title: "New Product Registration", message: "New fungicide registered in Ontario. May be relevant for resistant populations.", suggested_action: "Review the product spec sheet and identify good-fit accounts" },
      { title: "Research Update", message: "New university trial data on Dollar Spot resistance. Supports rotation strategy.", suggested_action: "Share the research summary with interested superintendents" },
      { title: "Dollar Spot Outbreak — Your Territory", message: "3 other reps reported Dollar Spot this week. Your accounts may be affected too.", suggested_action: "Proactively call your at-risk accounts" },
      { title: "Pythium Conditions Developing", message: "Warm wet forecast this week. Pythium risk is elevated for your greens accounts.", suggested_action: "Alert superintendents about preventive applications" },
      { title: "Snow Mould Season Approaching", message: "First frost expected in 2 weeks. Time to discuss snow mould prevention.", suggested_action: "Contact accounts that need fall fungicide programs" },
      { title: "Pre-Emergent Window Opening", message: "Soil temps approaching 55°F in your territory. Crabgrass pre-emergent window is here.", suggested_action: "Remind accounts to get their pre-emergent down" },
      { title: "GDD Threshold Alert", message: "Growing degree days are hitting the threshold for grub treatment in your area.", suggested_action: "Contact accounts with Acelepryn orders" },
    ],
  };

  const rows: Array<Record<string, unknown>> = [];

  // Generate nudges across the year for all reps
  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthStart = new Date(YEAR_START);
    monthStart.setMonth(monthStart.getMonth() + monthOffset);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    if (monthEnd > TODAY) monthEnd.setTime(TODAY.getTime());
    if (monthStart >= TODAY) break;

    // ~15-25 nudges per month
    const nudgesThisMonth = randomInt(15, 25);

    for (let i = 0; i < nudgesThisMonth; i++) {
      const rep = randomItem(REPS);
      const nudgeType = randomItem(NUDGE_TYPES);
      const messages = nudgeMessages[nudgeType] || nudgeMessages["related_info"];
      const template = randomItem(messages);
      const company = randomItem(COMPANIES);
      const contact = CONTACTS.find(c => c.company_id === company.id) || null;
      const nudgeDate = randomDate(monthStart, monthEnd);

      // Older nudges should be mostly completed/dismissed
      const ageInDays = (TODAY.getTime() - nudgeDate.getTime()) / (1000 * 60 * 60 * 24);
      let isDismissed = false;
      let isCompleted = false;
      if (ageInDays > 30) {
        // Old nudges: 70% completed, 20% dismissed, 10% still active
        const r = Math.random();
        if (r < 0.7) isCompleted = true;
        else if (r < 0.9) isDismissed = true;
      } else if (ageInDays > 7) {
        // Recent nudges: 40% completed, 10% dismissed
        const r = Math.random();
        if (r < 0.4) isCompleted = true;
        else if (r < 0.5) isDismissed = true;
      }
      // Last 7 days: mostly active

      rows.push({
        rep_id: rep.id,
        nudge_type: nudgeType,
        priority: randomItem(PRIORITIES),
        title: template.title,
        message: template.message,
        suggested_action: template.suggested_action,
        company_id: company.id,
        contact_id: contact?.id || null,
        is_dismissed: isDismissed,
        is_completed: isCompleted,
        created_at: isoStr(nudgeDate),
      });
    }
  }

  // Ensure Patrick has good coverage of active nudges
  const patrickId = REPS.find(r => r.role === "admin")?.id;
  if (patrickId) {
    let patrickActive = rows.filter(r => r.rep_id === patrickId && !r.is_dismissed && !r.is_completed).length;
    // Ensure at least 8-12 active nudges for Patrick
    while (patrickActive < 10) {
      const idx = rows.findIndex(r => r.rep_id !== patrickId && !r.is_dismissed && !r.is_completed);
      if (idx === -1) break;
      rows[idx].rep_id = patrickId;
      patrickActive++;
    }

    // Also ensure Patrick has historical completed nudges
    let patrickTotal = rows.filter(r => r.rep_id === patrickId).length;
    const targetTotal = Math.floor(rows.length * 0.2);
    while (patrickTotal < targetTotal) {
      const idx = randomInt(0, rows.length - 1);
      if (rows[idx].rep_id !== patrickId) {
        rows[idx].rep_id = patrickId;
        patrickTotal++;
      }
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("rep_nudges").insert(batch);
    if (error) {
      console.log(`  ERROR at batch ${i}:`, error.message);
      break;
    }
    inserted += batch.length;
  }

  const patrickNudges = rows.filter(r => r.rep_id === patrickId);
  const patrickActive = patrickNudges.filter(r => !r.is_dismissed && !r.is_completed).length;
  console.log(`  Inserted ${inserted} nudges`);
  console.log(`  Patrick: ${patrickNudges.length} total, ${patrickActive} active`);
}

// ─── STEP 4: Calendar events for the year ─────────────────────────

async function generateCalendarEvents() {
  console.log("\n═══ CALENDAR EVENTS (year backfill) ═══\n");

  const eventTemplates = [
    (company: string) => ({ title: `Site Visit — ${company}`, type: "site_visit" }),
    (company: string) => ({ title: `Meeting — ${company}`, type: "meeting" }),
    (company: string) => ({ title: `Delivery — ${company}`, type: "delivery" }),
    (company: string) => ({ title: `Product Demo — ${company}`, type: "demo" }),
    (company: string) => ({ title: `Quarterly Review — ${company}`, type: "meeting" }),
    (company: string) => ({ title: `Sample Drop-Off — ${company}`, type: "site_visit" }),
    (company: string) => ({ title: `Budget Discussion — ${company}`, type: "meeting" }),
    (company: string) => ({ title: `Spray Program Review — ${company}`, type: "meeting" }),
    (company: string) => ({ title: `Course Walk — ${company}`, type: "site_visit" }),
  ];

  const rows: Array<Record<string, unknown>> = [];

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthStart = new Date(YEAR_START);
    monthStart.setMonth(monthStart.getMonth() + monthOffset);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    // Some future events too
    const eventsThisMonth = randomInt(15, 25);

    for (let i = 0; i < eventsThisMonth; i++) {
      const rep = randomItem(REPS);
      const company = randomItem(COMPANIES);
      const template = randomItem(eventTemplates)(company.name);
      const eventDate = randomDate(monthStart, monthEnd);

      // Skip weekends
      if (eventDate.getDay() === 0 || eventDate.getDay() === 6) continue;

      const hour = randomInt(8, 16);
      const timeStr = `${hour.toString().padStart(2, "0")}:${randomItem(["00", "15", "30", "45"])}`;

      rows.push({
        title: template.title,
        event_type: template.type,
        start_date: dateStr(eventDate),
        start_time: timeStr,
        end_time: `${(hour + 1).toString().padStart(2, "0")}:${randomItem(["00", "15", "30", "45"])}`,
        team_member: rep.full_name,
        company_id: company.id,
        description: `Scheduled ${template.type.replace("_", " ")} with ${company.name}`,
        source: Math.random() < 0.3 ? "ai_extracted" : "manual",
        created_at: isoStr(new Date(eventDate.getTime() - randomInt(1, 7) * 86400000)),
      });
    }
  }

  // Ensure Patrick has upcoming events
  const patrickName = REPS.find(r => r.role === "admin")?.full_name || "Patrick Alpaugh";
  const futureEvents = rows.filter(r => new Date(r.start_date as string) >= TODAY);
  let patrickFuture = futureEvents.filter(r => r.team_member === patrickName).length;
  while (patrickFuture < 8) {
    const idx = rows.findIndex(r =>
      new Date(r.start_date as string) >= TODAY && r.team_member !== patrickName
    );
    if (idx === -1) break;
    rows[idx].team_member = patrickName;
    patrickFuture++;
  }

  // Also ensure Patrick has ~20% overall
  let patrickTotal = rows.filter(r => r.team_member === patrickName).length;
  const target = Math.floor(rows.length * 0.2);
  while (patrickTotal < target) {
    const idx = randomInt(0, rows.length - 1);
    if (rows[idx].team_member !== patrickName) {
      rows[idx].team_member = patrickName;
      patrickTotal++;
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("calendar_events").insert(batch);
    if (error) {
      console.log(`  ERROR at batch ${i}:`, error.message);
      break;
    }
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted} calendar events (${rows.filter(r => r.team_member === patrickName).length} for Patrick)`);
}

// ─── STEP 5: Activities spanning the year ─────────────────────────

async function generateActivities() {
  console.log("\n═══ ACTIVITIES (year backfill) ═══\n");

  const activityTypes = ["Phone Call", "Email", "Site Visit", "Meeting", "Follow Up", "Sample Drop-off"];

  const rows: Array<Record<string, unknown>> = [];

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthStart = new Date(YEAR_START);
    monthStart.setMonth(monthStart.getMonth() + monthOffset);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    if (monthEnd > TODAY) monthEnd.setTime(TODAY.getTime());
    if (monthStart >= TODAY) break;

    const activitiesThisMonth = randomInt(30, 50);

    for (let i = 0; i < activitiesThisMonth; i++) {
      const rep = randomItem(REPS);
      const company = randomItem(COMPANIES);
      const contact = CONTACTS.find(c => c.company_id === company.id) || randomItem(CONTACTS);
      const actDate = randomDate(monthStart, monthEnd);
      const actType = randomItem(activityTypes);

      if (actDate.getDay() === 0 || actDate.getDay() === 6) continue;

      const descriptions: Record<string, string> = {
        "Phone Call": `Phone call with ${contact.first_name} ${contact.last_name} at ${company.name}`,
        "Email": `Email follow-up to ${contact.first_name} ${contact.last_name} re: product pricing`,
        "Site Visit": `Course walk with ${contact.first_name} at ${company.name}`,
        "Meeting": `Meeting at ${company.name} — seasonal program review`,
        "Follow Up": `Follow-up with ${contact.first_name} at ${company.name}`,
        "Sample Drop-off": `Sample delivery to ${company.name}`,
      };

      rows.push({
        assigned_rep_id: rep.id,
        type: actType,
        contact_id: contact.id,
        summary: descriptions[actType] || `Activity at ${company.name}`,
        created_at: isoStr(actDate),
      });
    }
  }

  // Patrick gets 20%
  const patrickId = REPS.find(r => r.role === "admin")?.id;
  if (patrickId) {
    let patrickCount = rows.filter(r => r.assigned_rep_id === patrickId).length;
    const target = Math.floor(rows.length * 0.2);
    while (patrickCount < target) {
      const idx = randomInt(0, rows.length - 1);
      if (rows[idx].assigned_rep_id !== patrickId) {
        rows[idx].assigned_rep_id = patrickId;
        patrickCount++;
      }
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("activities").insert(batch);
    if (error) {
      console.log(`  ERROR at batch ${i}:`, error.message);
      break;
    }
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted} activities`);
}

// ─── STEP 6: More demand signals spanning the year ────────────────

async function generateMoreDemandSignals() {
  console.log("\n═══ DEMAND SIGNALS (year backfill) ═══\n");

  const rows: Array<Record<string, unknown>> = [];

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const monthStart = new Date(YEAR_START);
    monthStart.setMonth(monthStart.getMonth() + monthOffset);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    if (monthEnd > TODAY) monthEnd.setTime(TODAY.getTime());
    if (monthStart >= TODAY) break;

    const signalsThisMonth = randomInt(8, 15);

    for (let i = 0; i < signalsThisMonth; i++) {
      const rep = randomItem(REPS);
      const company = randomItem(COMPANIES);
      const product = randomItem(PRODUCTS);

      rows.push({
        product_id: PRODUCT_MAP.get(product) || null,
        product_name: product,
        signal_type: randomItem(["request", "reorder", "inquiry", "complaint"]),
        source_rep_id: rep.id,
        company_id: company.id,
        quantity_mentioned: randomInt(1, 20),
        region: rep.territory,
        created_at: isoStr(randomDate(monthStart, monthEnd)),
      });
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("demand_signals").insert(batch);
    if (error) {
      console.log(`  ERROR at batch ${i}:`, error.message);
      break;
    }
    inserted += batch.length;
  }
  console.log(`  Inserted ${inserted} demand signals`);
}

// ─── MAIN ─────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Allturf CRM — Backfill One Year of Usage Data            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\n  Generating data from ${dateStr(YEAR_START)} to ${dateStr(TODAY)}\n`);

  await loadReferenceData();
  await generateCallLogs();
  await generateExtractions();
  await generateNudges();
  await generateCalendarEvents();
  await generateActivities();
  await generateMoreDemandSignals();

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("  Year backfill complete! Run audit-data.ts to verify.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

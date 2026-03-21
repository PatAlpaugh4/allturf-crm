/**
 * Allturf CRM — Demo Data Verification Script
 *
 * Checks the database for expected demo data and prints a detailed report.
 * Run with: npx tsx scripts/verify-demo-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Status = "PASS" | "WARN" | "FAIL";

function check(label: string, count: number, min: number, max: number): Status {
  const status: Status = count >= min && count <= max ? "PASS" : count > 0 ? "WARN" : "FAIL";
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "⚠" : "✗";
  const range = max === Infinity ? `≥${min}` : `${min}-${max}`;
  console.log(`  ${icon} ${label.padEnd(35)} ${String(count).padStart(6)}  (expected ${range})`);
  return status;
}

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          Allturf CRM — Demo Data Verification              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  let passes = 0;
  let warnings = 0;
  let failures = 0;

  function tally(s: Status) {
    if (s === "PASS") passes++;
    else if (s === "WARN") warnings++;
    else failures++;
  }

  // ---- 1. Table Row Counts ----
  console.log("─── Table Row Counts ───────────────────────────────────────────\n");

  const tables: [string, string, number, number][] = [
    ["companies", "Companies", 40, 200],
    ["golf_course_profiles", "Golf Course Profiles", 30, 150],
    ["contacts", "Contacts", 30, 200],
    ["offerings", "Products/Offerings", 20, 150],
    ["product_disease_links", "Product-Disease Links", 50, 500],
    ["user_profiles", "Sales Reps (user_profiles)", 5, 10],
    ["deals", "Deals", 50, 200],
    ["deal_items", "Deal Items", 100, 800],
    ["activities", "Activities", 150, 400],
    ["calendar_events", "Calendar Events", 20, 60],
    ["visit_reports", "Visit Reports", 30, 80],
    ["visit_observations", "Visit Observations", 60, 300],
    ["visit_recommendations", "Visit Recommendations", 30, 200],
    ["projects", "Treatment Programs", 10, 30],
    ["project_tasks", "Program Tasks", 40, 200],
    ["call_logs", "Call Logs", 80, 150],
    ["call_log_extractions", "Call Log Extractions", 70, 150],
    ["rep_nudges", "Rep Nudges", 15, 40],
    ["field_trend_signals", "Field Trend Signals", 3, 6],
    ["daily_digests", "Daily Digests", 5, 10],
    ["weather_snapshots", "Weather Snapshots", 500, 2000],
    ["turf_knowledge_base", "Knowledge Base Entries", 80, 120],
  ];

  for (const [table, label, min, max] of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ✗ ${label.padEnd(35)} ERROR: ${error.message}`);
      failures++;
    } else {
      tally(check(label, count || 0, min, max));
    }
  }

  // ---- 2. Sales Reps ----
  console.log("\n─── Sales Reps ────────────────────────────────────────────────\n");

  const { data: reps } = await supabase.from("user_profiles").select("id, full_name, territory").order("territory");
  if (reps && reps.length > 0) {
    for (const r of reps) {
      console.log(`  • ${(r.full_name || "Unknown").padEnd(20)} ${r.territory || "No territory"}`);
    }
    tally(check("Reps with territory", reps.filter((r) => r.territory).length, 5, 10));
  } else {
    console.log("  ✗ No sales reps found");
    failures++;
  }

  // ---- 3. Dollar Spot Trend Verification ----
  console.log("\n─── Dollar Spot Trend (Mar 14-20, 2026) ───────────────────────\n");

  const { data: dollarSpotLogs } = await supabase
    .from("call_logs")
    .select("id, raw_transcript, created_at")
    .gte("created_at", "2026-03-14T00:00:00")
    .lte("created_at", "2026-03-20T23:59:59")
    .ilike("raw_transcript", "%dollar spot%");

  const dsCount = dollarSpotLogs?.length || 0;
  tally(check("Dollar Spot calls (last 7 days)", dsCount, 8, 15));

  // Check distinct reps
  const { data: dsRepCalls } = await supabase
    .from("call_logs")
    .select("rep_id")
    .gte("created_at", "2026-03-14T00:00:00")
    .lte("created_at", "2026-03-20T23:59:59")
    .ilike("raw_transcript", "%dollar spot%");

  const distinctDsReps = new Set(dsRepCalls?.map((r) => r.rep_id).filter(Boolean));
  tally(check("Distinct reps reporting DS", distinctDsReps.size, 3, 5));

  // ---- 4. Banner Maxx Demand Spike ----
  console.log("\n─── Banner Maxx Demand Spike ───────────────────────────────────\n");

  const { data: bannerMaxxLogs } = await supabase
    .from("call_logs")
    .select("id")
    .gte("created_at", "2026-03-14T00:00:00")
    .lte("created_at", "2026-03-20T23:59:59")
    .ilike("raw_transcript", "%banner maxx%");

  tally(check("Banner Maxx calls (last 7 days)", bannerMaxxLogs?.length || 0, 4, 12));

  // ---- 5. Field Trend Signals ----
  console.log("\n─── Field Trend Signals ────────────────────────────────────────\n");

  const { data: trends } = await supabase.from("field_trend_signals").select("title, signal_type, severity, contributing_call_ids, is_active");
  if (trends) {
    for (const t of trends) {
      const callCount = Array.isArray(t.contributing_call_ids) ? t.contributing_call_ids.length : 0;
      console.log(`  • [${t.severity.toUpperCase().padEnd(8)}] ${t.title}`);
      console.log(`    Type: ${t.signal_type} | Contributing calls: ${callCount} | Active: ${t.is_active}`);
    }

    // Verify contributing_call_ids point to real call logs
    const dsSignal = trends.find((t) => t.signal_type === "disease_outbreak");
    if (dsSignal && Array.isArray(dsSignal.contributing_call_ids) && dsSignal.contributing_call_ids.length > 0) {
      const { count } = await supabase
        .from("call_logs")
        .select("*", { count: "exact", head: true })
        .in("id", dsSignal.contributing_call_ids);
      const validCount = count || 0;
      const totalRefs = dsSignal.contributing_call_ids.length;
      tally(check("DS signal → valid call log FKs", validCount, totalRefs, totalRefs));
    }
  }

  // ---- 6. Daily Digests ----
  console.log("\n─── Daily Digests ──────────────────────────────────────────────\n");

  const { data: digests } = await supabase
    .from("daily_digests")
    .select("digest_date, total_calls_logged, total_follow_ups_needed")
    .order("digest_date");

  if (digests && digests.length > 0) {
    for (const d of digests) {
      console.log(`  • ${d.digest_date}  calls: ${String(d.total_calls_logged).padStart(3)}  follow-ups: ${d.total_follow_ups_needed}`);
    }
    // Check consecutive dates
    const dates = digests.map((d) => d.digest_date);
    let consecutive = true;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays !== 1) { consecutive = false; break; }
    }
    tally(check("Consecutive digest dates", consecutive ? digests.length : 0, 5, 10));
  } else {
    console.log("  ✗ No daily digests found");
    failures++;
  }

  // ---- 7. Weather Snapshots & GDD ----
  console.log("\n─── Weather Snapshots & GDD ────────────────────────────────────\n");

  const { data: weatherCourses } = await supabase
    .from("weather_snapshots")
    .select("company_id")
    .limit(1000);

  const distinctWeatherCourses = new Set(weatherCourses?.map((w) => w.company_id));
  tally(check("Courses with weather data", distinctWeatherCourses.size, 10, 15));

  // Verify GDD accumulation for one course
  if (distinctWeatherCourses.size > 0) {
    const sampleCourseId = Array.from(distinctWeatherCourses)[0];
    const { data: wxRows } = await supabase
      .from("weather_snapshots")
      .select("snapshot_date, temp_avg_c, gdd_daily, gdd_cumulative, gdd_base_temp_c, is_spray_window, wind_avg_kmh, rainfall_mm, temp_high_c")
      .eq("company_id", sampleCourseId)
      .gte("snapshot_date", "2026-01-01")
      .order("snapshot_date");

    if (wxRows && wxRows.length > 0) {
      // Verify GDD math: gdd_daily should equal max(0, temp_avg - 10)
      let gddMathCorrect = true;
      let cumulativeCorrect = true;
      let runningSum = 0;

      for (const wx of wxRows) {
        const expectedDaily = Math.max(0, Number(wx.temp_avg_c) - Number(wx.gdd_base_temp_c));
        const actualDaily = Number(wx.gdd_daily);
        // Allow small floating point tolerance
        if (Math.abs(expectedDaily - actualDaily) > 0.2) {
          gddMathCorrect = false;
          break;
        }
        runningSum += actualDaily;
        if (Math.abs(runningSum - Number(wx.gdd_cumulative)) > 0.5) {
          cumulativeCorrect = false;
          break;
        }
      }

      tally(check("GDD daily formula correct", gddMathCorrect ? 1 : 0, 1, 1));
      tally(check("GDD cumulative running sum", cumulativeCorrect ? 1 : 0, 1, 1));

      // Check spray window logic
      let sprayWindowCorrect = true;
      for (const wx of wxRows) {
        const wind = Number(wx.wind_avg_kmh);
        const rain = Number(wx.rainfall_mm);
        const temp = Number(wx.temp_high_c);
        const expectedSpray = wind < 15 && rain === 0 && temp > 5;
        if (wx.is_spray_window !== expectedSpray) {
          sprayWindowCorrect = false;
          break;
        }
      }
      tally(check("is_spray_window logic correct", sprayWindowCorrect ? 1 : 0, 1, 1));

      // Check realistic temperature ranges
      const janRows = wxRows.filter((w) => w.snapshot_date.startsWith("2026-01"));
      const marRows = wxRows.filter((w) => w.snapshot_date.startsWith("2026-03"));

      if (janRows.length > 0) {
        const janAvgHigh = janRows.reduce((sum, w) => sum + Number(w.temp_high_c), 0) / janRows.length;
        // January avg high should be roughly -7 to 2°C
        tally(check("Jan avg high realistic (°C)", Math.round(janAvgHigh * 10) / 10, -10, 3));
      }
      if (marRows.length > 0) {
        const marAvgHigh = marRows.reduce((sum, w) => sum + Number(w.temp_high_c), 0) / marRows.length;
        // March avg high should be roughly 0 to 12°C
        tally(check("Mar avg high realistic (°C)", Math.round(marAvgHigh * 10) / 10, -2, 14));
      }

      // Display sample weather
      console.log(`\n  Sample weather (course ${sampleCourseId.slice(0, 8)}...):`);
      const sampleDays = wxRows.slice(-5);
      for (const wx of sampleDays) {
        console.log(`    ${wx.snapshot_date}  H:${String(wx.temp_high_c).padStart(5)}°C  GDD:${String(wx.gdd_daily).padStart(4)}  Cum:${String(wx.gdd_cumulative).padStart(6)}  Spray:${wx.is_spray_window ? "yes" : "no "}`);
      }
    }
  }

  // ---- 8. Knowledge Base ----
  console.log("\n─── Knowledge Base ─────────────────────────────────────────────\n");

  const { data: kbEntries } = await supabase
    .from("turf_knowledge_base")
    .select("category, source");

  if (kbEntries) {
    // Count by category
    const catCounts = new Map<string, number>();
    for (const e of kbEntries) {
      catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1);
    }
    for (const [cat, count] of Array.from(catCounts.entries()).sort()) {
      console.log(`  • ${cat.padEnd(20)} ${count} entries`);
    }

    // Count entries with source citations
    const withSource = kbEntries.filter((e) => e.source && e.source.length > 0).length;
    tally(check("Entries with source citations", withSource, kbEntries.length - 5, kbEntries.length));

    // Check for GTI fact sheet entries
    const gtiEntries = kbEntries.filter((e) => e.source && e.source.toLowerCase().includes("gti"));
    tally(check("GTI Fact Sheet entries", gtiEntries.length, 5, 30));

    // Check for OMAFRA entries
    const omafraEntries = kbEntries.filter((e) => e.source && e.source.toLowerCase().includes("omafra"));
    tally(check("OMAFRA Pub 845 entries", omafraEntries.length, 10, 40));

    // Check for pesticide data entries
    const pestEntries = kbEntries.filter((e) => e.source && e.source.toLowerCase().includes("pesticide data"));
    tally(check("Pesticide Data entries", pestEntries.length, 5, 25));
  }

  // ---- 9. Foreign Key Integrity ----
  console.log("\n─── Foreign Key Integrity ──────────────────────────────────────\n");

  // Call logs → valid rep_id
  const { data: clRepCheck } = await supabase
    .from("call_logs")
    .select("id, rep_id")
    .not("rep_id", "is", null);
  if (clRepCheck && clRepCheck.length > 0) {
    const repIds = new Set(reps?.map((r) => r.id) || []);
    const validRefs = clRepCheck.filter((cl) => repIds.has(cl.rep_id)).length;
    tally(check("Call logs → valid rep_id", validRefs, clRepCheck.length, clRepCheck.length));
  }

  // Call log extractions → valid call_log_id
  const { data: exCallCheck } = await supabase.from("call_log_extractions").select("call_log_id");
  if (exCallCheck && exCallCheck.length > 0) {
    const callLogIdSet = new Set<string>();
    const { data: allCls } = await supabase.from("call_logs").select("id");
    if (allCls) for (const cl of allCls) callLogIdSet.add(cl.id);
    const validExRefs = exCallCheck.filter((e) => callLogIdSet.has(e.call_log_id)).length;
    tally(check("Extractions → valid call_log_id", validExRefs, exCallCheck.length, exCallCheck.length));
  }

  // Rep nudges → valid rep_id
  const { data: nudgeRepCheck } = await supabase
    .from("rep_nudges")
    .select("id, rep_id")
    .not("rep_id", "is", null);
  if (nudgeRepCheck && nudgeRepCheck.length > 0) {
    const repIds = new Set(reps?.map((r) => r.id) || []);
    const validNudgeRefs = nudgeRepCheck.filter((n) => repIds.has(n.rep_id)).length;
    tally(check("Nudges → valid rep_id", validNudgeRefs, nudgeRepCheck.length, nudgeRepCheck.length));
  }

  // ---- 10. Call Log Extractions Quality ----
  console.log("\n─── Extraction Quality ─────────────────────────────────────────\n");

  const { data: extractions } = await supabase
    .from("call_log_extractions")
    .select("sentiment, follow_up_needed, confidence_score, diseases_mentioned, products_mentioned, key_topics");

  if (extractions && extractions.length > 0) {
    const sentCounts = new Map<string, number>();
    let followUpCount = 0;
    let withDiseases = 0;
    let withProducts = 0;
    let withTopics = 0;
    let confTotal = 0;

    for (const e of extractions) {
      sentCounts.set(e.sentiment || "null", (sentCounts.get(e.sentiment || "null") || 0) + 1);
      if (e.follow_up_needed) followUpCount++;
      if (e.diseases_mentioned && e.diseases_mentioned.length > 0) withDiseases++;
      if (e.products_mentioned && e.products_mentioned.length > 0) withProducts++;
      if (e.key_topics && e.key_topics.length > 0) withTopics++;
      confTotal += Number(e.confidence_score || 0);
    }

    console.log("  Sentiment distribution:");
    for (const [s, c] of Array.from(sentCounts.entries()).sort((a, b) => b[1] - a[1])) {
      const pct = ((c / extractions.length) * 100).toFixed(0);
      console.log(`    ${s.padEnd(12)} ${String(c).padStart(4)} (${pct}%)`);
    }

    const followUpPct = Math.round((followUpCount / extractions.length) * 100);
    tally(check("Follow-up needed rate (%)", followUpPct, 40, 80));
    tally(check("Extractions with diseases", withDiseases, Math.floor(extractions.length * 0.5), extractions.length));
    tally(check("Extractions with products", withProducts, Math.floor(extractions.length * 0.5), extractions.length));
    tally(check("Extractions with key_topics", withTopics, Math.floor(extractions.length * 0.7), extractions.length));

    const avgConf = confTotal / extractions.length;
    console.log(`  Avg confidence score: ${avgConf.toFixed(2)}`);
  }

  // ---- Summary ----
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log(`\n  PASS: ${passes}  |  WARN: ${warnings}  |  FAIL: ${failures}\n`);

  if (failures > 0) {
    console.log("  Some checks failed. Run the import script first:");
    console.log("    npx tsx scripts/import-demo-data.ts\n");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("  All critical checks passed with some warnings.\n");
  } else {
    console.log("  All checks passed! Demo data looks good.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

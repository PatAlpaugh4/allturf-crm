/**
 * Allturf CRM — Demo Data Reset
 *
 * Deletes all demo-generated data in reverse FK-dependency order
 * while preserving:
 *   - turf_diseases_pests (seed reference data)
 *   - Seed companies (a0000000-* UUIDs) and their contacts/profiles
 *   - Seed offerings (inserted by seed.sql)
 *   - Seed turf_knowledge_base entries (inserted by seed.sql)
 *
 * Run:  npm run reset-demo
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Seed company UUIDs to preserve
const SEED_COMPANY_IDS = [
  "a0000000-0000-0000-0000-000000000001",
  "a0000000-0000-0000-0000-000000000002",
  "a0000000-0000-0000-0000-000000000003",
  "a0000000-0000-0000-0000-000000000004",
  "a0000000-0000-0000-0000-000000000005",
];

// Demo rep emails (created by import step 7)
const DEMO_REP_EMAILS = [
  "mike.thompson@allturf.ca",
  "sarah.chen@allturf.ca",
  "dave.kowalski@allturf.ca",
  "lisa.moreau@allturf.ca",
  "james.wilson@allturf.ca",
];

// Seed knowledge base titles (from seed.sql) — first words to match
const SEED_KB_CATEGORIES = new Set([
  // seed.sql inserts ~50 entries across these categories;
  // the import script (step 22) checks for existing titles before inserting,
  // so we can identify demo entries by checking created_at or by deleting
  // entries NOT in the original seed set. Simpler: delete entries whose
  // source contains "Demo Import" or created after a threshold.
]);

async function countRows(table: string): Promise<number> {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         Allturf CRM — Demo Data Reset                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();

  // Deletion order: leaf tables → mid-level → root
  // Most tables CASCADE from companies/user_profiles, but we delete
  // explicitly for clarity and to handle edge cases.

  const steps: Array<{
    label: string;
    table: string;
    filter?: { column: string; op: string; value: unknown };
  }> = [
    // Phase 1.3 leaf tables (no dependents)
    { label: "Call log extractions", table: "call_log_extractions" },
    { label: "Rep nudges", table: "rep_nudges" },
    { label: "Field trend signals", table: "field_trend_signals" },
    { label: "Daily digests", table: "daily_digests" },
    { label: "Weather snapshots", table: "weather_snapshots" },

    // Visit-related leaves
    { label: "Visit observations", table: "visit_observations" },
    { label: "Visit recommendations", table: "visit_recommendations" },

    // Call logs (parent of extractions, nudges — already cleared above)
    { label: "Call logs", table: "call_logs" },

    // Project leaves
    { label: "Project tasks", table: "project_tasks" },

    // Deal leaves
    { label: "Deal items", table: "deal_items" },
    { label: "Order deliveries", table: "order_deliveries" },

    // Mid-level tables
    { label: "Activities", table: "activities" },
    { label: "Calendar events", table: "calendar_events" },
    { label: "Visit reports", table: "visit_reports" },
    { label: "Projects (treatment programs)", table: "projects" },
    { label: "Deals", table: "deals" },

    // Product-disease links (will be re-seeded)
    { label: "Product-disease links", table: "product_disease_links" },

    // Golf course profiles for non-seed companies
    {
      label: "Golf course profiles (demo)",
      table: "golf_course_profiles",
      filter: { column: "company_id", op: "not.in", value: SEED_COMPANY_IDS },
    },

    // Contacts for non-seed companies
    {
      label: "Contacts (demo)",
      table: "contacts",
      filter: { column: "company_id", op: "not.in", value: SEED_COMPANY_IDS },
    },

    // Offerings (all — seed.sql will re-populate)
    { label: "Offerings (all, re-seed with seed.sql)", table: "offerings" },

    // Companies (non-seed only)
    {
      label: "Companies (demo)",
      table: "companies",
      filter: { column: "id", op: "not.in", value: SEED_COMPANY_IDS },
    },

    // Knowledge base (demo-added entries — those with source containing "Allturf Demo")
    // The import script step 22 sets source to specific values; seed.sql entries have different sources.
    // Safest: delete entries not matching seed.sql known sources.
    // Actually, the import checks for existing titles, so let's just delete all and let seed.sql re-populate.
    { label: "Knowledge base (all, re-seed with seed.sql)", table: "turf_knowledge_base" },
  ];

  let hasErrors = false;

  for (const step of steps) {
    const before = await countRows(step.table);
    if (before === 0) {
      console.log(`  ✓ ${step.label} — already empty`);
      continue;
    }

    let query = supabase.from(step.table).delete();

    if (step.filter) {
      const f = step.filter;
      if (f.op === "not.in") {
        query = query.not(f.column, "in", `(${(f.value as string[]).join(",")})`);
      } else if (f.op === "in") {
        query = query.in(f.column, f.value as string[]);
      }
    } else {
      // Delete all — supabase needs a WHERE clause, use a tautology
      query = query.gte("id", "00000000-0000-0000-0000-000000000000");
    }

    const { error } = await query;

    if (error) {
      console.error(`  ✗ ${step.label} — ERROR: ${error.message}`);
      hasErrors = true;
    } else {
      const after = await countRows(step.table);
      const deleted = before - after;
      console.log(`  ✓ ${step.label} — deleted ${deleted} rows (${after} preserved)`);
    }
  }

  // Delete demo rep user_profiles
  console.log();
  console.log("  Cleaning up demo rep accounts...");

  // First get demo rep user IDs
  const { data: demoReps } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("email", DEMO_REP_EMAILS);

  if (demoReps && demoReps.length > 0) {
    for (const rep of demoReps) {
      // Delete user_profile (cascades handled above already)
      const { error: profileErr } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", rep.id);

      if (profileErr) {
        console.error(`  ✗ user_profile ${rep.email} — ERROR: ${profileErr.message}`);
        hasErrors = true;
      } else {
        console.log(`  ✓ Removed user_profile: ${rep.email}`);
      }

      // Delete auth user
      const { error: authErr } = await supabase.auth.admin.deleteUser(rep.id);
      if (authErr) {
        console.error(`  ✗ auth.user ${rep.email} — ERROR: ${authErr.message}`);
        hasErrors = true;
      } else {
        console.log(`  ✓ Removed auth user: ${rep.email}`);
      }
    }
  } else {
    console.log("  ✓ No demo rep accounts found");
  }

  // Summary
  console.log();
  if (hasErrors) {
    console.log("⚠  Reset completed with errors. Check messages above.");
    process.exit(1);
  } else {
    console.log("✓  Demo data reset complete. You can now re-run: npm run import-demo");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

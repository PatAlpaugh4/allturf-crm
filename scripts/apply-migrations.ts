/**
 * Apply pending Supabase migrations that haven't been run.
 * Uses the service role key to execute raw SQL via supabase.rpc or REST.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function tableExists(tableName: string): Promise<boolean> {
  const { count } = await supabase.from(tableName).select("*", { count: "exact", head: true });
  // If we get an error about table not found, it doesn't exist
  return count !== null;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const { data, error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

async function runSQL(sql: string, label: string) {
  // Use the Supabase Management API via REST to run SQL
  // Since we can't use supabase.rpc for DDL, we'll use the pg REST endpoint
  const pgUrl = url!.replace("supabase.co", "supabase.co") + "/rest/v1/rpc/";

  // Try using the built-in SQL execution
  const response = await fetch(url + "/rest/v1/rpc/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key!,
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  // If that doesn't work, we'll need to use the SQL editor endpoint
  if (!response.ok) {
    console.log(`  ⚠ Cannot run DDL via REST API for: ${label}`);
    console.log(`  → Please run this SQL in the Supabase Dashboard SQL Editor:`);
    console.log(`  → ${url?.replace('.supabase.co', '.supabase.co')}/project/default/sql`);
    return false;
  }
  return true;
}

async function main() {
  console.log("Checking which migrations need to be applied...\n");

  const migrations = [
    { file: "add_inventory_tables.sql", check: () => tableExists("inventory"), label: "Inventory + Demand Signals tables" },
    { file: "add_promotions_table.sql", check: () => tableExists("promotions"), label: "Promotions table" },
    { file: "add_offering_promo_fields.sql", check: () => columnExists("offerings", "promo_message"), label: "Offering promo fields" },
    { file: "add_calendar_event_source.sql", check: () => columnExists("calendar_events", "source"), label: "Calendar event source" },
    { file: "add_call_extraction_fields.sql", check: () => columnExists("call_log_extractions", "products_requested"), label: "Call extraction fields" },
    { file: "fix_calendar_event_types.sql", check: async () => true, label: "Calendar event type fixes" }, // idempotent
  ];

  const pending: string[] = [];

  for (const m of migrations) {
    const exists = await m.check();
    const status = exists ? "✓ Already applied" : "✗ NEEDS APPLYING";
    console.log(`  ${status}: ${m.label} (${m.file})`);
    if (!exists) {
      pending.push(m.file);
    }
  }

  if (pending.length === 0) {
    console.log("\n  All migrations already applied!");
    return;
  }

  console.log(`\n${pending.length} migration(s) need to be applied.`);
  console.log("\nPlease run the following SQL files in your Supabase Dashboard SQL Editor:\n");

  const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    console.log(`\n══════ ${file} ══════`);
    console.log(sql);
    console.log("══════════════════════════════════════════════════\n");
  }
}

main().catch(console.error);

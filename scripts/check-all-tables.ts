import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env"); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const tables = [
  "companies","golf_course_profiles","contacts","offerings","turf_diseases_pests",
  "product_disease_links","user_profiles","deals","deal_items","activities",
  "calendar_events","visit_reports","visit_observations","visit_recommendations",
  "projects","project_tasks","call_logs","call_log_extractions","rep_nudges",
  "field_trend_signals","daily_digests","weather_snapshots","turf_knowledge_base",
  "inventory","demand_signals","promotions","order_deliveries"
];

async function main() {
  console.log("TABLE".padEnd(30) + "ROWS");
  console.log("─".repeat(40));
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) console.log(t.padEnd(30) + "ERROR: " + error.message);
    else console.log(t.padEnd(30) + (count || 0));
  }
}
main();

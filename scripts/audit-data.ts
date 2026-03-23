import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env"); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: reps } = await supabase.from("user_profiles").select("id, full_name, role");
  const repNames = new Map<string, string>();
  for (const r of reps || []) repNames.set(r.id, `${r.full_name} (${r.role})`);

  // Nudges by rep
  const { data: nudges } = await supabase.from("rep_nudges").select("rep_id, nudge_type, is_dismissed, is_completed, created_at");
  console.log("=== NUDGES BY REP ===");
  const byRep = new Map<string, { total: number; active: number; types: Set<string> }>();
  for (const n of nudges || []) {
    const repId = n.rep_id || "null";
    if (!byRep.has(repId)) byRep.set(repId, { total: 0, active: 0, types: new Set() });
    const r = byRep.get(repId)!;
    r.total++;
    if (!n.is_dismissed && !n.is_completed) r.active++;
    r.types.add(n.nudge_type);
  }
  for (const [id, counts] of byRep) {
    console.log(`  ${(repNames.get(id) || id.slice(0, 8)).padEnd(35)} total: ${counts.total}  active: ${counts.active}  types: ${[...counts.types].join(", ")}`);
  }

  // Calls by rep
  console.log("\n=== CALLS BY REP ===");
  const { data: calls } = await supabase.from("call_logs").select("rep_id, created_at");
  const callsByRep = new Map<string, number>();
  for (const c of calls || []) {
    const repId = c.rep_id || "null";
    callsByRep.set(repId, (callsByRep.get(repId) || 0) + 1);
  }
  for (const [id, count] of callsByRep) {
    console.log(`  ${(repNames.get(id) || id.slice(0, 8)).padEnd(35)} ${count} calls`);
  }

  // Date range of calls
  if (calls && calls.length > 0) {
    const dates = calls.map(c => new Date(c.created_at).getTime());
    console.log(`\n  Call date range: ${new Date(Math.min(...dates)).toISOString().split("T")[0]} to ${new Date(Math.max(...dates)).toISOString().split("T")[0]}`);
  }

  // Digests date range
  const { data: digests } = await supabase.from("daily_digests").select("digest_date").order("digest_date");
  if (digests && digests.length > 0) {
    console.log(`\n=== DIGESTS ===`);
    console.log(`  ${digests.length} digests: ${digests[0].digest_date} to ${digests[digests.length - 1].digest_date}`);
  }

  // Weather date range
  const { data: wx } = await supabase.from("weather_snapshots").select("snapshot_date").order("snapshot_date").limit(1);
  const { data: wx2 } = await supabase.from("weather_snapshots").select("snapshot_date").order("snapshot_date", { ascending: false }).limit(1);
  if (wx && wx2) {
    console.log(`\n=== WEATHER ===`);
    console.log(`  Range: ${wx[0]?.snapshot_date} to ${wx2[0]?.snapshot_date}`);
  }

  // Activities
  const { data: activities } = await supabase.from("activities").select("user_id, activity_type, created_at");
  const actByRep = new Map<string, number>();
  for (const a of activities || []) {
    const id = a.user_id || "null";
    actByRep.set(id, (actByRep.get(id) || 0) + 1);
  }
  console.log("\n=== ACTIVITIES BY REP ===");
  for (const [id, count] of actByRep) {
    console.log(`  ${(repNames.get(id) || id.slice(0, 8)).padEnd(35)} ${count}`);
  }

  // Patrick specifically
  const patrickId = "c79981d6-9442-43f2-93ae-1a1705223d25";
  console.log("\n=== PATRICK ALPAUGH SUMMARY ===");
  console.log(`  Calls: ${callsByRep.get(patrickId) || 0}`);
  console.log(`  Nudges: ${byRep.get(patrickId)?.total || 0} (active: ${byRep.get(patrickId)?.active || 0})`);
  console.log(`  Activities: ${actByRep.get(patrickId) || 0}`);
}

main().catch(console.error);

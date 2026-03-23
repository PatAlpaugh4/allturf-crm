/**
 * Populate ALL remaining empty tables for demo:
 *   1. inventory (stock levels for all 57 products)
 *   2. demand_signals (from call_log_extractions)
 *   3. promotions (active spring specials)
 *   4. order_deliveries (for shipped/delivered/invoiced/paid deals)
 *   5. turf_diseases_pests enrichment (add more diseases/pests/weeds)
 *
 * Run: npx tsx scripts/populate-remaining.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

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

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ─────────────────────────────────────────────────────────────
// 1. INVENTORY — stock levels for all products
// ─────────────────────────────────────────────────────────────
async function populateInventory() {
  console.log("\n═══ INVENTORY ═══\n");

  const { count } = await supabase.from("inventory").select("*", { count: "exact", head: true });
  if ((count || 0) > 0) {
    console.log(`  Already has ${count} rows, skipping.`);
    return;
  }

  const { data: offerings } = await supabase.from("offerings").select("id, name, category");
  if (!offerings || offerings.length === 0) {
    console.log("  No offerings found!");
    return;
  }

  const { data: reps } = await supabase.from("user_profiles").select("id").limit(1);
  const adminId = reps?.[0]?.id;

  // Define stock profiles by category
  const stockProfiles: Record<string, { onHand: [number, number]; committed: [number, number]; onOrder: [number, number]; reorder: [number, number] }> = {
    Fungicide: { onHand: [20, 200], committed: [5, 60], onOrder: [0, 80], reorder: [30, 80] },
    Herbicide: { onHand: [15, 150], committed: [3, 40], onOrder: [0, 50], reorder: [20, 60] },
    Insecticide: { onHand: [10, 120], committed: [2, 30], onOrder: [0, 40], reorder: [15, 50] },
    "Growth Regulator": { onHand: [30, 250], committed: [10, 80], onOrder: [0, 100], reorder: [40, 100] },
  };

  const defaultProfile = { onHand: [10, 100], committed: [2, 25], onOrder: [0, 30], reorder: [15, 40] };

  // Make some products deliberately low stock for alerts
  const lowStockProducts = new Set(["Banner Maxx II", "Daconil Action", "Heritage", "Acelepryn", "Merit"]);

  const inventoryRows = offerings.map((o) => {
    const profile = stockProfiles[o.category] || defaultProfile;
    const isLow = lowStockProducts.has(o.name);

    const onHand = isLow
      ? randomInt(2, 15) // below reorder
      : randomInt(profile.onHand[0], profile.onHand[1]);
    const committed = randomInt(profile.committed[0], profile.committed[1]);
    const onOrder = isLow ? randomInt(20, 60) : randomInt(profile.onOrder[0], profile.onOrder[1]);
    const reorder = randomInt(profile.reorder[0], profile.reorder[1]);

    return {
      product_id: o.id,
      quantity_on_hand: onHand,
      quantity_committed: committed,
      quantity_on_order: onOrder,
      reorder_point: reorder,
      updated_by: adminId,
      notes: isLow ? "High demand — reorder expedited" : null,
      last_updated_at: new Date(Date.now() - randomInt(0, 7) * 86400000).toISOString(),
    };
  });

  const { error } = await supabase.from("inventory").insert(inventoryRows);
  if (error) {
    console.log("  ERROR:", error.message);
  } else {
    const lowCount = inventoryRows.filter((r) => r.quantity_on_hand <= r.reorder_point).length;
    console.log(`  Inserted ${inventoryRows.length} inventory records (${lowCount} below reorder point)`);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. DEMAND SIGNALS — from call log extractions
// ─────────────────────────────────────────────────────────────
async function populateDemandSignals() {
  console.log("\n═══ DEMAND SIGNALS ═══\n");

  const { count } = await supabase.from("demand_signals").select("*", { count: "exact", head: true });
  if ((count || 0) > 0) {
    console.log(`  Already has ${count} rows, skipping.`);
    return;
  }

  // Get extractions that have products_requested
  const { data: extractions } = await supabase
    .from("call_log_extractions")
    .select("call_log_id, products_requested, products_mentioned, extracted_reorders");

  // Get call logs for rep/company mapping
  const { data: callLogs } = await supabase.from("call_logs").select("id, rep_id, company_id");
  const callMap = new Map<string, { rep_id: string; company_id: string }>();
  for (const cl of callLogs || []) {
    if (cl.rep_id && cl.company_id) callMap.set(cl.id, { rep_id: cl.rep_id, company_id: cl.company_id });
  }

  // Get rep territories for region field
  const { data: reps } = await supabase.from("user_profiles").select("id, territory");
  const repTerritoryMap = new Map<string, string>();
  for (const r of reps || []) repTerritoryMap.set(r.id, r.territory || "Ontario");

  const signals: Array<Record<string, unknown>> = [];

  for (const ext of extractions || []) {
    const callInfo = callMap.get(ext.call_log_id);
    if (!callInfo) continue;

    // Products requested → demand signals
    if (Array.isArray(ext.products_requested)) {
      for (const pr of ext.products_requested as Array<{ product_id?: string; product_name: string; urgency?: string; quantity?: number }>) {
        signals.push({
          product_id: pr.product_id || null,
          product_name: pr.product_name,
          signal_type: pr.urgency === "high" ? "request" : "inquiry",
          source_call_log_id: ext.call_log_id,
          source_rep_id: callInfo.rep_id,
          company_id: callInfo.company_id,
          quantity_mentioned: pr.quantity || null,
          region: repTerritoryMap.get(callInfo.rep_id) || "Ontario",
          created_at: new Date(Date.now() - randomInt(0, 7 * 86400) * 1000).toISOString(),
        });
      }
    }

    // Reorders → demand signals
    if (Array.isArray(ext.extracted_reorders)) {
      for (const ro of ext.extracted_reorders as Array<{ product_name: string; quantity?: number }>) {
        signals.push({
          product_name: ro.product_name,
          signal_type: "reorder",
          source_call_log_id: ext.call_log_id,
          source_rep_id: callInfo.rep_id,
          company_id: callInfo.company_id,
          quantity_mentioned: ro.quantity || null,
          region: repTerritoryMap.get(callInfo.rep_id) || "Ontario",
          created_at: new Date(Date.now() - randomInt(0, 7 * 86400) * 1000).toISOString(),
        });
      }
    }
  }

  // Also add some organic demand signals for popular products not in extractions
  const popularProducts = [
    { name: "Primo MAXX", type: "inquiry" },
    { name: "Bravo", type: "request" },
    { name: "Eagle", type: "inquiry" },
    { name: "Medallion", type: "request" },
    { name: "Instrata", type: "inquiry" },
    { name: "Chipco Signature", type: "request" },
    { name: "Drive XLR8", type: "inquiry" },
    { name: "Fiesta", type: "request" },
    { name: "Subdue Maxx", type: "request" },
    { name: "Acelepryn", type: "reorder" },
  ];

  const repList = reps || [];
  const { data: companies } = await supabase.from("companies").select("id").limit(80);
  const companyList = companies || [];

  if (companyList.length === 0 || repList.length === 0) {
    console.log("  Skipping organic signals — no companies or reps found");
  } else {
    for (const pp of popularProducts) {
      const count = randomInt(2, 5);
      for (let i = 0; i < count; i++) {
        const rep = randomItem(repList);
        const company = randomItem(companyList);
      signals.push({
        product_name: pp.name,
        signal_type: pp.type,
        source_rep_id: rep.id,
        company_id: company.id,
        quantity_mentioned: randomInt(2, 20),
        region: rep.territory || "Ontario",
        created_at: new Date(Date.now() - randomInt(0, 10 * 86400) * 1000).toISOString(),
      });
    }
  }
  } // end else (companyList/repList check)

  if (signals.length > 0) {
    // Insert in batches
    for (let i = 0; i < signals.length; i += 50) {
      const batch = signals.slice(i, i + 50);
      const { error } = await supabase.from("demand_signals").insert(batch);
      if (error) {
        console.log(`  ERROR batch ${i}:`, error.message);
        break;
      }
    }
    console.log(`  Inserted ${signals.length} demand signals`);
  } else {
    console.log("  No demand signals to create");
  }
}

// ─────────────────────────────────────────────────────────────
// 3. PROMOTIONS — active spring 2026 specials
// ─────────────────────────────────────────────────────────────
async function populatePromotions() {
  console.log("\n═══ PROMOTIONS ═══\n");

  const { count } = await supabase.from("promotions").select("*", { count: "exact", head: true });
  if ((count || 0) > 0) {
    console.log(`  Already has ${count} rows, skipping.`);
    return;
  }

  const { data: reps } = await supabase.from("user_profiles").select("id, role");
  const adminId = reps?.find((r) => r.role === "admin")?.id || reps?.[0]?.id;

  // Get product IDs for specific promos
  const { data: offerings } = await supabase.from("offerings").select("id, name");
  const productMap = new Map<string, string>();
  for (const o of offerings || []) productMap.set(o.name, o.id);

  const promotions = [
    {
      title: "Spring Dollar Spot Defense Bundle",
      description: "Buy Banner Maxx II + Daconil Action together and save 15%. Perfect for early-season Dollar Spot prevention. Mix partner discount applied at checkout.",
      product_id: productMap.get("Banner Maxx II") || null,
      discount_type: "percentage",
      discount_value: 15,
      min_quantity: 4,
      start_date: "2026-03-01",
      end_date: "2026-04-30",
    },
    {
      title: "Heritage Early Bird — 10% Off",
      description: "Order Heritage before April 15th and get 10% off. Broad-spectrum protection for greens and fairways. Minimum 6-case order.",
      product_id: productMap.get("Heritage") || null,
      discount_type: "percentage",
      discount_value: 10,
      min_quantity: 6,
      start_date: "2026-03-01",
      end_date: "2026-04-15",
    },
    {
      title: "Primo MAXX Volume Pricing",
      description: "Buy 10+ cases of Primo MAXX and save $25/case. Ontario's most popular growth regulator at the best price of the season.",
      product_id: productMap.get("Primo MAXX") || null,
      discount_type: "fixed_amount",
      discount_value: 25,
      min_quantity: 10,
      start_date: "2026-03-15",
      end_date: "2026-05-31",
    },
    {
      title: "Grub Season Prep — Acelepryn Deal",
      description: "Stock up early for grub season. Acelepryn at $50 off per case when you order 3+ cases before May 1st. Single application controls white grubs all season.",
      product_id: productMap.get("Acelepryn") || null,
      discount_type: "fixed_amount",
      discount_value: 50,
      min_quantity: 3,
      start_date: "2026-03-01",
      end_date: "2026-05-01",
    },
    {
      title: "Weed Control Spring Bundle",
      description: "Fiesta + Drive XLR8 combo pack. Buy both and get 12% off total order. IPM-compliant broadleaf + crabgrass control for the season.",
      product_id: productMap.get("Fiesta") || null,
      discount_type: "percentage",
      discount_value: 12,
      min_quantity: 2,
      start_date: "2026-03-15",
      end_date: "2026-04-30",
    },
    {
      title: "Instrata Season Kickoff",
      description: "Multi-site fungicide at 8% off for orders placed in March. Excellent tank-mix partner for resistance management programs.",
      product_id: productMap.get("Instrata") || null,
      discount_type: "percentage",
      discount_value: 8,
      min_quantity: 4,
      start_date: "2026-03-01",
      end_date: "2026-03-31",
    },
    {
      title: "Snow Mould Prevention — Chipco 26019 Clearance",
      description: "Limited stock of Chipco 26019 at 20% off. Fall/early winter application for snow mould prevention. First come, first served.",
      product_id: productMap.get("Chipco 26019") || null,
      discount_type: "percentage",
      discount_value: 20,
      min_quantity: 2,
      start_date: "2026-03-01",
      end_date: "2026-04-15",
    },
    {
      title: "Eagle Season Pass",
      description: "Commit to 8+ cases of Eagle for the full season and lock in 2025 pricing. DMI fungicide for anthracnose and dollar spot.",
      product_id: productMap.get("Eagle") || null,
      discount_type: "volume_pricing",
      discount_value: null,
      min_quantity: 8,
      start_date: "2026-03-01",
      end_date: "2026-06-30",
    },
    {
      title: "Subdue Maxx — Pythium Protection",
      description: "Buy 5+ cases of Subdue Maxx and save $30/case. Essential for Pythium prevention on greens during warm, humid weather.",
      product_id: productMap.get("Subdue Maxx") || null,
      discount_type: "fixed_amount",
      discount_value: 30,
      min_quantity: 5,
      start_date: "2026-04-01",
      end_date: "2026-06-30",
    },
    {
      title: "New Customer Welcome — 5% Off First Order",
      description: "New Allturf customers get 5% off their entire first order. No minimum quantity. Welcome to the Allturf family!",
      product_id: null,
      discount_type: "percentage",
      discount_value: 5,
      min_quantity: null,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
    },
  ];

  const rows = promotions.map((p) => ({
    ...p,
    active: true,
    created_by: adminId,
  }));

  const { error } = await supabase.from("promotions").insert(rows);
  if (error) {
    console.log("  ERROR:", error.message);
  } else {
    console.log(`  Inserted ${rows.length} promotions`);
  }
}

// ─────────────────────────────────────────────────────────────
// 4. ORDER DELIVERIES — for shipped/delivered/invoiced/paid deals
// ─────────────────────────────────────────────────────────────
async function populateOrderDeliveries() {
  console.log("\n═══ ORDER DELIVERIES ═══\n");

  const { count } = await supabase.from("order_deliveries").select("*", { count: "exact", head: true });
  if ((count || 0) > 0) {
    console.log(`  Already has ${count} rows, skipping.`);
    return;
  }

  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, stage, expected_delivery_date, actual_delivery_date, company_id");

  const deliverableStages = ["Shipped", "Delivered", "Invoiced", "Paid"];
  const deliverableDeals = (deals || []).filter((d) => deliverableStages.includes(d.stage));

  if (deliverableDeals.length === 0) {
    console.log("  No deliverable deals found!");
    return;
  }

  const receivers = [
    "Front gate — left with grounds crew",
    "Maintenance shop — signed by superintendent",
    "Pro shop — received by assistant super",
    "Loading dock — signed by head mechanic",
    "Maintenance building — received by crew lead",
    "Equipment barn — signed on file",
  ];

  const deliveryNotes = [
    "All cases accounted for. No damage.",
    "One case slightly dented but product intact.",
    "Delivered with spec sheets as requested.",
    "Left at designated drop zone per superintendent instructions.",
    "Partial delivery — remaining 2 cases to follow next week.",
    "Temperature-sensitive product stored in cool room immediately.",
    "Delivered early morning before crew started.",
    "Full pallet delivery. Fork lift used for unloading.",
  ];

  const rows: Array<Record<string, unknown>> = [];

  for (const deal of deliverableDeals) {
    const baseDate = deal.expected_delivery_date
      ? new Date(deal.expected_delivery_date)
      : new Date("2026-03-01");

    switch (deal.stage) {
      case "Shipped": {
        // Scheduled but not yet delivered
        const scheduledDate = new Date(baseDate);
        scheduledDate.setDate(scheduledDate.getDate() + randomInt(1, 5));
        rows.push({
          deal_id: deal.id,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          actual_date: null,
          status: randomItem(["Scheduled", "In Transit"]),
          delivery_notes: "ETA " + scheduledDate.toLocaleDateString("en-CA"),
          received_by: null,
        });
        break;
      }
      case "Delivered":
      case "Invoiced":
      case "Paid": {
        // Completed delivery
        const scheduledDate = new Date(baseDate);
        scheduledDate.setDate(scheduledDate.getDate() - randomInt(3, 14));
        const actualDate = new Date(scheduledDate);
        actualDate.setDate(actualDate.getDate() + randomInt(-1, 2)); // on time ±1-2 days
        rows.push({
          deal_id: deal.id,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          actual_date: actualDate.toISOString().split("T")[0],
          status: "Delivered",
          delivery_notes: randomItem(deliveryNotes),
          received_by: randomItem(receivers),
        });

        // Some deals have a second delivery (split shipment)
        if (Math.random() < 0.3) {
          const secondDate = new Date(actualDate);
          secondDate.setDate(secondDate.getDate() + randomInt(3, 7));
          rows.push({
            deal_id: deal.id,
            scheduled_date: secondDate.toISOString().split("T")[0],
            actual_date: secondDate.toISOString().split("T")[0],
            status: "Delivered",
            delivery_notes: "Second shipment — remaining items from split order.",
            received_by: randomItem(receivers),
          });
        }
        break;
      }
    }
  }

  // Also add a couple of partial deliveries for realism
  const orderPlaced = (deals || []).filter((d) => d.stage === "Order Placed");
  for (const deal of orderPlaced.slice(0, 3)) {
    const scheduledDate = new Date("2026-03-25");
    scheduledDate.setDate(scheduledDate.getDate() + randomInt(2, 10));
    rows.push({
      deal_id: deal.id,
      scheduled_date: scheduledDate.toISOString().split("T")[0],
      actual_date: null,
      status: "Scheduled",
      delivery_notes: "Awaiting warehouse confirmation.",
      received_by: null,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("order_deliveries").insert(rows);
    if (error) {
      console.log("  ERROR:", error.message);
    } else {
      const delivered = rows.filter((r) => r.status === "Delivered").length;
      const scheduled = rows.filter((r) => r.status === "Scheduled").length;
      const inTransit = rows.filter((r) => r.status === "In Transit").length;
      console.log(`  Inserted ${rows.length} deliveries (${delivered} delivered, ${inTransit} in transit, ${scheduled} scheduled)`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 5. TURF DISEASES/PESTS enrichment
// ─────────────────────────────────────────────────────────────
async function enrichDiseasesPests() {
  console.log("\n═══ TURF DISEASES & PESTS ═══\n");

  const { data: existing } = await supabase.from("turf_diseases_pests").select("name");
  const existingNames = new Set((existing || []).map((e) => e.name));
  console.log(`  Currently ${existingNames.size} entries`);

  const newEntries = [
    // Diseases
    {
      name: "Necrotic Ring Spot",
      type: "Disease",
      scientific_name: "Ophiosphaerella korrae",
      symptoms: "Ring-shaped patches of dead turf 6-12 inches in diameter, often with green centers (frog-eye pattern). Most visible in summer heat stress.",
      affected_grass_types: ["Kentucky Bluegrass", "Annual Bluegrass"],
      affected_areas: ["fairways", "tees", "lawns"],
      season_start: "June",
      season_end: "September",
      optimal_temp_min_c: 20,
      optimal_temp_max_c: 30,
      humidity_factor: "moderate to high",
      severity: "moderate",
      cultural_controls: "Avoid drought stress, improve drainage, overseed with resistant cultivars. Deep infrequent watering promotes deeper roots.",
      ontario_common: true,
    },
    {
      name: "Take-All Patch",
      type: "Disease",
      scientific_name: "Gaeumannomyces graminis var. avenae",
      symptoms: "Bronze to brown circular patches 4-12 inches, expanding over time. Roots dark and rotted. Bentgrass greens most affected.",
      affected_grass_types: ["Creeping Bentgrass", "Annual Bluegrass"],
      affected_areas: ["greens", "tees"],
      season_start: "May",
      season_end: "October",
      optimal_temp_min_c: 15,
      optimal_temp_max_c: 25,
      humidity_factor: "high",
      severity: "high",
      cultural_controls: "Acidify soil with ammonium sulfate, topdress with composted organic matter. Manganese applications can help suppress.",
      ontario_common: true,
    },
    {
      name: "Typhula Blight (Gray Snow Mold)",
      type: "Disease",
      scientific_name: "Typhula incarnata / T. ishikariensis",
      symptoms: "Circular grayish-white patches under melting snow. Sclerotia (small hard bodies) visible on leaf blades. Matted, water-soaked appearance.",
      affected_grass_types: ["Annual Bluegrass", "Creeping Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      affected_areas: ["greens", "fairways", "tees"],
      season_start: "November",
      season_end: "April",
      optimal_temp_min_c: -5,
      optimal_temp_max_c: 5,
      humidity_factor: "high (under snow cover)",
      severity: "high",
      cultural_controls: "Reduce fall nitrogen, promote air circulation, remove excess leaf tissue, avoid early snow cover on unfrozen ground.",
      ontario_common: true,
    },
    {
      name: "Microdochium Patch (Pink Snow Mold)",
      type: "Disease",
      scientific_name: "Microdochium nivale",
      symptoms: "Small circular salmon-pink to orange-brown patches, 1-8 inches. Can occur with or without snow cover during cool, wet weather.",
      affected_grass_types: ["Annual Bluegrass", "Creeping Bentgrass", "Perennial Ryegrass"],
      affected_areas: ["greens", "tees", "fairways"],
      season_start: "October",
      season_end: "April",
      optimal_temp_min_c: 0,
      optimal_temp_max_c: 10,
      humidity_factor: "very high",
      severity: "moderate to high",
      cultural_controls: "Improve drainage, reduce late-season nitrogen, avoid covering turf, promote air movement.",
      ontario_common: true,
    },
    {
      name: "Rust",
      type: "Disease",
      scientific_name: "Puccinia spp.",
      symptoms: "Yellow-orange to reddish-brown pustules on leaf blades. Leaves appear dusty orange when rubbed. Turf thins and yellows overall.",
      affected_grass_types: ["Kentucky Bluegrass", "Perennial Ryegrass", "Zoysiagrass"],
      affected_areas: ["fairways", "roughs", "lawns"],
      season_start: "July",
      season_end: "October",
      optimal_temp_min_c: 20,
      optimal_temp_max_c: 30,
      humidity_factor: "moderate",
      severity: "low to moderate",
      cultural_controls: "Adequate nitrogen fertility, reduce drought stress, mow regularly to remove infected tissue, improve air flow.",
      ontario_common: true,
    },
    {
      name: "Powdery Mildew",
      type: "Disease",
      scientific_name: "Blumeria graminis",
      symptoms: "White powdery coating on leaf surfaces, typically in shaded areas. Leaves yellow and thin in affected areas.",
      affected_grass_types: ["Kentucky Bluegrass", "Fine Fescue"],
      affected_areas: ["shaded areas", "roughs", "under trees"],
      season_start: "May",
      season_end: "September",
      optimal_temp_min_c: 15,
      optimal_temp_max_c: 25,
      humidity_factor: "moderate",
      severity: "low",
      cultural_controls: "Increase air circulation, reduce shade by pruning trees, plant shade-tolerant species, avoid excessive nitrogen.",
      ontario_common: true,
    },
    {
      name: "Yellow Patch",
      type: "Disease",
      scientific_name: "Rhizoctonia cerealis",
      symptoms: "Yellow to straw-colored rings or patches, 3-12 inches. Ring patterns most visible in cool weather. Distinct from brown patch (which is warm-season).",
      affected_grass_types: ["Creeping Bentgrass", "Annual Bluegrass", "Kentucky Bluegrass"],
      affected_areas: ["greens", "tees", "fairways"],
      season_start: "October",
      season_end: "May",
      optimal_temp_min_c: 5,
      optimal_temp_max_c: 15,
      humidity_factor: "moderate to high",
      severity: "moderate",
      cultural_controls: "Avoid excessive nitrogen in fall, improve drainage, topdress to smooth surface.",
      ontario_common: true,
    },
    {
      name: "Stripe Smut",
      type: "Disease",
      scientific_name: "Ustilago striiformis",
      symptoms: "Dark stripes of spores along leaf blades, leaves curl and shred. Infected plants turn yellow-green, then brown during heat stress.",
      affected_grass_types: ["Kentucky Bluegrass", "Creeping Bentgrass"],
      affected_areas: ["lawns", "fairways"],
      season_start: "April",
      season_end: "June",
      optimal_temp_min_c: 10,
      optimal_temp_max_c: 20,
      humidity_factor: "moderate",
      severity: "moderate",
      cultural_controls: "Plant resistant cultivars, maintain adequate nitrogen, avoid drought stress, overseed to dilute infected population.",
      ontario_common: true,
    },
    // Pests
    {
      name: "Sod Webworm",
      type: "Pest",
      scientific_name: "Crambus spp.",
      symptoms: "Irregular brown patches where larvae chew grass blades at soil level. Small tan moths fly in zigzag pattern over turf at dusk. Pencil-sized holes from bird feeding.",
      affected_grass_types: ["Kentucky Bluegrass", "Fine Fescue", "Perennial Ryegrass"],
      affected_areas: ["lawns", "fairways", "roughs"],
      season_start: "June",
      season_end: "September",
      optimal_temp_min_c: 20,
      optimal_temp_max_c: 30,
      severity: "moderate",
      cultural_controls: "Maintain adequate mowing height, dethatch if excessive, reduce thatch layer. Monitor with soap flush test.",
      ontario_common: true,
    },
    {
      name: "Crane Fly Larvae (Leatherjackets)",
      type: "Pest",
      scientific_name: "Tipula spp.",
      symptoms: "Thin, yellowing turf in spring. Grayish-brown larvae (leatherjackets) found in thatch layer. Bird activity indicates presence.",
      affected_grass_types: ["All cool-season grasses"],
      affected_areas: ["fairways", "roughs", "lawns"],
      season_start: "March",
      season_end: "May",
      optimal_temp_min_c: 5,
      optimal_temp_max_c: 15,
      severity: "moderate",
      cultural_controls: "Improve drainage, reduce excessive moisture, monitor populations in fall. Biological control with nematodes effective.",
      ontario_common: true,
    },
    {
      name: "Black Cutworm",
      type: "Pest",
      scientific_name: "Agrotis ipsilon",
      symptoms: "Small circular depressions or ball-mark-like spots on greens. Larvae burrow into turf creating 1-inch pits. Most active at night.",
      affected_grass_types: ["Creeping Bentgrass", "Annual Bluegrass"],
      affected_areas: ["greens", "tees"],
      season_start: "May",
      season_end: "September",
      optimal_temp_min_c: 15,
      optimal_temp_max_c: 30,
      severity: "high on greens",
      cultural_controls: "Monitor with pheromone traps, soap flush to detect. Mow greens in morning to catch exposed larvae.",
      ontario_common: true,
    },
    // Weeds
    {
      name: "Dandelion",
      type: "Weed",
      scientific_name: "Taraxacum officinale",
      symptoms: "Rosette of deeply lobed leaves, bright yellow flowers, fluffy seed heads. Taproot makes hand removal difficult.",
      affected_grass_types: ["All turfgrass species"],
      affected_areas: ["lawns", "fairways", "roughs", "tees"],
      season_start: "April",
      season_end: "October",
      severity: "low to moderate",
      cultural_controls: "Maintain dense, healthy turf at proper mowing height. Overseeding thin areas. Core aeration to reduce compaction.",
      ontario_common: true,
    },
    {
      name: "White Clover",
      type: "Weed",
      scientific_name: "Trifolium repens",
      symptoms: "Low-growing trifoliate leaves forming patches. White flower heads attract bees. Spreads aggressively via stolons in thin turf.",
      affected_grass_types: ["All turfgrass species"],
      affected_areas: ["lawns", "fairways", "roughs"],
      season_start: "May",
      season_end: "October",
      severity: "low",
      cultural_controls: "Increase nitrogen fertility (clover thrives in low-N). Maintain thick turf stand. Some courses tolerate clover in roughs.",
      ontario_common: true,
    },
    {
      name: "Creeping Bentgrass (invasive)",
      type: "Weed",
      scientific_name: "Agrostis stolonifera",
      symptoms: "Lighter green, puffy patches in Kentucky bluegrass fairways and lawns. Forms thick mat via stolons. Scalps easily.",
      affected_grass_types: ["Kentucky Bluegrass stands"],
      affected_areas: ["fairways", "lawns"],
      season_start: "May",
      season_end: "October",
      severity: "moderate",
      cultural_controls: "Raise mowing height to favor bluegrass. Spot-treat with non-selective herbicide and reseed. Very difficult to eradicate.",
      ontario_common: true,
    },
    {
      name: "Goosegrass",
      type: "Weed",
      scientific_name: "Eleusine indica",
      symptoms: "Flat rosette with white center, dark green leaves. Tolerates compacted soil and heavy traffic. Often found on cart paths and tee edges.",
      affected_grass_types: ["All turfgrass"],
      affected_areas: ["tees", "cart path edges", "high-traffic areas"],
      season_start: "June",
      season_end: "October",
      severity: "moderate",
      cultural_controls: "Reduce soil compaction with aeration. Pre-emergent herbicide timing critical — germinates later than crabgrass.",
      ontario_common: true,
    },
  ];

  const toInsert = newEntries.filter((e) => !existingNames.has(e.name));
  if (toInsert.length === 0) {
    console.log("  All diseases/pests already exist, skipping.");
    return;
  }

  const { error } = await supabase.from("turf_diseases_pests").insert(toInsert);
  if (error) {
    console.log("  ERROR:", error.message);
  } else {
    console.log(`  Inserted ${toInsert.length} new diseases/pests/weeds (total: ${existingNames.size + toInsert.length})`);
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     Allturf CRM — Populate Remaining Demo Data             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  await populateInventory();
  await populateDemandSignals();
  await populatePromotions();
  await populateOrderDeliveries();
  await enrichDiseasesPests();

  console.log("\n════════════════════════════════════════════════════════════════");
  console.log("  Done! Run check-all-tables.ts to verify.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

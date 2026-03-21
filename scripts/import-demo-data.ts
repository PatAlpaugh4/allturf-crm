/**
 * Allturf CRM — Demo Data Import Script
 *
 * Steps 1-22: Full demo data pipeline — companies, profiles, contacts, products,
 * disease links, sales reps, deals, activities, events, visits, programs,
 * call logs, extractions, nudges, trends, digests, weather, knowledge base.
 *
 * Run with:
 *   npx tsx scripts/import-demo-data.ts           # run all steps
 *   npx tsx scripts/import-demo-data.ts --step=16  # run only step 16
 *
 * Valid step numbers: 1, 2, 4, 5, 6, 7, 8, 9, 11, 14, 16, 17, 18, 19, 20, 21, 22
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

// ---------------------------------------------------------------------------
// Load env vars from .env.local
// ---------------------------------------------------------------------------
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
// File paths
// ---------------------------------------------------------------------------
const DATA_DIR = path.resolve(__dirname, "../../");
const FILES = {
  crmImport: path.join(DATA_DIR, "Allturf_CRM_Import_Data.xlsx"),
  ipmReports: path.join(DATA_DIR, "Ontario_Golf_Course_IPM_Reports.xlsx"),
  fullDatabase: path.join(DATA_DIR, "Ontario_Golf_Courses_Full_Database.xlsx"),
};

// ---------------------------------------------------------------------------
// Seeded random number generator (mulberry32)
// ---------------------------------------------------------------------------
function createRng(seed: number) {
  let s = seed;
  return function (): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(42);

function weightedRandom<T>(options: [T, number][]): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, weight] of options) {
    r -= weight;
    if (r <= 0) return value;
  }
  return options[options.length - 1][0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// --step flag parsing
// ---------------------------------------------------------------------------
const VALID_STEPS = new Set([1, 2, 4, 5, 6, 7, 8, 9, 11, 14, 16, 17, 18, 19, 20, 21, 22]);

const requestedStep: number | null = (() => {
  const eqArg = process.argv.find((a) => a.startsWith("--step="));
  if (eqArg) {
    const n = parseInt(eqArg.split("=")[1], 10);
    if (!VALID_STEPS.has(n)) {
      console.error(`Invalid step: ${n}. Valid steps: ${Array.from(VALID_STEPS).join(", ")}`);
      process.exit(1);
    }
    return n;
  }
  const idx = process.argv.indexOf("--step");
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!VALID_STEPS.has(n)) {
      console.error(`Invalid step: ${n}. Valid steps: ${Array.from(VALID_STEPS).join(", ")}`);
      process.exit(1);
    }
    return n;
  }
  return null;
})();

/** Returns true if this step should execute its INSERT logic. */
function shouldRun(step: number): boolean {
  return requestedStep === null || requestedStep === step;
}

// ---------------------------------------------------------------------------
// Read Excel helpers
// ---------------------------------------------------------------------------
function readSheet(filePath: string, sheetName: string, headerRow: number): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error(`Sheet "${sheetName}" not found in ${path.basename(filePath)}`);
    console.error(`Available sheets: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  // Read raw rows, skip to header row (0-indexed), use that as keys
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const headers = raw[headerRow - 1] as string[];
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRow; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row || row.length === 0) continue;
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (key) obj[key.trim()] = row[j] ?? null;
    }
    // Skip completely empty rows
    const hasData = Object.values(obj).some((v) => v !== null && v !== undefined && v !== "");
    if (hasData) rows.push(obj);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Build IPM lookup from IPM Reports file
// ---------------------------------------------------------------------------
interface IpmData {
  ipmNumber: string | null;
  accreditationLevel: string | null;
  latestReportYear: string | null;
  totalReportYears: string | null;
  region: string | null;
}

function buildIpmLookup(): Map<string, IpmData> {
  const rows = readSheet(FILES.ipmReports, "Full Database", 4);
  const lookup = new Map<string, IpmData>();

  for (const row of rows) {
    const courseName = String(row["Course Name"] || "").trim();
    if (!courseName) continue;

    lookup.set(courseName.toLowerCase(), {
      ipmNumber: row["IPM #"] ? String(row["IPM #"]) : null,
      accreditationLevel: row["Accreditation\nLevel"]
        ? String(row["Accreditation\nLevel"])
        : row["Accreditation Level"]
          ? String(row["Accreditation Level"])
          : null,
      latestReportYear: row["Latest\nReport Year"]
        ? String(row["Latest\nReport Year"])
        : row["Latest Report Year"]
          ? String(row["Latest Report Year"])
          : null,
      totalReportYears: row["Total Report\nYears Available"]
        ? String(row["Total Report\nYears Available"])
        : row["Total Report Years Available"]
          ? String(row["Total Report Years Available"])
          : null,
      region: row["Region"] ? String(row["Region"]) : null,
    });
  }

  return lookup;
}

// ---------------------------------------------------------------------------
// Generate realistic course profile data
// ---------------------------------------------------------------------------
interface GeneratedProfile {
  num_holes: number;
  total_acreage: number;
  green_grass: string;
  fairway_grass: string;
  rough_grass: string;
  grass_types: string[];
  irrigation_type: string;
  soil_type: string;
  maintenance_level: string;
  annual_turf_budget_min: number;
  annual_turf_budget_max: number;
  usda_zone: string;
  course_type: string;
  ipm_program: boolean;
  notes: string;
}

function generateProfile(
  courseType: string | null,
  ipmAccredited: string | null,
  region: string | null,
  ipmData: IpmData | null,
  excelNotes: string | null,
): GeneratedProfile {
  // Course type
  const ct = (courseType || "").trim();
  const mappedCourseType =
    ct === "Private" ? "Private" :
    ct === "Semi-Private" ? "Semi-Private" :
    ct === "Resort" ? "Resort" :
    "Public";

  // Holes
  const num_holes = weightedRandom<number>([[18, 70], [27, 20], [9, 10]]);

  // Acreage
  const acreageRanges: Record<number, [number, number]> = {
    9: [50, 80],
    18: [120, 180],
    27: [180, 250],
  };
  const [aMin, aMax] = acreageRanges[num_holes];
  const total_acreage = randomInt(aMin, aMax);

  // Grass types
  const green_grass = weightedRandom<string>([
    ["Creeping Bentgrass", 60],
    ["Poa annua / Bentgrass Blend", 25],
    ["Annual Bluegrass", 15],
  ]);

  const fairway_grass = weightedRandom<string>([
    ["Kentucky Bluegrass", 50],
    ["Kentucky Bluegrass / Perennial Ryegrass", 30],
    ["Creeping Bentgrass", 20],
  ]);

  const rough_grass = weightedRandom<string>([
    ["Kentucky Bluegrass / Fine Fescue", 70],
    ["Perennial Ryegrass / Fine Fescue", 30],
  ]);

  const grass_types = Array.from(new Set([green_grass, fairway_grass, rough_grass]));

  // Irrigation
  const irrigation_type = weightedRandom<string>([
    ["Automatic", 60],
    ["Semi-Automatic", 30],
    ["Manual", 10],
  ]);

  // Soil
  const soil_type = weightedRandom<string>([
    ["Sandy Loam", 40],
    ["Clay Loam", 30],
    ["Sand-Based (USGA)", 20],
    ["Native Soil", 10],
  ]);

  // Maintenance level based on course type
  let maintenance_level: string;
  if (mappedCourseType === "Private") {
    maintenance_level = weightedRandom<string>([["Championship", 50], ["High", 50]]);
  } else if (mappedCourseType === "Semi-Private" || mappedCourseType === "Resort") {
    maintenance_level = weightedRandom<string>([["High", 50], ["Standard", 50]]);
  } else {
    maintenance_level = weightedRandom<string>([["Standard", 60], ["Budget", 40]]);
  }

  // Budget based on maintenance level
  const budgetRanges: Record<string, [number, number, number, number]> = {
    Championship: [250000, 350000, 400000, 500000],
    High: [150000, 200000, 250000, 300000],
    Standard: [80000, 100000, 120000, 150000],
    Budget: [40000, 50000, 60000, 80000],
  };
  const [bMinLow, bMinHigh, bMaxLow, bMaxHigh] = budgetRanges[maintenance_level];
  const annual_turf_budget_min = randomInt(bMinLow, bMinHigh);
  const annual_turf_budget_max = randomInt(bMaxLow, bMaxHigh);

  // USDA zone based on region
  let usda_zone = "5b"; // default GTA
  const regionLower = (region || "").toLowerCase();
  if (regionLower.includes("north") || regionLower.includes("thunder") || regionLower.includes("sudbury")) {
    usda_zone = "5a";
  } else if (regionLower.includes("niagara") || regionLower.includes("windsor") || regionLower.includes("essex")) {
    usda_zone = "6a";
  } else if (regionLower.includes("ottawa") || regionLower.includes("eastern")) {
    usda_zone = "5a";
  }

  // IPM
  const ipm_program = (ipmAccredited || "").toLowerCase() === "yes";

  // Build notes
  const notesParts: string[] = [];
  if (region) notesParts.push(`Region: ${region}`);
  if (ipmData?.ipmNumber) notesParts.push(`IPM #: ${ipmData.ipmNumber}`);
  if (ipmData?.accreditationLevel) notesParts.push(`IPM Accreditation: ${ipmData.accreditationLevel}`);
  if (ipmData?.latestReportYear) notesParts.push(`Latest IPM Report: ${ipmData.latestReportYear}`);
  if (ipmData?.totalReportYears) notesParts.push(`Total IPM Report Years: ${ipmData.totalReportYears}`);
  if (excelNotes) notesParts.push(excelNotes);

  return {
    num_holes,
    total_acreage,
    green_grass,
    fairway_grass,
    rough_grass,
    grass_types,
    irrigation_type,
    soil_type,
    maintenance_level,
    annual_turf_budget_min,
    annual_turf_budget_max,
    usda_zone,
    course_type: mappedCourseType,
    ipm_program,
    notes: notesParts.join(". ") || "",
  };
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Allturf CRM — Demo Data Import ===\n");

  if (requestedStep !== null) {
    console.log(`▸ Running only step ${requestedStep}\n`);
  }

  // Load IPM lookup
  console.log("Loading IPM Reports data...");
  const ipmLookup = buildIpmLookup();
  console.log(`  Found ${ipmLookup.size} IPM records\n`);

  // ----------------------------------------------------------
  // STEP 1: Companies — Golf Courses
  // ----------------------------------------------------------
  console.log("STEP 1: Importing companies...\n");

  const golfCourseRows = readSheet(FILES.crmImport, "Companies - Golf Courses", 4);
  console.log(`  Read ${golfCourseRows.length} golf course rows from Excel`);

  const companyMap = new Map<string, string>(); // name → uuid
  let companiesInserted = 0;
  let companiesSkipped = 0;

  // Fetch existing companies to check for duplicates
  const { data: existingCompanies } = await supabase
    .from("companies")
    .select("id, name");
  const existingMap = new Map<string, string>();
  if (existingCompanies) {
    for (const c of existingCompanies) {
      existingMap.set(c.name.toLowerCase(), c.id);
    }
  }

  // Insert golf courses
  for (const row of golfCourseRows) {
    const name = String(row["company_name"] || "").trim();
    if (!name) continue;

    // Check for duplicate
    const existingId = existingMap.get(name.toLowerCase());
    if (existingId) {
      companyMap.set(name, existingId);
      companiesSkipped++;
      continue;
    }

    if (!shouldRun(1)) continue; // --step: skip insert, map built from existing

    const province = String(row["province"] || "Ontario").trim();
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name,
        industry: "Golf Course",
        city: row["city"] ? String(row["city"]).trim() : null,
        province: province === "Ontario" ? "ON" : province,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ERROR inserting company "${name}":`, error.message);
      continue;
    }

    companyMap.set(name, data.id);
    existingMap.set(name.toLowerCase(), data.id);
    companiesInserted++;
  }

  console.log(`  Golf courses: ${companiesInserted} inserted, ${companiesSkipped} skipped (already exist)`);

  // Insert suppliers
  const supplierRows = readSheet(FILES.crmImport, "Suppliers - Manufacturers", 4);
  let suppliersInserted = 0;
  let suppliersSkipped = 0;

  for (const row of supplierRows) {
    const name = String(row["company_name"] || "").trim();
    if (!name) continue;

    const existingId = existingMap.get(name.toLowerCase());
    if (existingId) {
      companyMap.set(name, existingId);
      suppliersSkipped++;
      continue;
    }

    if (!shouldRun(1)) continue;

    const { data, error } = await supabase
      .from("companies")
      .insert({
        name,
        industry: "Other",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ERROR inserting supplier "${name}":`, error.message);
      continue;
    }

    companyMap.set(name, data.id);
    existingMap.set(name.toLowerCase(), data.id);
    suppliersInserted++;
  }

  console.log(`  Suppliers: ${suppliersInserted} inserted, ${suppliersSkipped} skipped (already exist)`);
  console.log(`  Total companies in map: ${companyMap.size}\n`);

  // ----------------------------------------------------------
  // STEP 2: Golf Course Profiles
  // ----------------------------------------------------------
  console.log("STEP 2: Creating golf course profiles...\n");

  // Fetch existing profiles to avoid duplicates
  const { data: existingProfiles } = await supabase
    .from("golf_course_profiles")
    .select("company_id");
  const existingProfileSet = new Set<string>();
  if (existingProfiles) {
    for (const p of existingProfiles) {
      existingProfileSet.add(p.company_id);
    }
  }

  let profilesInserted = 0;
  let profilesSkipped = 0;

  for (const row of golfCourseRows) {
    const name = String(row["company_name"] || "").trim();
    if (!name) continue;

    const companyId = companyMap.get(name);
    if (!companyId) {
      console.error(`  No company ID for "${name}", skipping profile`);
      continue;
    }

    // Skip if profile already exists
    if (existingProfileSet.has(companyId)) {
      profilesSkipped++;
      continue;
    }

    if (!shouldRun(2)) continue;

    // Get IPM data by matching course name
    const ipmData = ipmLookup.get(name.toLowerCase()) || null;

    // Also try partial matching for IPM data
    let resolvedIpmData = ipmData;
    if (!resolvedIpmData) {
      const nameLower = name.toLowerCase();
      for (const [ipmName, data] of ipmLookup) {
        if (nameLower.includes(ipmName) || ipmName.includes(nameLower)) {
          resolvedIpmData = data;
          break;
        }
      }
    }

    const region = row["region"] ? String(row["region"]).trim() : resolvedIpmData?.region || null;
    const courseType = row["course_type"] ? String(row["course_type"]).trim() : null;
    const ipmAccredited = row["ipm_accredited"] ? String(row["ipm_accredited"]).trim() : null;
    const excelNotes = row["notes"] ? String(row["notes"]).trim() : null;

    const profile = generateProfile(courseType, ipmAccredited, region, resolvedIpmData, excelNotes);

    const { error } = await supabase
      .from("golf_course_profiles")
      .insert({
        company_id: companyId,
        num_holes: profile.num_holes,
        total_acreage: profile.total_acreage,
        course_type: profile.course_type,
        green_grass: profile.green_grass,
        fairway_grass: profile.fairway_grass,
        rough_grass: profile.rough_grass,
        grass_types: profile.grass_types,
        irrigation_type: profile.irrigation_type,
        soil_type: profile.soil_type,
        maintenance_level: profile.maintenance_level,
        annual_turf_budget_min: profile.annual_turf_budget_min,
        annual_turf_budget_max: profile.annual_turf_budget_max,
        usda_zone: profile.usda_zone,
        ipm_program: profile.ipm_program,
        notes: profile.notes || null,
      });

    if (error) {
      console.error(`  ERROR inserting profile for "${name}":`, error.message);
      continue;
    }

    profilesInserted++;
  }

  console.log(`  Profiles: ${profilesInserted} inserted, ${profilesSkipped} skipped (already exist)\n`);

  // ----------------------------------------------------------
  // STEP 4: Contacts
  // ----------------------------------------------------------
  console.log("STEP 4: Importing contacts...\n");

  // Build superintendent enrichment lookup from Full Database
  const supertDirectoryRows = readSheet(FILES.fullDatabase, "Superintendent Directory", 4);
  const superLookup = new Map<string, { level: string | null; year: string | null }>();
  for (const row of supertDirectoryRows) {
    const name = String(row["Superintendent / IPM Agent"] || "").trim().toLowerCase();
    if (name) {
      superLookup.set(name, {
        level: row["IPM Accreditation Level"] ? String(row["IPM Accreditation Level"]) : null,
        year: row["Latest Report Year"] ? String(row["Latest Report Year"]) : null,
      });
    }
  }

  // Build enrichment from IPM 2024-2025 Reports sheet
  const ipm2024Rows = readSheet(FILES.ipmReports, "2024-2025 Reports", 4);
  const ipm2024Lookup = new Map<string, { level: string | null; totalYears: string | null }>();
  for (const row of ipm2024Rows) {
    const agent = String(row["Agent"] || "").trim().toLowerCase();
    if (agent) {
      ipm2024Lookup.set(agent, {
        level: row["Level"] ? String(row["Level"]) : null,
        totalYears: row["Total Years"] ? String(row["Total Years"]) : null,
      });
    }
  }

  const contactRows = readSheet(FILES.crmImport, "Contacts - Superintendents", 4);
  console.log(`  Read ${contactRows.length} contact rows from Excel`);

  // Fetch existing contacts to avoid duplicates
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id");
  const existingContactSet = new Set<string>();
  if (existingContacts) {
    for (const c of existingContacts) {
      existingContactSet.add(`${c.first_name}|${c.last_name}|${c.company_id}`.toLowerCase());
    }
  }

  const ONTARIO_AREA_CODES = ["416", "905", "613", "705", "807", "289", "343", "519"];

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "")
      .replace(/golf.*$/, "")
      .replace(/country.*$/, "")
      .replace(/club$/, "")
      .replace(/course$/, "")
      .trim()
      .slice(0, 20);
  }

  function generatePhone(): string {
    const area = ONTARIO_AREA_CODES[randomInt(0, ONTARIO_AREA_CODES.length - 1)];
    const mid = String(randomInt(200, 999));
    const last = String(randomInt(1000, 9999));
    return `${area}-${mid}-${last}`;
  }

  let contactsInserted = 0;
  let contactsSkipped = 0;

  for (const row of contactRows) {
    const firstName = String(row["first_name"] || "").trim();
    const lastName = String(row["last_name"] || "").trim();
    if (!firstName || !lastName) continue;

    const companyName = String(row["company_name"] || "").trim();
    const companyId = companyMap.get(companyName) || null;

    // Duplicate check
    const dupeKey = `${firstName}|${lastName}|${companyId}`.toLowerCase();
    if (existingContactSet.has(dupeKey)) {
      contactsSkipped++;
      continue;
    }

    if (!shouldRun(4)) continue;

    // Generate email if missing
    let email = row["email"] ? String(row["email"]).trim() : null;
    if (!email && companyName) {
      const slug = slugify(companyName);
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${slug || "course"}.ca`;
    }

    // Generate phone if missing
    let phone = row["phone"] ? String(row["phone"]).trim() : null;
    if (!phone) {
      phone = generatePhone();
    }

    // Generate preferred_contact_method if missing
    let preferredMethod = row["preferred_contact_method"]
      ? String(row["preferred_contact_method"]).trim()
      : null;
    if (!preferredMethod) {
      preferredMethod = weightedRandom<string>([["Email", 50], ["Phone", 30], ["Text", 20]]);
    }

    // Enrich notes with IPM data
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    const superData = superLookup.get(fullName);
    const ipm2024Data = ipm2024Lookup.get(fullName);

    const notesParts: string[] = [];
    const existingNotes = row["notes"] ? String(row["notes"]).trim() : null;
    if (existingNotes) notesParts.push(existingNotes);
    if (superData?.level && !existingNotes?.includes(superData.level)) {
      notesParts.push(`IPM Accreditation: ${superData.level}`);
    }
    if (superData?.year && !existingNotes?.includes(superData.year)) {
      notesParts.push(`Latest IPM Report: ${superData.year}`);
    }
    if (ipm2024Data?.totalYears) {
      notesParts.push(`Total IPM Report Years: ${ipm2024Data.totalYears}`);
    }

    const role = row["role"] ? String(row["role"]).trim() : "Superintendent";
    const status = row["status"] ? String(row["status"]).trim() : "Prospect";

    const { error } = await supabase.from("contacts").insert({
      first_name: firstName,
      last_name: lastName,
      company_id: companyId,
      email,
      phone,
      role,
      status,
      preferred_contact_method: preferredMethod,
      notes: notesParts.join(". ") || null,
    });

    if (error) {
      console.error(`  ERROR inserting contact "${firstName} ${lastName}":`, error.message);
      continue;
    }

    existingContactSet.add(dupeKey);
    contactsInserted++;
  }

  console.log(`  Contacts: ${contactsInserted} inserted, ${contactsSkipped} skipped (already exist)\n`);

  // ----------------------------------------------------------
  // STEP 5: Products / Offerings
  // ----------------------------------------------------------
  console.log("STEP 5: Importing products...\n");

  // Build active ingredients enrichment lookup
  const aiRefRows = readSheet(FILES.fullDatabase, "Active Ingredients Reference", 3);
  interface AiRefData {
    fracGroup: string | null;
    targetDiseases: string | null;
    regulatoryStatus: string | null;
    usageFrequency: string | null;
    category: string | null;
  }
  const aiRefLookup = new Map<string, AiRefData>();
  for (const row of aiRefRows) {
    const ai = String(row["Active Ingredient"] || "").trim().toLowerCase();
    if (ai) {
      aiRefLookup.set(ai, {
        fracGroup: row["FRAC/IRAC/HRAC Group"] ? String(row["FRAC/IRAC/HRAC Group"]) : null,
        targetDiseases: row["Target Diseases/Pests"] ? String(row["Target Diseases/Pests"]) : null,
        regulatoryStatus: row["Regulatory Status (Canada)"] ? String(row["Regulatory Status (Canada)"]) : null,
        usageFrequency: row["Usage Frequency on ON Golf Courses"] ? String(row["Usage Frequency on ON Golf Courses"]) : null,
        category: row["Category"] ? String(row["Category"]) : null,
      });
    }
  }
  console.log(`  Loaded ${aiRefLookup.size} active ingredient reference records`);

  const productRows = readSheet(FILES.crmImport, "Products - Trade Names", 4);
  console.log(`  Read ${productRows.length} product rows from Excel`);

  // Fetch existing products
  const { data: existingProducts } = await supabase
    .from("offerings")
    .select("id, name");
  const existingProductMap = new Map<string, string>();
  if (existingProducts) {
    for (const p of existingProducts) {
      existingProductMap.set(p.name.toLowerCase(), p.id);
    }
  }

  // Category mapping
  const VALID_CATEGORIES = new Set([
    "Fungicide", "Herbicide", "Insecticide", "Fertilizer",
    "Seed", "Wetting Agent", "Growth Regulator", "Adjuvant", "Other",
  ]);

  function mapCategory(raw: string | null): string {
    if (!raw) return "Other";
    const trimmed = raw.trim();
    if (VALID_CATEGORIES.has(trimmed)) return trimmed;
    if (trimmed.toLowerCase().includes("fungicide")) return "Fungicide";
    if (trimmed.toLowerCase().includes("herbicide")) return "Herbicide";
    if (trimmed.toLowerCase().includes("insecticide")) return "Insecticide";
    if (trimmed.toLowerCase().includes("growth reg") || trimmed.toLowerCase().includes("pgr")) return "Growth Regulator";
    return "Other";
  }

  function parseArray(val: unknown): string[] {
    if (!val) return [];
    return String(val)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Detect if product is dry formulation based on name/ingredients
  function isDryFormulation(name: string): boolean {
    const n = name.toLowerCase();
    return n.includes("wdg") || n.includes(" g ") || n.includes(" g,") || n.includes("granul")
      || n.endsWith(" g") || n.includes("sc") === false && n.includes("ec") === false;
  }

  function generateRates(category: string, productName: string): {
    min: number; max: number; unit: string;
  } {
    // Use L/ha for liquid, kg/ha for dry
    const dry = isDryFormulation(productName) && !productName.toLowerCase().includes("ec");
    const unit = dry ? "kg/ha" : "L/ha";

    switch (category) {
      case "Fungicide":
        return dry
          ? { min: +(1.0 + rng() * 2).toFixed(1), max: +(3.0 + rng() * 2).toFixed(1), unit }
          : { min: +(1.5 + rng() * 3).toFixed(1), max: +(5.0 + rng() * 3).toFixed(1), unit };
      case "Herbicide":
        return { min: +(2.0 + rng() * 2).toFixed(1), max: +(6.0 + rng() * 4).toFixed(1), unit: "L/ha" };
      case "Insecticide":
        return { min: +(1.0 + rng() * 1.5).toFixed(1), max: +(2.5 + rng() * 1.5).toFixed(1), unit: "L/ha" };
      case "Growth Regulator":
        return { min: +(0.4 + rng() * 0.5).toFixed(1), max: +(1.0 + rng() * 0.6).toFixed(1), unit: "L/ha" };
      default:
        return { min: +(1.0 + rng() * 2).toFixed(1), max: +(3.0 + rng() * 3).toFixed(1), unit: "L/ha" };
    }
  }

  function generatePackSizes(category: string): { size: string; price: number }[] {
    const basePrice = category === "Fungicide" ? randomInt(80, 200)
      : category === "Insecticide" ? randomInt(100, 250)
      : category === "Herbicide" ? randomInt(60, 150)
      : randomInt(50, 120);

    return [
      { size: "1L", price: basePrice },
      { size: "4L", price: Math.round(basePrice * 3.4) },
      { size: "10L", price: Math.round(basePrice * 7.5) },
    ];
  }

  function generatePrice(category: string): number {
    switch (category) {
      case "Fungicide": return randomInt(150, 650);
      case "Insecticide": return randomInt(200, 800);
      case "Herbicide": return randomInt(100, 400);
      case "Growth Regulator": return randomInt(200, 400);
      default: return randomInt(80, 300);
    }
  }

  const productMap = new Map<string, string>(); // name → uuid
  let productsInserted = 0;
  let productsSkipped = 0;

  for (const row of productRows) {
    const name = String(row["product_name"] || "").trim();
    if (!name) continue;

    // Check duplicate
    const existingId = existingProductMap.get(name.toLowerCase());
    if (existingId) {
      productMap.set(name, existingId);
      productsSkipped++;
      continue;
    }

    if (!shouldRun(5)) continue;

    const category = mapCategory(row["category"] ? String(row["category"]) : null);
    const activeIngredients = parseArray(row["active_ingredients"]);
    const targetDiseasesRaw = parseArray(row["target_diseases_pests"]);

    // Enrich from AI reference
    let enrichedMoa = row["moa_group"] ? String(row["moa_group"]).trim() : null;
    let enrichedTargets = targetDiseasesRaw;
    let enrichedRegStatus = row["regulatory_status"] ? String(row["regulatory_status"]).trim() : null;
    let enrichedUsage = row["usage_frequency_ontario"] ? String(row["usage_frequency_ontario"]).trim() : null;

    for (const ai of activeIngredients) {
      const ref = aiRefLookup.get(ai.toLowerCase());
      if (ref) {
        if (!enrichedMoa && ref.fracGroup) enrichedMoa = ref.fracGroup;
        if (enrichedTargets.length === 0 && ref.targetDiseases) {
          enrichedTargets = parseArray(ref.targetDiseases);
        }
        if (!enrichedRegStatus && ref.regulatoryStatus) enrichedRegStatus = ref.regulatoryStatus;
        if (!enrichedUsage && ref.usageFrequency) enrichedUsage = ref.usageFrequency;
        break; // use first match
      }
    }

    // Application rates — use from Excel if present, else generate
    let rateMin = row["application_rate_min"] != null ? Number(row["application_rate_min"]) : null;
    let rateMax = row["application_rate_max"] != null ? Number(row["application_rate_max"]) : null;
    let rateUnit = row["application_rate_unit"] ? String(row["application_rate_unit"]).trim() : null;
    let rateGenerated = false;

    if (rateMin == null || rateMax == null || isNaN(rateMin) || isNaN(rateMax)) {
      const generated = generateRates(category, name);
      rateMin = generated.min;
      rateMax = generated.max;
      rateUnit = generated.unit;
      rateGenerated = true;
    }

    // Ontario class
    let ontarioClass = row["ontario_class"] ? String(row["ontario_class"]).trim() : null;
    if (!ontarioClass) {
      ontarioClass = "Class 9 (Unlisted)";
    }

    // Signal word
    const signalWord = row["signal_word"] ? String(row["signal_word"]).trim() : null;

    // Build description / notes
    const descParts: string[] = [];
    if (enrichedRegStatus) descParts.push(`Regulatory: ${enrichedRegStatus}`);
    if (enrichedUsage) descParts.push(`Ontario usage: ${enrichedUsage}`);
    if (rateGenerated) descParts.push("Demo rate — verify against product label before production use");

    const manufacturer = row["manufacturer"] ? String(row["manufacturer"]).trim() : null;
    const packSizes = generatePackSizes(category);
    const price = generatePrice(category);

    // Mode of action text from MOA group
    let modeOfAction: string | null = null;
    if (enrichedMoa) {
      modeOfAction = `Group ${enrichedMoa}`;
    }

    // Separate target_diseases and target_pests
    const diseaseKeywords = ["spot", "patch", "mould", "mold", "blight", "rot", "anthracnose",
      "rust", "ring", "wilt", "leaf", "pythium", "rhizoctonia", "fusarium", "sclerotinia",
      "phytophthora", "downy", "snow"];
    const pestKeywords = ["grub", "weevil", "worm", "cutworm", "chinch", "ant", "beetle",
      "caterpillar", "insect", "mite", "crane", "sod web"];

    const targetDiseases: string[] = [];
    const targetPests: string[] = [];
    for (const t of enrichedTargets) {
      const tl = t.toLowerCase();
      if (pestKeywords.some((kw) => tl.includes(kw))) {
        targetPests.push(t);
      } else {
        targetDiseases.push(t);
      }
    }

    const { data, error } = await supabase
      .from("offerings")
      .insert({
        name,
        description: descParts.join(". ") || null,
        price,
        category,
        is_active: true,
        manufacturer,
        active_ingredients: activeIngredients.length > 0 ? activeIngredients : null,
        application_rate_min: rateMin,
        application_rate_max: rateMax,
        application_rate_unit: rateUnit,
        target_diseases: targetDiseases.length > 0 ? targetDiseases : null,
        target_pests: targetPests.length > 0 ? targetPests : null,
        pack_sizes: packSizes,
        signal_word: signalWord,
        mode_of_action: modeOfAction,
        moa_group: enrichedMoa,
        ontario_class: ontarioClass,
        seasonal_availability: ["Spring", "Summer", "Fall"],
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ERROR inserting product "${name}":`, error.message);
      continue;
    }

    productMap.set(name, data.id);
    existingProductMap.set(name.toLowerCase(), data.id);
    productsInserted++;
  }

  console.log(`  Products: ${productsInserted} inserted, ${productsSkipped} skipped (already exist)\n`);

  // ----------------------------------------------------------
  // STEP 6: Product-Disease Links
  // ----------------------------------------------------------
  console.log("STEP 6: Creating product-disease links...\n");

  // Fetch all diseases/pests
  const { data: allDiseases } = await supabase
    .from("turf_diseases_pests")
    .select("id, name");

  if (!shouldRun(6)) {
    console.log("  Skipping step 6 (not selected)\n");
  } else if (!allDiseases || allDiseases.length === 0) {
    console.log("  No diseases/pests in database — skipping links\n");
  } else {
    // Build name→id lookup with lowercase keys
    const diseaseLookup = new Map<string, string>();
    for (const d of allDiseases) {
      diseaseLookup.set(d.name.toLowerCase(), d.id);
    }

    // Fetch existing links to avoid duplicates
    const { data: existingLinks } = await supabase
      .from("product_disease_links")
      .select("product_id, disease_pest_id");
    const existingLinkSet = new Set<string>();
    if (existingLinks) {
      for (const l of existingLinks) {
        existingLinkSet.add(`${l.product_id}|${l.disease_pest_id}`);
      }
    }

    // Fetch all products with their target_diseases
    const { data: allProducts } = await supabase
      .from("offerings")
      .select("id, name, target_diseases");

    let linksInserted = 0;
    let linksSkipped = 0;

    if (allProducts) {
      for (const product of allProducts) {
        const targets: string[] = product.target_diseases || [];
        if (targets.length === 0) continue;

        for (let i = 0; i < targets.length; i++) {
          const targetName = targets[i].trim();

          // Try exact match first, then fuzzy
          let diseaseId = diseaseLookup.get(targetName.toLowerCase());

          if (!diseaseId) {
            // Try partial matching
            const targetLower = targetName.toLowerCase();
            for (const [dName, dId] of diseaseLookup) {
              if (dName.includes(targetLower) || targetLower.includes(dName)) {
                diseaseId = dId;
                break;
              }
              // Match common abbreviations
              const aliases: Record<string, string[]> = {
                "dollar spot": ["dollar"],
                "brown patch": ["brown patch", "rhizoctonia"],
                "gray snow mold": ["gray snow", "grey snow", "snow mould", "snow mold"],
                "pink snow mold": ["pink snow", "microdochium"],
                "anthracnose": ["anthracnose"],
                "pythium blight": ["pythium"],
                "red thread": ["red thread"],
                "leaf spot / melting out": ["leaf spot", "melting out"],
                "summer patch": ["summer patch"],
                "fairy ring": ["fairy ring"],
                "white grubs (european chafer)": ["white grub", "grub"],
                "annual bluegrass weevil": ["bluegrass weevil", "abw"],
                "chinch bugs": ["chinch"],
                "sod webworm": ["sod web", "webworm"],
                "crane fly larvae": ["crane fly"],
              };
              for (const [canonName, aliasList] of Object.entries(aliases)) {
                if (aliasList.some((a) => targetLower.includes(a)) && dName === canonName) {
                  diseaseId = dId;
                  break;
                }
              }
              if (diseaseId) break;
            }
          }

          if (!diseaseId) continue;

          const linkKey = `${product.id}|${diseaseId}`;
          if (existingLinkSet.has(linkKey)) {
            linksSkipped++;
            continue;
          }

          // Efficacy: first 2 targets = primary/Excellent, next few = Good, rest = Fair
          const efficacy = i < 2 ? "Excellent" : i < 4 ? "Good" : "Fair";
          const isPrimary = i < 2;

          const { error } = await supabase.from("product_disease_links").insert({
            product_id: product.id,
            disease_pest_id: diseaseId,
            efficacy,
            is_primary: isPrimary,
          });

          if (error) {
            // Likely duplicate — skip silently
            linksSkipped++;
            continue;
          }

          existingLinkSet.add(linkKey);
          linksInserted++;
        }
      }
    }

    console.log(`  Links: ${linksInserted} inserted, ${linksSkipped} skipped\n`);
  }

  // ----------------------------------------------------------
  // STEP 7: Sales Reps + Deals
  // ----------------------------------------------------------
  console.log("STEP 7: Creating sales reps and deals...\n");

  // --- 7a: Create demo sales reps via Supabase Auth Admin API ---
  const DEMO_REPS = [
    { name: "Mike Thompson", email: "mike.thompson@allturf.ca", territory: "GTA / Toronto" },
    { name: "Sarah Chen", email: "sarah.chen@allturf.ca", territory: "Golden Horseshoe / Niagara" },
    { name: "Dave Kowalski", email: "dave.kowalski@allturf.ca", territory: "Eastern Ontario / Ottawa" },
    { name: "Lisa Moreau", email: "lisa.moreau@allturf.ca", territory: "Northern Ontario" },
    { name: "James Wilson", email: "james.wilson@allturf.ca", territory: "Blue Mountain / Collingwood" },
  ];

  const repMap = new Map<string, string>(); // territory → rep uuid

  // Check existing reps
  const { data: existingReps } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, territory");
  const existingRepEmails = new Set<string>();
  if (existingReps) {
    for (const r of existingReps) {
      existingRepEmails.add(r.email.toLowerCase());
      if (r.territory) repMap.set(r.territory, r.id);
    }
  }

  let repsCreated = 0;
  for (const rep of DEMO_REPS) {
    if (existingRepEmails.has(rep.email.toLowerCase())) {
      console.log(`  Rep "${rep.name}" already exists, skipping`);
      continue;
    }

    if (!shouldRun(7)) continue;

    // Create auth user via admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: rep.email,
      password: "DemoPass2026!",
      email_confirm: true,
    });

    if (authError) {
      console.error(`  ERROR creating auth user for "${rep.name}":`, authError.message);
      continue;
    }

    // Create user_profiles row
    const { error: profileError } = await supabase.from("user_profiles").insert({
      id: authUser.user.id,
      email: rep.email,
      full_name: rep.name,
      role: "member",
      territory: rep.territory,
      is_active: true,
    });

    if (profileError) {
      console.error(`  ERROR creating profile for "${rep.name}":`, profileError.message);
      continue;
    }

    repMap.set(rep.territory, authUser.user.id);
    repsCreated++;
    console.log(`  Created rep: ${rep.name} (${rep.territory})`);
  }
  console.log(`  Reps: ${repsCreated} created\n`);

  // --- Build course → rep assignment by region matching ---
  // Fetch all golf course profiles with notes (which contain region info)
  const { data: allCourseProfiles } = await supabase
    .from("golf_course_profiles")
    .select("company_id, notes");

  // Also get company names for fallback
  const { data: allCompaniesForAssign } = await supabase
    .from("companies")
    .select("id, name, city")
    .eq("industry", "Golf Course");

  // Build region lookup from course profile notes
  const courseRegionMap = new Map<string, string>(); // company_id → region
  if (allCourseProfiles) {
    for (const cp of allCourseProfiles) {
      const notes = cp.notes || "";
      const regionMatch = notes.match(/Region:\s*([^.]+)/);
      if (regionMatch) {
        courseRegionMap.set(cp.company_id, regionMatch[1].trim());
      }
    }
  }

  // Map region to territory
  function regionToTerritory(region: string): string {
    const r = region.toLowerCase();
    if (r.includes("gta") || r.includes("toronto")) return "GTA / Toronto";
    if (r.includes("golden") || r.includes("niagara") || r.includes("hamilton")) return "Golden Horseshoe / Niagara";
    if (r.includes("eastern") || r.includes("ottawa")) return "Eastern Ontario / Ottawa";
    if (r.includes("northern") || r.includes("thunder") || r.includes("sudbury")) return "Northern Ontario";
    if (r.includes("blue mountain") || r.includes("collingwood")) return "Blue Mountain / Collingwood";
    if (r.includes("southwestern") || r.includes("kitchener") || r.includes("waterloo") || r.includes("london")) return "Golden Horseshoe / Niagara";
    // Default fallback
    return "GTA / Toronto";
  }

  // Build course → rep assignment
  const courseRepMap = new Map<string, string>(); // company_id → rep_id
  const golfCourseIds: string[] = [];
  if (allCompaniesForAssign) {
    for (const c of allCompaniesForAssign) {
      golfCourseIds.push(c.id);
      const region = courseRegionMap.get(c.id);
      const territory = region ? regionToTerritory(region) : "GTA / Toronto";
      const repId = repMap.get(territory);
      if (repId) {
        courseRepMap.set(c.id, repId);
      }
    }
  }

  // Fetch contacts keyed by company_id
  const { data: allContactsForDeals } = await supabase
    .from("contacts")
    .select("id, company_id");
  const companyContactMap = new Map<string, string>(); // company_id → first contact_id
  if (allContactsForDeals) {
    for (const c of allContactsForDeals) {
      if (c.company_id && !companyContactMap.has(c.company_id)) {
        companyContactMap.set(c.company_id, c.id);
      }
    }
  }

  // Fetch all products for deal items
  const { data: allProductsForDeals } = await supabase
    .from("offerings")
    .select("id, name, category, price, pack_sizes, application_rate_min, application_rate_max");

  const fungicideProducts = allProductsForDeals?.filter((p) => p.category === "Fungicide") || [];
  const herbicideProducts = allProductsForDeals?.filter((p) => p.category === "Herbicide") || [];
  const insecticideProducts = allProductsForDeals?.filter((p) => p.category === "Insecticide") || [];
  const allCategoryProducts = allProductsForDeals || [];

  function pickProducts(programType: string, count: number) {
    let pool: typeof allCategoryProducts;
    if (programType.toLowerCase().includes("fungicide")) pool = fungicideProducts;
    else if (programType.toLowerCase().includes("herbicide")) pool = herbicideProducts;
    else if (programType.toLowerCase().includes("insecticide") || programType.toLowerCase().includes("grub")) pool = insecticideProducts;
    else pool = allCategoryProducts;

    if (pool.length === 0) pool = allCategoryProducts;
    const picked: typeof allCategoryProducts = [];
    const used = new Set<string>();
    for (let i = 0; i < count && i < pool.length; i++) {
      const idx = randomInt(0, pool.length - 1);
      if (!used.has(pool[idx].id)) {
        picked.push(pool[idx]);
        used.add(pool[idx].id);
      }
    }
    return picked;
  }

  // --- Generate deals ---
  const STAGES_DIST: [string, number, number][] = [
    ["Quote Draft", 8, 10],
    ["Quote Sent", 6, 8],
    ["Quote Approved", 4, 6],
    ["Order Placed", 5, 8],
    ["Shipped", 3, 5],
    ["Delivered", 5, 8],
    ["Invoiced", 8, 12],
    ["Paid", 6, 10],
    ["Closed Lost", 3, 5],
  ];

  const ORDER_TYPES: [string, number][] = [
    ["Seasonal Program", 40],
    ["Standard", 30],
    ["Re-Order", 20],
    ["Emergency", 10],
  ];

  const SEASONS = ["Spring 2026", "Summer 2025", "Fall 2025", "Spring 2025", "Summer 2026"];
  const PROGRAM_TYPES = ["Fungicide Program", "Herbicide Program", "Insecticide Program",
    "Full Season Program", "Snow Mould Program", "Grub Control", "IPM Program", "Turf Renovation"];
  const TARGET_AREAS = ["Greens", "Fairways", "Tees", "Rough", "All Areas"];

  // Check existing deals
  const { data: existingDeals } = await supabase.from("deals").select("id");
  const existingDealCount = existingDeals?.length || 0;

  let dealsInserted = 0;
  let dealItemsInserted = 0;
  let poCounter = 42;

  if (!shouldRun(7)) {
    console.log("  Skipping deal generation (not selected)\n");
  } else if (existingDealCount > 20 && requestedStep !== 7) {
    console.log(`  ${existingDealCount} deals already exist, skipping deal generation\n`);
  } else {
    // Get company names for deal titles
    const companyNameById = new Map<string, string>();
    if (allCompaniesForAssign) {
      for (const c of allCompaniesForAssign) {
        companyNameById.set(c.id, c.name);
      }
    }

    for (const [stage, minCount, maxCount] of STAGES_DIST) {
      const count = randomInt(minCount, maxCount);
      for (let i = 0; i < count; i++) {
        // Pick a random course
        const courseIdx = randomInt(0, golfCourseIds.length - 1);
        const companyId = golfCourseIds[courseIdx];
        const contactId = companyContactMap.get(companyId) || null;
        const repId = courseRepMap.get(companyId) || null;
        const courseName = companyNameById.get(companyId) || "Golf Course";

        const season = SEASONS[randomInt(0, SEASONS.length - 1)];
        const programType = PROGRAM_TYPES[randomInt(0, PROGRAM_TYPES.length - 1)];
        const orderType = weightedRandom(ORDER_TYPES);
        const dealName = `${courseName} — ${season} ${programType}`;

        // Created at: stagger over the last 6 months
        const daysAgo = randomInt(0, 180);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        createdAt.setHours(randomInt(8, 17), randomInt(0, 59), 0, 0);

        // PO number for order-placed+ stages
        const hasPoStages = ["Order Placed", "Shipped", "Delivered", "Invoiced", "Paid"];
        const poNumber = hasPoStages.includes(stage) ? `PO-2026-${String(poCounter++).padStart(4, "0")}` : null;

        // Expected delivery
        let expectedDelivery: string | null = null;
        if (hasPoStages.includes(stage)) {
          const deliveryDate = new Date(createdAt);
          deliveryDate.setDate(deliveryDate.getDate() + randomInt(7, 21));
          expectedDelivery = deliveryDate.toISOString().split("T")[0];
        }

        // Insert deal (value=0, will update after items)
        const { data: dealData, error: dealError } = await supabase
          .from("deals")
          .insert({
            name: dealName,
            company_id: companyId,
            contact_id: contactId,
            stage,
            value_cad: 0,
            order_type: orderType,
            season,
            po_number: poNumber,
            expected_delivery_date: expectedDelivery,
            assigned_rep_id: repId,
            created_at: createdAt.toISOString(),
          })
          .select("id")
          .single();

        if (dealError) {
          console.error(`  ERROR inserting deal:`, dealError.message);
          continue;
        }

        // Generate 2-6 line items
        const itemCount = randomInt(2, 6);
        const products = pickProducts(programType, itemCount);
        let totalValue = 0;

        for (const product of products) {
          const qty = randomInt(2, 20);
          const unitPrice = product.price || randomInt(100, 500);
          const lineTotal = qty * unitPrice;
          totalValue += lineTotal;

          const appRate = product.application_rate_min
            ? +(product.application_rate_min + rng() * ((product.application_rate_max || product.application_rate_min * 2) - product.application_rate_min)).toFixed(1)
            : null;

          const targetArea = TARGET_AREAS[randomInt(0, TARGET_AREAS.length - 1)];

          const { error: itemError } = await supabase.from("deal_items").insert({
            deal_id: dealData.id,
            offering_id: product.id,
            name: product.name,
            quantity: qty,
            unit_price: unitPrice,
            application_rate: appRate,
            target_area: targetArea,
            coverage_area_m2: randomInt(5000, 50000),
          });

          if (itemError) {
            console.error(`  ERROR inserting deal item:`, itemError.message);
          } else {
            dealItemsInserted++;
          }
        }

        // Update deal value
        await supabase.from("deals").update({ value_cad: totalValue }).eq("id", dealData.id);
        dealsInserted++;
      }
    }

    console.log(`  Deals: ${dealsInserted} inserted with ${dealItemsInserted} line items\n`);
  }

  // ----------------------------------------------------------
  // STEP 8: Activities (renamed from step 9 in prompt — sequential)
  // ----------------------------------------------------------
  console.log("STEP 8: Generating activities...\n");

  const { data: existingActivities } = await supabase.from("activities").select("id");
  const existingActivityCount = existingActivities?.length || 0;

  let activitiesInserted = 0;

  if (!shouldRun(8)) {
    console.log("  Skipping step 8 (not selected)\n");
  } else if (existingActivityCount > 50 && requestedStep !== 8) {
    console.log(`  ${existingActivityCount} activities already exist, skipping\n`);
  } else {
    const ACTIVITY_TYPES: [string, number][] = [
      ["Phone Call", 30],
      ["Email", 25],
      ["Site Visit", 20],
      ["Meeting", 10],
      ["Product Demo", 5],
      ["Sample Drop-off", 5],
      ["Follow Up", 5],
    ];

    const CALL_SUMMARIES = [
      "Discussed spring fungicide program and budget for upcoming season",
      "Followed up on quote for snow mould program — superintendent reviewing with board",
      "Called about Dollar Spot pressure on greens, recommended Banner Maxx rotation",
      "Discussed switching from Daconil to Instrata for resistance management",
      "Checked in on delivery timing for grub control products",
      "Reviewed seasonal program pricing and volume discounts",
      "Talked about ABW pressure and Acelepryn timing for spring",
      "Discussed IPM program compliance and reporting requirements",
      "Called to schedule spring site visit and product demo",
      "Followed up on outstanding invoice — payment expected by month end",
      "Discussed fairway renovation plans and seed recommendations",
      "Reviewed tank mix options for upcoming fungicide application",
      "Talked about brown patch concerns after extended heat and humidity",
      "Called about Pythium prevention program for greens",
      "Discussed competitor pricing — needs price match on Heritage",
    ];

    const EMAIL_SUMMARIES = [
      "Sent updated quote with revised pricing for seasonal program",
      "Emailed product spec sheets for Ascernity and Maxtima",
      "Shared IPM annual report template and submission deadlines",
      "Sent delivery confirmation and expected arrival date",
      "Emailed follow-up notes from site visit with treatment recommendations",
      "Shared tank mix compatibility chart for proposed fungicide rotation",
      "Sent product SDS documents as requested",
      "Emailed revised pricing after volume discount approval",
    ];

    const VISIT_SUMMARIES = [
      "Walked greens and fairways — noticed early Dollar Spot symptoms on approach areas. Recommended preventive application of Banner Maxx II",
      "Spring site assessment — turf coming out of winter in good shape. Minor snow mould damage on 3rd and 7th greens. Discussed recovery plan",
      "Delivered Acelepryn samples for trial on practice green. Demonstrated proper application rate and timing",
      "Full course walkthrough with superintendent. Identified Poa annua encroachment on greens. Discussed overseeding strategy",
      "Checked on recent Heritage application — good results on Dollar Spot. No phytotoxicity observed",
      "Fall site visit — reviewed snow mould prevention plan. Course transitioning well into dormancy",
      "Met with superintendent and GM to review annual turf budget and product needs for next season",
    ];

    const MEETING_SUMMARIES = [
      "Quarterly business review — reviewed spend to date and product performance",
      "Spring planning meeting with super and assistant — mapped out full season treatment schedule",
      "Budget approval meeting with GM — seasonal program approved at proposed pricing",
      "Year-end review of IPM program performance and product efficacy results",
    ];

    const DEMO_SUMMARIES = [
      "Demonstrated Acelepryn application on practice putting green — super impressed with ease of use",
      "Product demo of new Maxtima fungicide — showed efficacy data and application guidelines",
      "Demonstrated drone mapping technology for disease pressure identification",
    ];

    const SAMPLE_SUMMARIES = [
      "Dropped off Banner Maxx II and Instrata samples for trial comparison on #4 green",
      "Delivered Acelepryn sample pack for grub control trial area",
      "Left Heritage TL samples and application guide with assistant super",
    ];

    function getSummary(actType: string): string {
      switch (actType) {
        case "Phone Call": return CALL_SUMMARIES[randomInt(0, CALL_SUMMARIES.length - 1)];
        case "Email": return EMAIL_SUMMARIES[randomInt(0, EMAIL_SUMMARIES.length - 1)];
        case "Site Visit": return VISIT_SUMMARIES[randomInt(0, VISIT_SUMMARIES.length - 1)];
        case "Meeting": return MEETING_SUMMARIES[randomInt(0, MEETING_SUMMARIES.length - 1)];
        case "Product Demo": return DEMO_SUMMARIES[randomInt(0, DEMO_SUMMARIES.length - 1)];
        case "Sample Drop-off": return SAMPLE_SUMMARIES[randomInt(0, SAMPLE_SUMMARIES.length - 1)];
        case "Follow Up": return CALL_SUMMARIES[randomInt(0, CALL_SUMMARIES.length - 1)];
        default: return "General interaction with course superintendent";
      }
    }

    // Seasonal weighting for activity dates (month → relative weight)
    // More activities in Mar-Jun (spring selling) and Sep-Oct (fall prep)
    const MONTH_WEIGHTS: Record<number, number> = {
      0: 3, 1: 4, 2: 12, 3: 15, 4: 14, 5: 12,
      6: 6, 7: 5, 8: 10, 9: 11, 10: 5, 11: 3,
    };

    const targetActivities = randomInt(200, 300);

    for (let i = 0; i < targetActivities; i++) {
      // Pick a random date in the last 6 months, weighted by season
      let daysAgo: number;
      let attempts = 0;
      do {
        daysAgo = randomInt(0, 180);
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const monthWeight = MONTH_WEIGHTS[d.getMonth()] || 5;
        if (rng() * 15 < monthWeight) break;
        attempts++;
      } while (attempts < 20);

      const actDate = new Date();
      actDate.setDate(actDate.getDate() - daysAgo);
      actDate.setHours(randomInt(8, 17), randomInt(0, 59), 0, 0);

      const actType = weightedRandom(ACTIVITY_TYPES);
      const courseIdx = randomInt(0, golfCourseIds.length - 1);
      const companyId = golfCourseIds[courseIdx];
      const contactId = companyContactMap.get(companyId) || null;
      const repId = courseRepMap.get(companyId) || null;

      const { error: actError } = await supabase.from("activities").insert({
        contact_id: contactId,
        type: actType,
        summary: getSummary(actType),
        assigned_rep_id: repId,
        created_at: actDate.toISOString(),
      });

      if (actError) {
        console.error(`  ERROR inserting activity:`, actError.message);
        continue;
      }
      activitiesInserted++;
    }

    console.log(`  Activities: ${activitiesInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 9: Calendar Events
  // ----------------------------------------------------------
  console.log("STEP 9: Generating calendar events...\n");

  const { data: existingEvents } = await supabase.from("calendar_events").select("id");
  const existingEventCount = existingEvents?.length || 0;

  let eventsInserted = 0;

  if (!shouldRun(9)) {
    console.log("  Skipping step 9 (not selected)\n");
  } else if (existingEventCount > 10 && requestedStep !== 9) {
    console.log(`  ${existingEventCount} events already exist, skipping\n`);
  } else {
    const EVENT_TYPES: [string, number][] = [
      ["site_visit", 40],
      ["meeting", 25],
      ["delivery", 20],
      ["demo", 15],
    ];

    // Get rep names for team_member field
    const repNames = new Map<string, string>();
    const { data: repProfiles } = await supabase.from("user_profiles").select("id, full_name");
    if (repProfiles) {
      for (const r of repProfiles) {
        if (r.full_name) repNames.set(r.id, r.full_name);
      }
    }

    const companyNameById2 = new Map<string, string>();
    if (allCompaniesForAssign) {
      for (const c of allCompaniesForAssign) {
        companyNameById2.set(c.id, c.name);
      }
    }

    const targetEvents = randomInt(30, 40);

    for (let i = 0; i < targetEvents; i++) {
      // Next 4 weeks, weekdays only
      let daysAhead: number;
      let evDate: Date;
      do {
        daysAhead = randomInt(1, 28);
        evDate = new Date();
        evDate.setDate(evDate.getDate() + daysAhead);
      } while (evDate.getDay() === 0 || evDate.getDay() === 6); // skip weekends

      const eventType = weightedRandom(EVENT_TYPES);
      const courseIdx = randomInt(0, golfCourseIds.length - 1);
      const companyId = golfCourseIds[courseIdx];
      const contactId = companyContactMap.get(companyId) || null;
      const repId = courseRepMap.get(companyId) || null;
      const repName = (repId && repNames.get(repId)) || "Unassigned";
      const courseName = companyNameById2.get(companyId) || "Golf Course";

      // Generate title
      let title: string;
      let description: string | null = null;
      const startHour = randomInt(8, 15);
      const endHour = Math.min(startHour + randomInt(1, 2), 17);

      switch (eventType) {
        case "site_visit":
          title = `Site Visit — ${courseName}`;
          description = "Walk course with superintendent, assess turf conditions and disease pressure";
          break;
        case "meeting":
          title = `${weightedRandom<string>([["Spring Program Review", 30], ["Budget Meeting", 20], ["Quarterly Review", 20], ["Season Planning", 30]])} — ${courseName}`;
          description = "Review seasonal program performance and upcoming product needs";
          break;
        case "delivery":
          title = `Delivery — ${courseName}`;
          description = `Product delivery for ongoing seasonal program`;
          break;
        case "demo":
          title = `Product Demo — ${courseName}`;
          description = "Demonstrate new product application and share efficacy data";
          break;
        default:
          title = `Event — ${courseName}`;
      }

      const dateStr = evDate.toISOString().split("T")[0];

      const { error: evError } = await supabase.from("calendar_events").insert({
        title,
        description,
        event_type: eventType,
        start_date: dateStr,
        end_date: dateStr,
        start_time: `${String(startHour).padStart(2, "0")}:00`,
        end_time: `${String(endHour).padStart(2, "0")}:00`,
        is_all_day: false,
        team_member: repName,
        location: courseName,
        company_id: companyId,
        contact_id: contactId,
      });

      if (evError) {
        console.error(`  ERROR inserting event:`, evError.message);
        continue;
      }
      eventsInserted++;
    }

    console.log(`  Calendar events: ${eventsInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 11: Visit Reports
  // ----------------------------------------------------------
  console.log("STEP 11: Generating visit reports...\n");

  const { data: existingVisits } = await supabase.from("visit_reports").select("id");
  const existingVisitCount = existingVisits?.length || 0;

  let visitsInserted = 0;
  let observationsInserted = 0;
  let recommendationsInserted = 0;

  // Fetch diseases for observations
  const { data: diseasesForVisits } = await supabase
    .from("turf_diseases_pests")
    .select("id, name, category");

  // Fetch product-disease links for recommendations
  const { data: productDiseaseLinks } = await supabase
    .from("product_disease_links")
    .select("product_id, disease_pest_id, efficacy_rating");

  // Build disease→products map
  const diseaseToProducts = new Map<string, { product_id: string; efficacy: string }[]>();
  if (productDiseaseLinks) {
    for (const l of productDiseaseLinks) {
      const arr = diseaseToProducts.get(l.disease_pest_id) || [];
      arr.push({ product_id: l.product_id, efficacy: l.efficacy_rating });
      diseaseToProducts.set(l.disease_pest_id, arr);
    }
  }

  // Fetch existing deals for linking recommendations
  const { data: dealsForVisits } = await supabase
    .from("deals")
    .select("id, company_id, stage");

  const companyDealsMap = new Map<string, string[]>();
  if (dealsForVisits) {
    for (const d of dealsForVisits) {
      if (d.company_id) {
        const arr = companyDealsMap.get(d.company_id) || [];
        arr.push(d.id);
        companyDealsMap.set(d.company_id, arr);
      }
    }
  }

  // Seasonal disease mapping for Ontario
  const seasonalDiseases: Record<string, string[]> = {
    spring: ["Dollar Spot", "Snow Mould (Grey)", "Snow Mould (Pink)", "Fairy Ring", "Red Thread"],
    summer: ["Dollar Spot", "Brown Patch", "Pythium Blight", "Summer Patch", "Anthracnose", "Fairy Ring"],
    fall: ["Dollar Spot", "Necrotic Ring Spot", "Red Thread", "Leaf Spot", "Rust"],
    winter: ["Snow Mould (Grey)", "Snow Mould (Pink)", "Microdochium Patch"],
  };

  // Weather by month (realistic Ontario)
  const monthWeather: Record<number, { tempRange: [number, number]; humRange: [number, number]; rainRange: [number, number] }> = {
    0: { tempRange: [-12, -2], humRange: [65, 85], rainRange: [0, 5] },
    1: { tempRange: [-10, -1], humRange: [60, 80], rainRange: [0, 5] },
    2: { tempRange: [-5, 5], humRange: [55, 75], rainRange: [0, 15] },
    3: { tempRange: [2, 14], humRange: [50, 70], rainRange: [5, 30] },
    4: { tempRange: [8, 20], humRange: [50, 75], rainRange: [10, 40] },
    5: { tempRange: [14, 26], humRange: [55, 80], rainRange: [10, 50] },
    6: { tempRange: [18, 30], humRange: [60, 85], rainRange: [5, 60] },
    7: { tempRange: [17, 29], humRange: [60, 85], rainRange: [5, 55] },
    8: { tempRange: [12, 24], humRange: [55, 80], rainRange: [10, 50] },
    9: { tempRange: [5, 16], humRange: [55, 75], rainRange: [10, 40] },
    10: { tempRange: [-1, 8], humRange: [60, 80], rainRange: [5, 25] },
    11: { tempRange: [-8, 0], humRange: [65, 85], rainRange: [0, 10] },
  };

  const CONDITIONS: ("Excellent" | "Good" | "Fair" | "Poor" | "Critical")[] = ["Excellent", "Good", "Fair", "Poor", "Critical"];
  const COND_WEIGHTS: [typeof CONDITIONS[number], number][] = [
    ["Good", 35], ["Fair", 25], ["Excellent", 20], ["Poor", 15], ["Critical", 5],
  ];

  const SEVERITY_LEVELS = ["Mild", "Moderate", "Severe", "Critical"];
  const AFFECTED_AREAS_VIS = ["Greens", "Fairways", "Tees", "Rough", "Approaches", "Bunker Surrounds"];
  const PRIORITIES: ("Immediate" | "This Week" | "This Month" | "Seasonal")[] = ["Immediate", "This Week", "This Month", "Seasonal"];

  function getSeason(month: number): string {
    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    if (month >= 9 && month <= 10) return "fall";
    return "winter";
  }

  if (!shouldRun(11)) {
    console.log("  Skipping step 11 (not selected)\n");
  } else if (existingVisitCount > 15 && requestedStep !== 11) {
    console.log(`  ${existingVisitCount} visit reports already exist, skipping\n`);
  } else {
    const TARGET_VISITS = randomInt(40, 60);

    for (let v = 0; v < TARGET_VISITS; v++) {
      // Pick a random course
      const courseIdx = randomInt(0, golfCourseIds.length - 1);
      const companyId = golfCourseIds[courseIdx];
      const contactId = companyContactMap.get(companyId) || null;
      const repId = courseRepMap.get(companyId) || null;

      // Visit date: spread over last 12 months, weighted toward growing season (Apr-Oct)
      const monthWeights: [number, number][] = [
        [3, 10], [4, 20], [5, 25], [6, 25], [7, 25], [8, 20], [9, 15], [10, 10],
        [0, 2], [1, 2], [2, 5], [11, 3],
      ];
      const visitMonth = weightedRandom(monthWeights);
      const visitDay = randomInt(1, 28);
      const visitYear = visitMonth > 2 ? 2025 : 2026;
      const visitDate = new Date(visitYear, visitMonth, visitDay);
      const visitDateStr = visitDate.toISOString().split("T")[0];

      // Weather for this month
      const mw = monthWeather[visitMonth];
      const temperature = randomInt(mw.tempRange[0], mw.tempRange[1]);
      const humidity = randomInt(mw.humRange[0], mw.humRange[1]);
      const rainfall = randomInt(mw.rainRange[0], mw.rainRange[1]);

      // Condition ratings
      const overallCond = weightedRandom(COND_WEIGHTS);
      const greensCond = weightedRandom(COND_WEIGHTS);
      const fairwaysCond = weightedRandom(COND_WEIGHTS);
      const teesCond = weightedRandom(COND_WEIGHTS);
      const roughCond = weightedRandom(COND_WEIGHTS);

      const soilMoistures = ["Dry", "Slightly Dry", "Adequate", "Moist", "Saturated"];
      const soilMoisture = soilMoistures[randomInt(0, soilMoistures.length - 1)];

      // Follow-up date: 7-21 days after visit
      const followUpDate = new Date(visitDate);
      followUpDate.setDate(followUpDate.getDate() + randomInt(7, 21));
      const followUpStr = followUpDate.toISOString().split("T")[0];

      const followUpActions = [
        "Check disease progression and reapply if needed",
        "Monitor treated areas for recovery",
        "Schedule product delivery for next application",
        "Review spray records with superintendent",
        "Assess treatment efficacy and adjust program",
        "Follow up on quote for seasonal program",
      ];
      const followUp = followUpActions[randomInt(0, followUpActions.length - 1)];

      const { data: visitData, error: visitError } = await supabase
        .from("visit_reports")
        .insert({
          company_id: companyId,
          contact_id: contactId,
          rep_id: repId,
          visit_date: visitDateStr,
          overall_condition: overallCond,
          greens_condition: greensCond,
          fairways_condition: fairwaysCond,
          tees_condition: teesCond,
          rough_condition: roughCond,
          temperature_c: temperature,
          humidity_percent: humidity,
          recent_rainfall_mm: rainfall,
          soil_moisture: soilMoisture,
          observations: `Course visited on ${visitDateStr}. Overall condition: ${overallCond}. Greens: ${greensCond}. Weather: ${temperature}°C, ${humidity}% humidity, ${rainfall}mm recent rainfall.`,
          recommendations: `Continue current program. Monitor ${getSeason(visitMonth)} disease pressure.`,
          follow_up_actions: followUp,
          follow_up_date: followUpStr,
        })
        .select("id")
        .single();

      if (visitError) {
        console.error(`  ERROR inserting visit report:`, visitError.message);
        continue;
      }
      visitsInserted++;
      const visitId = visitData.id;

      // ----------------------------------------------------------
      // STEP 12: Visit Observations (2-4 per visit)
      // ----------------------------------------------------------
      const season = getSeason(visitMonth);
      const seasonDiseaseNames = seasonalDiseases[season] || seasonalDiseases.summer;
      const numObs = randomInt(2, 4);

      const usedDiseaseIds = new Set<string>();

      for (let o = 0; o < numObs; o++) {
        // Pick a seasonally appropriate disease
        const targetDiseaseName = seasonDiseaseNames[randomInt(0, seasonDiseaseNames.length - 1)];
        let diseaseId: string | null = null;

        if (diseasesForVisits) {
          // Try exact match first, then partial
          const exact = diseasesForVisits.find((d) => d.name.toLowerCase() === targetDiseaseName.toLowerCase());
          if (exact && !usedDiseaseIds.has(exact.id)) {
            diseaseId = exact.id;
          } else {
            // Pick a random disease not yet used
            const available = diseasesForVisits.filter((d) => !usedDiseaseIds.has(d.id));
            if (available.length > 0) {
              diseaseId = available[randomInt(0, available.length - 1)].id;
            }
          }
        }
        if (diseaseId) usedDiseaseIds.add(diseaseId);

        const severity = SEVERITY_LEVELS[randomInt(0, SEVERITY_LEVELS.length - 1)];
        const affectedArea = AFFECTED_AREAS_VIS[randomInt(0, AFFECTED_AREAS_VIS.length - 1)];
        const areaM2 = randomInt(50, 5000);

        const obsNotes = [
          `${severity} ${targetDiseaseName} observed on ${affectedArea.toLowerCase()}. Approx ${areaM2}m² affected.`,
          `Active ${targetDiseaseName} found on ${affectedArea.toLowerCase()} — ${severity.toLowerCase()} severity.`,
          `${affectedArea} showing signs of ${targetDiseaseName}. Severity: ${severity.toLowerCase()}.`,
        ];

        const { error: obsError } = await supabase.from("visit_observations").insert({
          visit_report_id: visitId,
          disease_pest_id: diseaseId,
          severity,
          affected_area: affectedArea,
          area_m2_affected: areaM2,
          notes: obsNotes[randomInt(0, obsNotes.length - 1)],
        });

        if (obsError) {
          console.error(`  ERROR inserting observation:`, obsError.message);
          continue;
        }
        observationsInserted++;
      }

      // ----------------------------------------------------------
      // STEP 13: Visit Recommendations (1-3 per visit)
      // ----------------------------------------------------------
      const numRecs = randomInt(1, 3);
      const usedProductIds = new Set<string>();

      for (let r = 0; r < numRecs; r++) {
        // Pick a disease from our observations
        const diseaseIds = Array.from(usedDiseaseIds);
        const targetDiseaseId = diseaseIds.length > 0 ? diseaseIds[randomInt(0, diseaseIds.length - 1)] : null;

        // Find a product linked to this disease
        let productId: string | null = null;
        let appRate: number | null = null;

        if (targetDiseaseId) {
          const linkedProducts = diseaseToProducts.get(targetDiseaseId) || [];
          const availableProducts = linkedProducts.filter((lp) => !usedProductIds.has(lp.product_id));
          if (availableProducts.length > 0) {
            const chosen = availableProducts[randomInt(0, availableProducts.length - 1)];
            productId = chosen.product_id;
          }
        }

        // Fallback: pick any fungicide product
        if (!productId && fungicideProducts.length > 0) {
          const fp = fungicideProducts[randomInt(0, fungicideProducts.length - 1)];
          productId = fp.id;
        }

        if (productId) {
          usedProductIds.add(productId);
          // Get application rate from product data
          const prod = allProductsForDeals?.find((p) => p.id === productId);
          if (prod && prod.application_rate_min && prod.application_rate_max) {
            appRate = +(prod.application_rate_min + rng() * (prod.application_rate_max - prod.application_rate_min)).toFixed(2);
          } else {
            appRate = +(2 + rng() * 6).toFixed(2);
          }
        }

        const targetArea = AFFECTED_AREAS_VIS[randomInt(0, AFFECTED_AREAS_VIS.length - 1)];
        const priority = PRIORITIES[randomInt(0, PRIORITIES.length - 1)];

        // ~40% marked as ordered with deal_id
        const wasOrdered = rng() < 0.4;
        const companyDealIds = companyDealsMap.get(companyId) || [];
        const dealId = wasOrdered && companyDealIds.length > 0
          ? companyDealIds[randomInt(0, companyDealIds.length - 1)]
          : null;

        const { error: recError } = await supabase.from("visit_recommendations").insert({
          visit_report_id: visitId,
          product_id: productId,
          disease_pest_id: targetDiseaseId,
          application_rate: appRate,
          target_area: targetArea,
          priority,
          was_ordered: wasOrdered && dealId !== null,
          deal_id: dealId,
          notes: `Apply at ${appRate || "label"} rate to ${targetArea.toLowerCase()}. Priority: ${priority}.`,
        });

        if (recError) {
          console.error(`  ERROR inserting recommendation:`, recError.message);
          continue;
        }
        recommendationsInserted++;
      }
    }

    console.log(`  Visit reports: ${visitsInserted} inserted`);
    console.log(`  Observations: ${observationsInserted} inserted`);
    console.log(`  Recommendations: ${recommendationsInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 14: Treatment Programs (projects)
  // ----------------------------------------------------------
  console.log("STEP 14: Generating treatment programs...\n");

  const { data: existingProjects } = await supabase.from("projects").select("id");
  const existingProjectCount = existingProjects?.length || 0;

  let programsInserted = 0;
  let programTasksInserted = 0;

  const PROJECT_TYPES: ("Spring Program" | "Summer Program" | "Fall Program" | "Winter Prep" | "Full Season" | "Custom")[] =
    ["Spring Program", "Summer Program", "Fall Program", "Winter Prep", "Full Season", "Custom"];
  const PROJECT_TYPE_WEIGHTS: [typeof PROJECT_TYPES[number], number][] = [
    ["Spring Program", 25], ["Summer Program", 25], ["Fall Program", 20],
    ["Full Season", 15], ["Winter Prep", 10], ["Custom", 5],
  ];

  const PROJECT_STATUSES: ("Not Started" | "In Progress" | "On Hold" | "Completed" | "Cancelled")[] =
    ["Not Started", "In Progress", "On Hold", "Completed", "Cancelled"];
  const PROJECT_STATUS_WEIGHTS: [typeof PROJECT_STATUSES[number], number][] = [
    ["In Progress", 35], ["Completed", 25], ["Not Started", 20],
    ["On Hold", 10], ["Cancelled", 10],
  ];

  if (!shouldRun(14)) {
    console.log("  Skipping step 14 (not selected)\n");
  } else if (existingProjectCount > 5 && requestedStep !== 14) {
    console.log(`  ${existingProjectCount} projects already exist, skipping\n`);
  } else {
    const TARGET_PROGRAMS = randomInt(15, 20);

    // Pick distinct courses for programs
    const programCourses: string[] = [];
    const usedCourseSet = new Set<string>();
    for (let i = 0; i < TARGET_PROGRAMS && i < golfCourseIds.length; i++) {
      let courseId: string;
      let attempts = 0;
      do {
        courseId = golfCourseIds[randomInt(0, golfCourseIds.length - 1)];
        attempts++;
      } while (usedCourseSet.has(courseId) && attempts < 50);
      usedCourseSet.add(courseId);
      programCourses.push(courseId);
    }

    // Get company names
    const { data: compNamesData } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", programCourses);
    const compNamesMap = new Map<string, string>();
    if (compNamesData) {
      for (const c of compNamesData) compNamesMap.set(c.id, c.name);
    }

    for (let p = 0; p < programCourses.length; p++) {
      const companyId = programCourses[p];
      const contactId = companyContactMap.get(companyId) || null;
      const repId = courseRepMap.get(companyId) || null;
      const courseName = compNamesMap.get(companyId) || "Golf Course";

      const projectType = weightedRandom(PROJECT_TYPE_WEIGHTS);
      const status = weightedRandom(PROJECT_STATUS_WEIGHTS);
      const seasonYear = rng() > 0.3 ? 2026 : 2025;

      // Budget from course profile or random
      const totalBudget = randomInt(5000, 80000);
      let spentToDate = 0;
      if (status === "Completed") spentToDate = totalBudget;
      else if (status === "In Progress") spentToDate = Math.round(totalBudget * (0.2 + rng() * 0.5));
      else if (status === "On Hold") spentToDate = Math.round(totalBudget * (0.1 + rng() * 0.3));

      // Date ranges by project type
      let startDate: string;
      let targetEndDate: string;
      if (projectType === "Spring Program") {
        startDate = `${seasonYear}-04-01`;
        targetEndDate = `${seasonYear}-06-15`;
      } else if (projectType === "Summer Program") {
        startDate = `${seasonYear}-06-01`;
        targetEndDate = `${seasonYear}-09-15`;
      } else if (projectType === "Fall Program") {
        startDate = `${seasonYear}-09-01`;
        targetEndDate = `${seasonYear}-11-15`;
      } else if (projectType === "Winter Prep") {
        startDate = `${seasonYear}-10-15`;
        targetEndDate = `${seasonYear}-12-01`;
      } else if (projectType === "Full Season") {
        startDate = `${seasonYear}-04-01`;
        targetEndDate = `${seasonYear}-11-15`;
      } else {
        startDate = `${seasonYear}-05-01`;
        targetEndDate = `${seasonYear}-08-31`;
      }

      const actualEndDate = status === "Completed" ? targetEndDate : null;

      // Find a matching deal for this company
      const compDeals = companyDealsMap.get(companyId) || [];
      const dealId = compDeals.length > 0 ? compDeals[randomInt(0, compDeals.length - 1)] : null;

      const { data: projData, error: projError } = await supabase
        .from("projects")
        .insert({
          name: `${courseName} — ${projectType} ${seasonYear}`,
          company_id: companyId,
          contact_id: contactId,
          deal_id: dealId,
          project_type: projectType,
          status,
          season_year: seasonYear,
          total_budget: totalBudget,
          spent_to_date: spentToDate,
          value_cad: totalBudget,
          start_date: startDate,
          target_end_date: targetEndDate,
          actual_end_date: actualEndDate,
          assigned_rep_id: repId,
          sales_owner: repId ? undefined : "Unassigned",
          description: `${projectType} treatment program for ${courseName}. Season ${seasonYear}. Budget: $${totalBudget.toLocaleString()}.`,
        })
        .select("id")
        .single();

      if (projError) {
        console.error(`  ERROR inserting project:`, projError.message);
        continue;
      }
      programsInserted++;
      const projectId = projData.id;

      // ----------------------------------------------------------
      // STEP 15: Program Items (project_tasks) — 4-8 per program
      // ----------------------------------------------------------
      const numTasks = randomInt(4, 8);
      const today = new Date();

      // Pick products for this program — prefer products matching the project type
      let taskProductPool: typeof allCategoryProducts;
      if (projectType.includes("Spring") || projectType.includes("Fall")) {
        taskProductPool = fungicideProducts.length > 0 ? fungicideProducts : allCategoryProducts;
      } else if (projectType === "Winter Prep") {
        // Snow mould products
        taskProductPool = fungicideProducts.length > 0 ? fungicideProducts : allCategoryProducts;
      } else {
        taskProductPool = allCategoryProducts;
      }
      if (taskProductPool.length === 0) taskProductPool = allCategoryProducts;

      const usedTaskProducts = new Set<string>();
      const startDateObj = new Date(startDate);

      for (let t = 0; t < numTasks; t++) {
        // Pick a product, avoiding duplicates where possible
        let prod = taskProductPool[randomInt(0, taskProductPool.length - 1)];
        let attempts = 0;
        while (usedTaskProducts.has(prod.id) && attempts < 10) {
          prod = taskProductPool[randomInt(0, taskProductPool.length - 1)];
          attempts++;
        }
        usedTaskProducts.add(prod.id);

        // Application date: spaced 14-21 days apart from start
        const appDateObj = new Date(startDateObj);
        appDateObj.setDate(appDateObj.getDate() + t * randomInt(14, 21));
        const appDateStr = appDateObj.toISOString().split("T")[0];

        // Task status based on date and project status
        let taskStatus: "To Do" | "In Progress" | "Done";
        if (status === "Completed") {
          taskStatus = "Done";
        } else if (status === "Not Started" || status === "Cancelled") {
          taskStatus = "To Do";
        } else if (appDateObj < today) {
          taskStatus = rng() > 0.2 ? "Done" : "In Progress";
        } else {
          taskStatus = "To Do";
        }

        // Application rate within label range
        let appRate: number;
        if (prod.application_rate_min && prod.application_rate_max) {
          appRate = +(prod.application_rate_min + rng() * (prod.application_rate_max - prod.application_rate_min)).toFixed(2);
        } else {
          appRate = +(2 + rng() * 6).toFixed(2);
        }

        const targetArea = TARGET_AREAS[randomInt(0, TARGET_AREAS.length - 1)];

        // GDD threshold for temperature-sensitive applications
        const gddThreshold = rng() > 0.5 ? randomInt(100, 600) : null;

        const taskPriorities: ("Low" | "Normal" | "High" | "Urgent")[] = ["Low", "Normal", "High", "Urgent"];
        const taskPriorityWeights: [typeof taskPriorities[number], number][] = [
          ["Normal", 40], ["High", 30], ["Low", 20], ["Urgent", 10],
        ];
        const taskPriority = weightedRandom(taskPriorityWeights);

        const { error: taskError } = await supabase.from("project_tasks").insert({
          project_id: projectId,
          title: `Apply ${prod.name} — ${targetArea}`,
          description: `Apply ${prod.name} at ${appRate} L/ha to ${targetArea.toLowerCase()}. ${gddThreshold ? `Wait for GDD ≥ ${gddThreshold}.` : ""}`,
          status: taskStatus,
          priority: taskPriority,
          sort_order: t,
          application_date: appDateStr,
          product_id: prod.id,
          application_rate: appRate,
          target_area: targetArea,
          gdd_threshold: gddThreshold,
          due_date: appDateStr,
          assignee: repId || undefined,
        });

        if (taskError) {
          console.error(`  ERROR inserting project task:`, taskError.message);
          continue;
        }
        programTasksInserted++;
      }
    }

    console.log(`  Treatment programs: ${programsInserted} inserted`);
    console.log(`  Program tasks: ${programTasksInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 16: Call Logs (80-120 records)
  // ----------------------------------------------------------
  console.log("STEP 16: Generating call logs...\n");

  const { data: existingCallLogs } = await supabase.from("call_logs").select("id");
  const existingCallLogCount = existingCallLogs?.length || 0;

  let callLogsInserted = 0;
  const allCallLogIds: string[] = [];
  const dollarSpotCallIds: string[] = [];
  const bannerMaxxCallIds: string[] = [];

  // Track call log metadata for extraction generation
  interface CallLogMeta {
    id: string;
    repId: string | null;
    companyId: string;
    contactId: string | null;
    inputType: string;
    rawTranscript: string;
    processingStatus: string;
    createdAt: string;
    diseases: string[];
    products: string[];
    topics: string[];
    isDollarSpot: boolean;
    isBannerMaxx: boolean;
  }
  const callLogMetas: CallLogMeta[] = [];

  // Build reverse lookup: company_id → company name
  const companyNameByIdForCalls = new Map<string, string>();
  for (const [name, id] of companyMap) {
    companyNameByIdForCalls.set(id, name);
  }

  // Build contact name lookup
  const { data: allContactsForCalls } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id");
  const contactNameById = new Map<string, string>();
  const contactByCompanyId = new Map<string, { id: string; name: string }>();
  if (allContactsForCalls) {
    for (const c of allContactsForCalls) {
      const fullName = `${c.first_name} ${c.last_name}`;
      contactNameById.set(c.id, fullName);
      if (c.company_id && !contactByCompanyId.has(c.company_id)) {
        contactByCompanyId.set(c.company_id, { id: c.id, name: fullName });
      }
    }
  }

  // Rep name by ID
  const repNameById = new Map<string, string>();
  for (const rep of DEMO_REPS) {
    const repId = repMap.get(rep.territory);
    if (repId) repNameById.set(repId, rep.name);
  }

  // Product name by ID (reverse of productMap)
  const productNameById = new Map<string, string>();
  for (const [name, id] of productMap) {
    productNameById.set(id, name);
  }

  // GTA and Golden Horseshoe course IDs for Dollar Spot trend
  const gtaGoldenHorseshoeCourses: string[] = [];
  if (allCompaniesForAssign) {
    for (const c of allCompaniesForAssign) {
      const region = courseRegionMap.get(c.id) || "";
      const r = region.toLowerCase();
      if (r.includes("gta") || r.includes("toronto") || r.includes("golden") || r.includes("niagara") || r.includes("hamilton")) {
        gtaGoldenHorseshoeCourses.push(c.id);
      }
    }
  }

  // Raw transcript templates
  interface TranscriptTemplate {
    inputType: "voice_dictation" | "typed_notes" | "visit_notes" | "call_recording_transcript";
    template: string;
    diseases: string[];
    products: string[];
    topics: string[];
  }

  const VOICE_TEMPLATES: TranscriptTemplate[] = [
    {
      inputType: "voice_dictation",
      template: "Just left {course}, talked to {contact} about their greens. They're seeing some {disease} starting to show up on the approaches and a few collars. He's asking about {product} — wants to get a quote for the spring program. I told him I'd send pricing by Friday.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["disease_pressure", "product_inquiry", "spring_program"],
    },
    {
      inputType: "voice_dictation",
      template: "Drove by {course} this morning, {contact} flagged me down in the parking lot. Greens look good but fairways have some {disease} creeping in on 4 and 7. Wants to do a preventive app of {product} next week. Need to check inventory and get back to him.",
      diseases: ["Brown Patch"], products: ["Instrata II"], topics: ["disease_pressure", "preventive_app", "inventory_check"],
    },
    {
      inputType: "voice_dictation",
      template: "Hey just a quick note — {contact} at {course} called about their summer fungicide program. They used {product} last year but want to rotate this season for resistance management. Suggested switching to Heritage for a couple rounds. He's good with it, just needs updated pricing.",
      diseases: ["Dollar Spot"], products: ["Daconil Action"], topics: ["fungicide_rotation", "resistance_management", "pricing"],
    },
    {
      inputType: "voice_dictation",
      template: "On the road — just got off the phone with {contact} from {course}. They're dealing with some {disease} on their putting greens after all this humidity. He's been using {product} but it's not holding. Talked about switching to a curative rate. Going to send him the label with the higher rate recommendation.",
      diseases: ["Pythium Blight"], products: ["Subdue Maxx"], topics: ["disease_pressure", "curative_treatment", "application_rates"],
    },
    {
      inputType: "voice_dictation",
      template: "Coming back from {course}. Met with {contact} — their snow mould damage was minimal this year, greens bounced back fast. Now they want to get ahead of {disease} season. Ordered 10 cases of {product} for the spring rotation. Good sale, should ship next week.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["spring_recovery", "disease_prevention", "product_order"],
    },
    {
      inputType: "voice_dictation",
      template: "Quick update — {contact} at {course} is stressed about budget cuts. Board wants to trim the turf budget by fifteen percent. We need to work on a revised program that still covers {disease} protection but at a lower cost. Maybe generic options or reduced application frequency. Meeting next week to go over it.",
      diseases: ["Dollar Spot"], products: ["Heritage Maxx"], topics: ["budget_concerns", "program_revision", "cost_optimization"],
    },
    {
      inputType: "voice_dictation",
      template: "Hey — {contact} called from {course}. Needs {product} ASAP for an emergency {disease} outbreak on greens 1 through 9. Sounds bad, they sprayed two days ago but it's spreading. I told him we could get a delivery out tomorrow morning.",
      diseases: ["Anthracnose"], products: ["Daconil Action"], topics: ["emergency_treatment", "disease_outbreak", "urgent_delivery"],
    },
    {
      inputType: "voice_dictation",
      template: "Spoke with {contact} at {course} about their ABW situation. Traps are showing high counts on the collars. They want to go with {product} this year for the grub program too. Two-for-one. Sent a quote for both. He's checking with the green committee Thursday.",
      diseases: ["Annual Bluegrass Weevil"], products: ["Acelepryn"], topics: ["pest_management", "grub_control", "product_inquiry"],
    },
    {
      inputType: "voice_dictation",
      template: "Left {course} — walked the whole back nine with {contact}. Fairways look solid but the rough is struggling, lots of {disease} on the north-facing slopes. He's interested in a fall renovation plus overseeding. Wants pricing on {product} and seed mix for September.",
      diseases: ["Red Thread"], products: ["Heritage Maxx"], topics: ["fall_renovation", "overseeding", "site_assessment"],
    },
    {
      inputType: "voice_dictation",
      template: "Just wrapped up at {course}. {contact} is happy with the {product} results on greens — {disease} cleared up within a week of the second application. Wants to continue the same rotation for the rest of the season. Good news, that's a repeat order locked in.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["treatment_efficacy", "repeat_order", "customer_satisfaction"],
    },
    {
      inputType: "voice_dictation",
      template: "Checking in — {contact} at {course} mentioned a competitor offered them a lower price on {product} by about ten percent. We need to look at whether we can match or offer a volume incentive. They've been with us three years, don't want to lose the account. I'll talk to the manager.",
      diseases: [], products: ["Instrata II"], topics: ["competitor_pricing", "account_retention", "price_match"],
    },
    {
      inputType: "voice_dictation",
      template: "Big order potential at {course}. {contact} is putting together the full season program and wants everything from us — fungicides, herbicides, wetting agents, the works. Talking {product} for their main {disease} program plus Primo for growth regulation. Could be a sixty K order if we close it.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["full_season_program", "large_order", "cross_sell"],
    },
  ];

  const TYPED_TEMPLATES: TranscriptTemplate[] = [
    {
      inputType: "typed_notes",
      template: "Call with {contact} @ {course}\n- {disease} pressure building on greens\n- Wants quote for {product}\n- Budget: ~$45K for season\n- Follow up next Tuesday with pricing",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["disease_pressure", "product_inquiry", "budget_discussion"],
    },
    {
      inputType: "typed_notes",
      template: "{contact} - {course}\n- Spring program review\n- Current products working well\n- Need to add {product} to rotation for {disease}\n- Delivery requested for April 1\n- Invoice pending from last order",
      diseases: ["Snow Mould (Grey)"], products: ["Instrata II"], topics: ["spring_program", "product_rotation", "delivery_scheduling"],
    },
    {
      inputType: "typed_notes",
      template: "Re: {course}\n- {contact} confirmed order for summer program\n- {product} x 8 cases\n- Concerned about {disease} resistance\n- Discussed MOA rotation strategy\n- PO coming by end of week",
      diseases: ["Dollar Spot"], products: ["Heritage Maxx"], topics: ["order_confirmation", "resistance_management", "moa_rotation"],
    },
    {
      inputType: "typed_notes",
      template: "{course} - {contact}\n- Walked greens w/ super\n- {disease} on #3, #7, #12 greens\n- Recommending {product} at curative rate\n- Also needs wetting agent for dry spots on approaches\n- Schedule delivery for Monday AM",
      diseases: ["Brown Patch"], products: ["Daconil Action"], topics: ["site_visit", "disease_assessment", "product_recommendation"],
    },
    {
      inputType: "typed_notes",
      template: "Pricing call - {contact}, {course}\n- Budget locked at $38K\n- Need to fit {product} + herbicide program\n- {disease} is main concern\n- Competitor pricing from NuGro on same products\n- Will revise quote and send tomorrow",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["budget_discussion", "competitor_pricing", "quote_revision"],
    },
    {
      inputType: "typed_notes",
      template: "Quick check-in: {contact} @ {course}\n- Course looking great\n- {product} performing well\n- No {disease} issues this month\n- Reorder needed in 3 weeks\n- Happy customer",
      diseases: ["Pythium Blight"], products: ["Subdue Maxx"], topics: ["customer_check_in", "product_performance", "reorder"],
    },
    {
      inputType: "typed_notes",
      template: "{contact} from {course} called\n- IPM audit coming up in June\n- Needs spray records organized\n- Wants {product} added to program for {disease} prevention\n- Discussed tank mix compatibility\n- Send compatibility chart",
      diseases: ["Fairy Ring"], products: ["Heritage Maxx"], topics: ["ipm_compliance", "spray_records", "tank_mix"],
    },
    {
      inputType: "typed_notes",
      template: "{course}: {contact}\n- Emergency request\n- {disease} outbreak on practice facility\n- Needs {product} delivered today\n- Approved rush delivery fee\n- Will spray tonight after close",
      diseases: ["Pythium Blight"], products: ["Subdue Maxx"], topics: ["emergency_treatment", "rush_delivery", "disease_outbreak"],
    },
    {
      inputType: "typed_notes",
      template: "Follow-up: {contact} @ {course}\n- Reviewed fall program options\n- Going with {product} for snow mould prevention\n- Wants 2 apps: late Oct + mid Nov\n- {disease} program locked in\n- PO#2026-0187 received",
      diseases: ["Snow Mould (Grey)"], products: ["Instrata II"], topics: ["fall_program", "snow_mould_prevention", "order_placed"],
    },
  ];

  const VISIT_NOTE_TEMPLATES: TranscriptTemplate[] = [
    {
      inputType: "visit_notes",
      template: "Site Visit: {course}\nDate: {date}\nMet with: {contact}\n\nGreens: Creeping bentgrass looking healthy. Mowing at 3.2mm. Minor {disease} activity on collar of #4.\nFairways: Good density. Some thinning on south-facing slopes.\nTees: Excellent condition.\nRough: Needs attention on holes 12-15.\n\nRecommended: {product} preventive application within 7 days.\nFollow-up: 2 weeks",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["site_assessment", "turf_conditions", "preventive_recommendation"],
    },
    {
      inputType: "visit_notes",
      template: "Visit Report - {course}\nSuperintendent: {contact}\n\nOverall Condition: Good\nWeather: 24°C, humid, rain expected Thursday\n\nObservations:\n- {disease} active on approaches and collars\n- Irrigation uniformity issue on holes 6-8\n- Wetting agent needed on hydrophobic areas\n\nProducts Discussed: {product}\nAction: Quote for curative + preventive program\nNext Visit: 3 weeks",
      diseases: ["Brown Patch"], products: ["Instrata II"], topics: ["site_assessment", "disease_observation", "irrigation_issues"],
    },
    {
      inputType: "visit_notes",
      template: "Spring Assessment - {course}\nContact: {contact}\n\nWinter Damage Report:\n- Greens: Minimal snow mould, quick recovery expected\n- Fairways: Some {disease} damage on low-lying areas\n- Tees: Good shape\n\nSpring Program:\n- Begin {product} rotation in 2 weeks\n- Overseeding damaged areas\n- First fertilizer app scheduled for April 5\n\nBudget approved: $52K",
      diseases: ["Snow Mould (Grey)"], products: ["Banner Maxx II"], topics: ["spring_assessment", "winter_damage", "program_planning"],
    },
    {
      inputType: "visit_notes",
      template: "Post-Treatment Check - {course}\n{contact} walked holes 1-9 with me\n\n{product} applied 5 days ago:\n- {disease} activity reduced significantly on greens\n- No phytotoxicity observed\n- Superintendent very pleased with results\n\nPlan: Continue rotation as scheduled\nReorder: 4 cases for next application in 14 days",
      diseases: ["Dollar Spot"], products: ["Heritage Maxx"], topics: ["treatment_followup", "product_efficacy", "reorder"],
    },
    {
      inputType: "visit_notes",
      template: "Course Walk - {course}\n{contact} in attendance\n\nKey Findings:\n1. {disease} spreading on practice green — needs immediate attention\n2. Grub damage visible on fairway 11, recommend {product}\n3. Soil compaction on high-traffic areas\n4. Irrigation heads on #3 need adjustment\n\nPriority Actions:\n- Curative fungicide application this week\n- Grub treatment within 10 days\n- Aeration scheduling for next month",
      diseases: ["Anthracnose"], products: ["Acelepryn"], topics: ["course_assessment", "pest_management", "maintenance_planning"],
    },
  ];

  const CALL_RECORDING_TEMPLATES: TranscriptTemplate[] = [
    {
      inputType: "call_recording_transcript",
      template: "Rep: Hey {contact}, it's {rep} from Allturf. How's everything going at {course}?\nSuper: Not bad, not bad. We're seeing some {disease} starting to pop up on the front nine though. Mostly on the approaches.\nRep: Yeah, with this weather I'm not surprised. Are you running anything preventive right now?\nSuper: We did a round of {product} about three weeks ago but I think it's time for another app.\nRep: Definitely. I'd recommend going curative rate on the affected areas and preventive on the rest. I can get pricing over to you today.\nSuper: That works. Can you also check if you have any in stock? I don't want to wait two weeks for a delivery.\nRep: Absolutely, I'll check inventory and get back to you this afternoon.\nSuper: Perfect. Thanks {rep}.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["disease_pressure", "product_inquiry", "inventory_check"],
    },
    {
      inputType: "call_recording_transcript",
      template: "Rep: {contact}, it's {rep}. Just following up on the quote I sent over for the fall program at {course}.\nSuper: Yeah I got it. The board's a little concerned about the total — can you break out the {product} separately?\nRep: Sure. The {product} for the {disease} prevention is about thirty percent of the total. But it's the most critical piece.\nSuper: I agree, we can't skip that. Maybe we scale back the herbicide portion and do spot treatments instead of blanket apps.\nRep: That's smart. I'll revise the quote with spot treatment pricing for the herbicides and keep the full {disease} program intact.\nSuper: Great. If you can get that to me by Wednesday, I'll have it approved by Friday.\nRep: Done. Talk soon.",
      diseases: ["Snow Mould (Grey)"], products: ["Instrata II"], topics: ["quote_followup", "budget_negotiation", "fall_program"],
    },
    {
      inputType: "call_recording_transcript",
      template: "Rep: Hi {contact}, {rep} here. I wanted to touch base about the {disease} issue you mentioned last week at {course}.\nSuper: Oh yeah, it got worse. The humidity killed us. We've got active lesions on maybe half the greens now.\nRep: That's not great. What did you spray last?\nSuper: We hit it with {product} on Monday but I'm not confident it's enough.\nRep: At what rate?\nSuper: Label rate, three litres per hectare.\nRep: OK. For the severity you're describing, I'd bump to curative rate and add a contact fungicide to the tank. Maybe pair it with Daconil for a one-two punch.\nSuper: Can you ship me enough for both? I need to spray by Saturday.\nRep: I'll make it happen. Let me confirm quantities and I'll call you back within the hour.",
      diseases: ["Brown Patch"], products: ["Heritage Maxx"], topics: ["disease_outbreak", "curative_treatment", "tank_mix", "urgent_delivery"],
    },
  ];

  const ALL_TEMPLATES: TranscriptTemplate[] = [
    ...VOICE_TEMPLATES,
    ...TYPED_TEMPLATES,
    ...VISIT_NOTE_TEMPLATES,
    ...CALL_RECORDING_TEMPLATES,
  ];

  // Dollar Spot specific templates for the trend
  const DOLLAR_SPOT_VOICE_TEMPLATES: TranscriptTemplate[] = [
    {
      inputType: "voice_dictation",
      template: "Just left {course} — dollar spot is blowing up on their greens and approaches. {contact} is pretty worried, it showed up fast after the rain last week. Wants {product} delivered ASAP. I told him we'd prioritize his order.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "urgent_delivery"],
    },
    {
      inputType: "voice_dictation",
      template: "Got a call from {contact} at {course}. Same story as everyone else this week — dollar spot everywhere. He's been using Daconil but it's not holding. Wants to switch to {product} for the next few rounds. This is the third call about dollar spot today.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "product_switch", "product_demand"],
    },
    {
      inputType: "typed_notes",
      template: "{course} - {contact}\n- Heavy dollar spot pressure\n- Greens, approaches, collars all affected\n- Requesting {product} — 6 cases\n- Wants curative rate recommendation\n- Third course this week reporting same issue",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "product_inquiry"],
    },
    {
      inputType: "voice_dictation",
      template: "Heads up — {contact} from {course} called about dollar spot. It's bad on their front nine. Humidity and warm nights are making it spread. They need {product} by end of week. I'm going to flag this as a trend — I've heard from five courses in the last three days about dollar spot.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "trend_signal", "product_demand"],
    },
    {
      inputType: "typed_notes",
      template: "Re: Dollar Spot trend\n{contact} @ {course}\n- Confirming dollar spot on greens 1-9\n- Already applied {product} but needs another round\n- Wants to add Heritage to rotation\n- Weather forecast shows more humidity coming\n- Region-wide issue",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "fungicide_rotation", "regional_trend"],
    },
    {
      inputType: "voice_dictation",
      template: "This dollar spot wave is real. Just came from {course} where {contact} showed me the damage on their bent greens. Significant lesion counts, probably the worst I've seen this early in the season. Recommending {product} at curative rate plus the Daconil tank mix. He approved the order on the spot.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "curative_treatment", "order_placed"],
    },
    {
      inputType: "visit_notes",
      template: "Emergency Visit - {course}\n{contact}\n\nDollar Spot Assessment:\n- All 18 greens affected, severity moderate to high\n- Collars and approaches worst hit\n- Previous {product} app 12 days ago — interval too long given conditions\n- Warm nights (18-22°C) + heavy dew = perfect storm\n\nImmediate Action: Curative app of Banner Maxx II tomorrow AM\nFollow-up: 10-day interval until conditions change",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "emergency_visit", "curative_treatment"],
    },
    {
      inputType: "voice_dictation",
      template: "Another dollar spot call. {contact} at {course} — they've been holding off hoping it would slow down but it's getting worse. Greens and tees are both showing symptoms now. Ordered {product} right away, eight cases. That's four Banner Maxx orders this week for me alone. We might need to check distributor stock levels.",
      diseases: ["Dollar Spot"], products: ["Banner Maxx II"], topics: ["dollar_spot", "disease_outbreak", "product_demand", "inventory_concern"],
    },
  ];

  if (!shouldRun(16)) {
    console.log("  Skipping step 16 (not selected)\n");
  } else if (existingCallLogCount > 20 && requestedStep !== 16) {
    console.log(`  ${existingCallLogCount} call logs already exist, skipping\n`);
  } else {
    const TARGET_CALL_LOGS = randomInt(80, 120);
    const DOLLAR_SPOT_COUNT = randomInt(8, 10);

    // Generate Dollar Spot trend calls first (Mar 14-20, 2026)
    // Use 3+ different reps for the trend
    const trendReps = Array.from(repMap.entries()).filter(([t]) =>
      t.includes("GTA") || t.includes("Golden Horseshoe") || t.includes("Blue Mountain")
    );

    for (let ds = 0; ds < DOLLAR_SPOT_COUNT; ds++) {
      // Pick a GTA/Golden Horseshoe course
      const coursePool = gtaGoldenHorseshoeCourses.length > 0 ? gtaGoldenHorseshoeCourses : golfCourseIds;
      const companyId = coursePool[randomInt(0, coursePool.length - 1)];
      const contactInfo = contactByCompanyId.get(companyId);
      const contactId = contactInfo?.id || companyContactMap.get(companyId) || null;
      const contactName = contactInfo?.name || "the super";
      const courseName = companyNameByIdForCalls.get(companyId) || "the course";
      const repEntry = trendReps[ds % trendReps.length];
      const repId = repEntry ? repEntry[1] : courseRepMap.get(companyId) || null;
      const repName = repId ? (repNameById.get(repId) || "the rep") : "the rep";

      // Date: Mar 14-20, 2026
      const dayOffset = randomInt(0, 6); // 0-6 days within the week
      const callDate = new Date(2026, 2, 14 + dayOffset); // March = month 2
      callDate.setHours(randomInt(8, 17), randomInt(0, 59), randomInt(0, 59), 0);

      const template = DOLLAR_SPOT_VOICE_TEMPLATES[ds % DOLLAR_SPOT_VOICE_TEMPLATES.length];
      const inputType = template.inputType;

      let transcript = template.template
        .replace(/\{course\}/g, courseName)
        .replace(/\{contact\}/g, contactName)
        .replace(/\{rep\}/g, repName)
        .replace(/\{date\}/g, callDate.toISOString().split("T")[0]);

      // Most use Banner Maxx, but vary a couple
      let productName = "Banner Maxx II";
      const isBannerMaxx = ds < DOLLAR_SPOT_COUNT - 2; // last 2 use other products
      if (!isBannerMaxx) {
        productName = weightedRandom<string>([["Heritage Maxx", 50], ["Daconil Action", 50]]);
      }
      transcript = transcript.replace(/\{product\}/g, productName);
      transcript = transcript.replace(/\{disease\}/g, "Dollar Spot");

      const processingStatus = "completed";
      const durationSeconds = inputType === "voice_dictation" || inputType === "call_recording_transcript"
        ? randomInt(30, 300) : null;
      const processedAt = new Date(callDate.getTime() + randomInt(5000, 30000));

      const { data: clData, error: clError } = await supabase
        .from("call_logs")
        .insert({
          rep_id: repId,
          company_id: companyId,
          contact_id: contactId,
          input_type: inputType,
          raw_transcript: transcript,
          duration_seconds: durationSeconds,
          processing_status: processingStatus,
          processed_at: processedAt.toISOString(),
          created_at: callDate.toISOString(),
        })
        .select("id")
        .single();

      if (clError) {
        console.error(`  ERROR inserting dollar spot call log:`, clError.message);
        continue;
      }

      allCallLogIds.push(clData.id);
      dollarSpotCallIds.push(clData.id);
      if (isBannerMaxx) bannerMaxxCallIds.push(clData.id);
      callLogMetas.push({
        id: clData.id, repId, companyId, contactId, inputType,
        rawTranscript: transcript, processingStatus, createdAt: callDate.toISOString(),
        diseases: ["Dollar Spot"], products: [productName],
        topics: template.topics, isDollarSpot: true, isBannerMaxx,
      });
      callLogsInserted++;
    }

    // Generate remaining general call logs (spread over last 30 days)
    const remainingCount = TARGET_CALL_LOGS - DOLLAR_SPOT_COUNT;

    for (let i = 0; i < remainingCount; i++) {
      const companyId = golfCourseIds[randomInt(0, golfCourseIds.length - 1)];
      const contactInfo = contactByCompanyId.get(companyId);
      const contactId = contactInfo?.id || companyContactMap.get(companyId) || null;
      const contactName = contactInfo?.name || "the super";
      const courseName = companyNameByIdForCalls.get(companyId) || "the course";
      const repId = courseRepMap.get(companyId) || null;
      const repName = repId ? (repNameById.get(repId) || "the rep") : "the rep";

      // Date: last 30 days
      const daysAgo = randomInt(0, 30);
      const callDate = new Date(2026, 2, 20); // Mar 20
      callDate.setDate(callDate.getDate() - daysAgo);
      callDate.setHours(randomInt(7, 18), randomInt(0, 59), randomInt(0, 59), 0);

      // Pick template with weighted input type
      const inputType = weightedRandom<TranscriptTemplate["inputType"]>([
        ["voice_dictation", 50], ["typed_notes", 30], ["visit_notes", 15], ["call_recording_transcript", 5],
      ]);
      const templatePool = ALL_TEMPLATES.filter((t) => t.inputType === inputType);
      const template = templatePool[randomInt(0, templatePool.length - 1)];

      // Pick disease and product from template or random
      const diseaseName = template.diseases.length > 0
        ? template.diseases[0]
        : (diseasesForVisits && diseasesForVisits.length > 0
          ? diseasesForVisits[randomInt(0, diseasesForVisits.length - 1)].name
          : "Dollar Spot");

      const productName = template.products.length > 0
        ? template.products[0]
        : (allProductsForDeals && allProductsForDeals.length > 0
          ? allProductsForDeals[randomInt(0, allProductsForDeals.length - 1)].name
          : "Banner Maxx II");

      let transcript = template.template
        .replace(/\{course\}/g, courseName)
        .replace(/\{contact\}/g, contactName)
        .replace(/\{rep\}/g, repName)
        .replace(/\{disease\}/g, diseaseName)
        .replace(/\{product\}/g, productName)
        .replace(/\{date\}/g, callDate.toISOString().split("T")[0]);

      const processingStatus = weightedRandom<string>([
        ["completed", 90], ["pending", 5], ["processing", 5],
      ]);
      const durationSeconds = inputType === "voice_dictation" || inputType === "call_recording_transcript"
        ? randomInt(30, 600) : null;
      const processedAt = processingStatus === "completed"
        ? new Date(callDate.getTime() + randomInt(5000, 30000)).toISOString()
        : null;

      const { data: clData, error: clError } = await supabase
        .from("call_logs")
        .insert({
          rep_id: repId,
          company_id: companyId,
          contact_id: contactId,
          input_type: inputType,
          raw_transcript: transcript,
          duration_seconds: durationSeconds,
          processing_status: processingStatus,
          processed_at: processedAt,
          created_at: callDate.toISOString(),
        })
        .select("id")
        .single();

      if (clError) {
        console.error(`  ERROR inserting call log:`, clError.message);
        continue;
      }

      allCallLogIds.push(clData.id);
      callLogMetas.push({
        id: clData.id, repId, companyId, contactId, inputType,
        rawTranscript: transcript, processingStatus, createdAt: callDate.toISOString(),
        diseases: [diseaseName], products: [productName],
        topics: template.topics, isDollarSpot: false, isBannerMaxx: false,
      });
      callLogsInserted++;
    }

    console.log(`  Call logs: ${callLogsInserted} inserted (${dollarSpotCallIds.length} dollar spot trend, ${bannerMaxxCallIds.length} Banner Maxx)\n`);
  }

  // ----------------------------------------------------------
  // STEP 17: Call Log Extractions (one per completed call log)
  // Load call log metadata from DB if step 16 didn't populate it
  if (allCallLogIds.length === 0 && (shouldRun(17) || shouldRun(18) || shouldRun(19) || shouldRun(20))) {
    const { data: dbCallLogs } = await supabase
      .from("call_logs")
      .select("id, rep_id, company_id, contact_id, input_type, raw_transcript, processing_status, created_at");
    if (dbCallLogs && dbCallLogs.length > 0) {
      for (const cl of dbCallLogs) {
        allCallLogIds.push(cl.id);
        const transcript = (cl.raw_transcript || "").toLowerCase();
        const isDollarSpot = transcript.includes("dollar spot");
        const isBannerMaxx = transcript.includes("banner maxx");
        if (isDollarSpot) dollarSpotCallIds.push(cl.id);
        if (isBannerMaxx) bannerMaxxCallIds.push(cl.id);
        // Infer diseases and products from transcript
        const diseases: string[] = [];
        const products: string[] = [];
        const topics: string[] = [];
        if (isDollarSpot) { diseases.push("Dollar Spot"); topics.push("dollar_spot"); }
        if (transcript.includes("brown patch")) { diseases.push("Brown Patch"); }
        if (transcript.includes("pythium")) { diseases.push("Pythium Blight"); }
        if (transcript.includes("anthracnose")) { diseases.push("Anthracnose"); }
        if (transcript.includes("snow mould") || transcript.includes("snow mold")) { diseases.push("Snow Mould (Grey)"); }
        if (isBannerMaxx) { products.push("Banner Maxx II"); topics.push("banner_maxx_demand"); }
        if (transcript.includes("heritage")) { products.push("Heritage Maxx"); }
        if (transcript.includes("instrata")) { products.push("Instrata II"); }
        if (transcript.includes("daconil")) { products.push("Daconil Action"); }
        if (transcript.includes("subdue")) { products.push("Subdue Maxx"); }
        if (transcript.includes("acelepryn")) { products.push("Acelepryn"); }
        if (transcript.includes("budget")) topics.push("budget_concerns");
        if (transcript.includes("competitor") || transcript.includes("price match")) topics.push("competitor_pricing");
        if (transcript.includes("order") || transcript.includes("delivery")) topics.push("product_order");
        callLogMetas.push({
          id: cl.id, repId: cl.rep_id, companyId: cl.company_id, contactId: cl.contact_id,
          inputType: cl.input_type, rawTranscript: cl.raw_transcript || "",
          processingStatus: cl.processing_status, createdAt: cl.created_at,
          diseases, products, topics, isDollarSpot, isBannerMaxx,
        });
      }
      console.log(`  Loaded ${allCallLogIds.length} call log IDs from database (${dollarSpotCallIds.length} dollar spot)\n`);
    }
  }

  // ----------------------------------------------------------
  console.log("STEP 17: Generating call log extractions...\n");

  const { data: existingExtractions } = await supabase.from("call_log_extractions").select("id");
  const existingExtractionCount = existingExtractions?.length || 0;

  let extractionsInserted = 0;

  if (!shouldRun(17)) {
    console.log("  Skipping step 17 (not selected)\n");
  } else if (existingExtractionCount > 10 && requestedStep !== 17) {
    console.log(`  ${existingExtractionCount} extractions already exist, skipping\n`);
  } else {
    const completedCallLogs = callLogMetas.filter((cl) => cl.processingStatus === "completed");

    const SENTIMENTS: [string, number][] = [
      ["neutral", 40], ["positive", 30], ["concerned", 20], ["urgent", 10],
    ];

    const COMPETITOR_NAMES = ["NuGro", "Plant Products", "Bayer Environmental", "BASF Turf", "Syngenta Professional"];

    const BUDGET_SIGNALS = [
      "Budget tight this year, board cut turf spending by 15%",
      "Healthy budget, superintendent has full discretion on product selection",
      "Budget frozen until Q2 board meeting",
      "Willing to increase spend if ROI is demonstrated",
      "Looking for volume discounts to stay within budget",
      null, null, null, null, null, // 50% chance of null
    ];

    for (const cl of completedCallLogs) {
      // Generate summary from transcript
      const summaryParts: string[] = [];
      if (cl.diseases.length > 0) {
        summaryParts.push(`Discussed ${cl.diseases.join(" and ")} pressure`);
      }
      if (cl.products.length > 0) {
        summaryParts.push(`${cl.products.join(", ")} ${cl.isDollarSpot ? "urgently requested" : "discussed"}`);
      }
      const courseName = companyNameByIdForCalls.get(cl.companyId) || "the course";
      summaryParts.push(`at ${courseName}`);

      // Add action-oriented summary
      const actionSummaries = [
        "Follow-up needed for pricing and delivery scheduling.",
        "Quote to be sent for seasonal program.",
        "Order placed, delivery to be scheduled.",
        "Product recommendation provided, awaiting superintendent confirmation.",
        "Treatment plan discussed, next steps depend on weather conditions.",
      ];
      summaryParts.push(actionSummaries[randomInt(0, actionSummaries.length - 1)]);

      const sentiment = cl.isDollarSpot
        ? weightedRandom<string>([["concerned", 50], ["urgent", 30], ["neutral", 20]])
        : weightedRandom(SENTIMENTS);

      // Products requested JSONB
      const productsRequested = cl.products.map((pName) => {
        const pId = productMap.get(pName) || null;
        return {
          product_name: pName,
          product_id: pId,
          quantity: randomInt(2, 12),
          urgency: cl.isDollarSpot ? "high" : weightedRandom<string>([["normal", 50], ["high", 30], ["low", 20]]),
        };
      });

      // Action items
      const ACTION_ITEM_TYPES = ["send_quote", "schedule_delivery", "follow_up_call", "site_visit", "send_info", "check_inventory"];
      const numActions = randomInt(1, 3);
      const actionItems = [];
      for (let a = 0; a < numActions; a++) {
        const dueDate = new Date(cl.createdAt);
        dueDate.setDate(dueDate.getDate() + randomInt(1, 14));
        actionItems.push({
          type: ACTION_ITEM_TYPES[randomInt(0, ACTION_ITEM_TYPES.length - 1)],
          description: `${cl.products[0] ? `Re: ${cl.products[0]} — ` : ""}${["Send pricing", "Schedule delivery", "Follow up on order", "Check inventory levels", "Send product literature"][randomInt(0, 4)]}`,
          due_date: dueDate.toISOString().split("T")[0],
          priority: cl.isDollarSpot ? "high" : weightedRandom<string>([["medium", 50], ["high", 30], ["low", 20]]),
        });
      }

      const followUpNeeded = rng() < 0.6;
      const followUpDate = followUpNeeded
        ? (() => { const d = new Date(cl.createdAt); d.setDate(d.getDate() + randomInt(3, 14)); return d.toISOString().split("T")[0]; })()
        : null;

      const keyTopics = [...cl.topics];
      if (cl.isDollarSpot) keyTopics.push("dollar_spot");
      if (cl.isBannerMaxx) keyTopics.push("banner_maxx_demand");

      const confidenceScore = cl.inputType === "call_recording_transcript"
        ? +(0.70 + rng() * 0.15).toFixed(2)
        : +(0.78 + rng() * 0.17).toFixed(2);

      // Competitor mentions (~15% of calls)
      const competitorMentions = rng() < 0.15
        ? [COMPETITOR_NAMES[randomInt(0, COMPETITOR_NAMES.length - 1)]]
        : null;

      // Budget signals (~20% of calls)
      const budgetSignal = rng() < 0.2
        ? BUDGET_SIGNALS[randomInt(0, BUDGET_SIGNALS.length - 1)]
        : null;

      const { error: exError } = await supabase.from("call_log_extractions").insert({
        call_log_id: cl.id,
        summary: summaryParts.join(". "),
        sentiment,
        diseases_mentioned: cl.diseases,
        products_mentioned: cl.products,
        products_requested: productsRequested,
        competitor_mentions: competitorMentions,
        budget_signals: budgetSignal,
        follow_up_needed: followUpNeeded,
        follow_up_date: followUpDate,
        action_items: actionItems,
        key_topics: keyTopics,
        confidence_score: confidenceScore,
      });

      if (exError) {
        console.error(`  ERROR inserting extraction:`, exError.message);
        continue;
      }
      extractionsInserted++;
    }

    console.log(`  Extractions: ${extractionsInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 18: Rep Nudges (20-30)
  // ----------------------------------------------------------
  console.log("STEP 18: Generating rep nudges...\n");

  const { data: existingNudges } = await supabase.from("rep_nudges").select("id");
  const existingNudgeCount = existingNudges?.length || 0;

  let nudgesInserted = 0;

  if (!shouldRun(18)) {
    console.log("  Skipping step 18 (not selected)\n");
  } else if (existingNudgeCount > 5 && requestedStep !== 18) {
    console.log(`  ${existingNudgeCount} nudges already exist, skipping\n`);
  } else {
    const TARGET_NUDGES = randomInt(20, 30);

    const NUDGE_CONFIGS: {
      nudgeType: string;
      weight: number;
      titles: string[];
      messages: string[];
      suggestedActions: string[];
    }[] = [
      {
        nudgeType: "inventory_alert",
        weight: 30,
        titles: [
          "Low Stock: Banner Maxx II",
          "Inventory Alert: Heritage Maxx Running Low",
          "Restock Needed: Instrata II",
          "Stock Alert: Subdue Maxx Below Threshold",
          "Low Inventory: Acelepryn",
        ],
        messages: [
          "Banner Maxx II stock is at 15 cases — below the 20-case reorder threshold. 4 pending orders require 12 cases. Recommend placing a distributor reorder to avoid backorders.",
          "Heritage Maxx inventory is critically low (6 cases remaining). 3 courses have orders pending delivery this week.",
          "Instrata II supply is running low ahead of the fall snow mould season. Current stock may not cover projected demand.",
          "Subdue Maxx stock at 8 cases. With Pythium pressure building, expect increased demand in the next 2 weeks.",
          "Acelepryn cases running low. Spring ABW and grub season starting — consider reorder.",
        ],
        suggestedActions: [
          "Place reorder with distributor",
          "Check alternative product availability",
          "Contact supplier for expedited shipment",
          "Review pending orders and prioritize",
          "Notify affected customers of potential delay",
        ],
      },
      {
        nudgeType: "promo_available",
        weight: 25,
        titles: [
          "Early Order Discount: Spring Fungicide Program",
          "Volume Rebate Available: Heritage Maxx",
          "Promo: Buy 10 Get 1 Free — Banner Maxx II",
          "Seasonal Promotion: Fall Snow Mould Bundle",
          "New Product Launch Discount: Ascernity",
        ],
        messages: [
          "Early order pricing available for spring fungicide programs until March 31. Up to 8% discount on orders over $10K. 12 of your accounts haven't placed spring orders yet.",
          "Volume rebate program active for Heritage Maxx: 5% back on orders of 20+ cases. Great opportunity for your high-volume accounts.",
          "Banner Maxx II buy-10-get-1 promotion running through April 15. Flag to customers with active Dollar Spot programs.",
          "Fall snow mould bundle: Instrata II + Medallion at 12% discount when ordered together. Perfect for your northern territory accounts.",
          "Ascernity launch promotion: 15% off first order. Great rotation partner for existing fungicide programs.",
        ],
        suggestedActions: [
          "Share promotion with qualifying accounts",
          "Calculate savings for top accounts",
          "Bundle with existing orders for max discount",
          "Schedule calls with accounts that haven't ordered",
          "Create comparison showing savings vs. regular pricing",
        ],
      },
      {
        nudgeType: "related_info",
        weight: 20,
        titles: [
          "Dollar Spot Alert: Regional Trend Detected",
          "Weather Advisory: Extended Humidity Forecast",
          "New Efficacy Data: Instrata II Field Trials",
          "MOA Rotation Reminder for Active Accounts",
          "Competitor Price Change: NuGro Fungicide Line",
        ],
        messages: [
          "8 courses in your territory have reported Dollar Spot in the last 7 days. This is 3x the normal rate for this time of year. Proactively reach out to accounts that haven't reported yet.",
          "Environment Canada forecasts above-average humidity for the GTA region over the next 10 days. Disease pressure likely to increase. Good time to check in on preventive programs.",
          "New field trial data shows Instrata II outperforming Heritage in Dollar Spot control at lower rates. Useful for price-sensitive accounts.",
          "3 of your accounts have used the same MOA group for 3+ consecutive applications. Recommend discussing rotation to prevent resistance buildup.",
          "NuGro has dropped prices on their generic fungicide line by 12%. May affect competitive positioning on price-sensitive accounts.",
        ],
        suggestedActions: [
          "Proactively contact at-risk accounts",
          "Share weather advisory with superintendents",
          "Send updated efficacy data to relevant accounts",
          "Schedule MOA rotation discussions",
          "Prepare competitive pricing comparison",
        ],
      },
      {
        nudgeType: "action_reminder",
        weight: 15,
        titles: [
          "Overdue Follow-Up: 3 Accounts Need Callbacks",
          "Quote Expiring: Spring Program at Rattlesnake Point",
          "Delivery Confirmation Needed",
          "Outstanding Invoice: 60 Days Past Due",
          "Site Visit Overdue: 2 Key Accounts",
        ],
        messages: [
          "You have 3 follow-up calls from last week that haven't been completed. Oldest is 5 days overdue for a pricing discussion.",
          "Quote #2026-0145 for the spring fungicide program expires in 3 days. Superintendent mentioned budget approval was pending.",
          "Delivery scheduled for tomorrow needs confirmation. 4 cases of Banner Maxx II for morning dropoff.",
          "Invoice #INV-2026-0089 is 60 days past due. $12,400 outstanding. Recommend calling accounts receivable contact.",
          "2 key accounts haven't had a site visit in over 6 weeks. Both are in active treatment programs.",
        ],
        suggestedActions: [
          "Complete overdue follow-up calls today",
          "Call superintendent to close quote before expiry",
          "Confirm delivery logistics and timing",
          "Escalate overdue invoice to management",
          "Schedule site visits for this week",
        ],
      },
      {
        nudgeType: "cross_sell",
        weight: 10,
        titles: [
          "Cross-Sell: Wetting Agent for Fungicide Accounts",
          "Upsell Opportunity: Growth Regulator Add-On",
          "Cross-Sell: Seed Package for Renovation Accounts",
          "Bundle Opportunity: Grub + ABW Control",
        ],
        messages: [
          "5 accounts purchasing fungicides have no wetting agent in their program. Hydro-Wet improves fungicide efficacy and addresses hydrophobic soils.",
          "Accounts using Banner Maxx II may benefit from Primo Maxx growth regulator. Reduces mowing frequency and improves turf density.",
          "3 accounts planning fall renovations haven't ordered seed yet. Recommend reaching out with seed mix options for their grass types.",
          "Accounts treating for ABW may also need grub control. Acelepryn handles both — single product, two problems solved.",
        ],
        suggestedActions: [
          "Include wetting agent in next quote revision",
          "Send growth regulator benefits sheet",
          "Prepare seed mix recommendations",
          "Propose combined ABW + grub treatment plan",
        ],
      },
    ];

    for (let n = 0; n < TARGET_NUDGES; n++) {
      // Pick nudge type by weight
      const nudgeTypeWeights: [number, number][] = NUDGE_CONFIGS.map((nc, idx) => [idx, nc.weight]);
      const configIdx = weightedRandom(nudgeTypeWeights);
      const config = NUDGE_CONFIGS[configIdx];

      // Pick a call log to link to
      const callLogIdx = randomInt(0, Math.max(0, allCallLogIds.length - 1));
      const callLogId = allCallLogIds.length > 0 ? allCallLogIds[callLogIdx] : null;
      const callMeta = callLogId ? callLogMetas.find((m) => m.id === callLogId) : null;

      const repId = callMeta?.repId || (repMap.get("GTA / Toronto") || null);
      const companyId = callMeta?.companyId || golfCourseIds[randomInt(0, golfCourseIds.length - 1)];
      const contactId = callMeta?.contactId || companyContactMap.get(companyId) || null;

      const titleIdx = randomInt(0, config.titles.length - 1);
      const messageIdx = randomInt(0, config.messages.length - 1);
      const actionIdx = randomInt(0, config.suggestedActions.length - 1);

      const priority = weightedRandom<string>([
        ["medium", 40], ["high", 30], ["low", 20], ["urgent", 10],
      ]);

      const isDismissed = rng() < 0.4;
      const isCompleted = isDismissed && rng() < 0.3;

      const dueDate = new Date(2026, 2, 20);
      dueDate.setDate(dueDate.getDate() + randomInt(-3, 7));

      const { error: nudgeError } = await supabase.from("rep_nudges").insert({
        rep_id: repId,
        company_id: companyId,
        contact_id: contactId,
        call_log_id: callLogId,
        nudge_type: config.nudgeType,
        priority,
        title: config.titles[titleIdx],
        message: config.messages[messageIdx],
        suggested_action: config.suggestedActions[actionIdx],
        due_date: dueDate.toISOString().split("T")[0],
        is_dismissed: isDismissed,
        dismissed_at: isDismissed ? new Date(2026, 2, randomInt(15, 20)).toISOString() : null,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date(2026, 2, randomInt(16, 20)).toISOString() : null,
      });

      if (nudgeError) {
        console.error(`  ERROR inserting nudge:`, nudgeError.message);
        continue;
      }
      nudgesInserted++;
    }

    console.log(`  Nudges: ${nudgesInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 19: Field Trend Signals (3-5)
  // ----------------------------------------------------------
  console.log("STEP 19: Generating field trend signals...\n");

  const { data: existingTrends } = await supabase.from("field_trend_signals").select("id");
  const existingTrendCount = existingTrends?.length || 0;

  let trendsInserted = 0;

  if (!shouldRun(19)) {
    console.log("  Skipping step 19 (not selected)\n");
  } else if (existingTrendCount > 0 && requestedStep !== 19) {
    console.log(`  ${existingTrendCount} trend signals already exist, skipping\n`);
  } else {
    // Collect affected company IDs from dollar spot calls
    const dollarSpotCompanyIds = Array.from(new Set(
      callLogMetas.filter((m) => m.isDollarSpot).map((m) => m.companyId)
    ));
    const bannerMaxxCompanyIds = Array.from(new Set(
      callLogMetas.filter((m) => m.isBannerMaxx).map((m) => m.companyId)
    ));

    const trendSignals = [
      {
        signal_type: "disease_outbreak",
        severity: "warning",
        title: "Dollar Spot Outbreak — GTA & Golden Horseshoe",
        description: "Significant increase in Dollar Spot reports across the GTA and Golden Horseshoe regions over the past 7 days. Multiple superintendents reporting moderate to severe pressure on greens and approaches. Warm overnight temperatures and high humidity creating ideal conditions for continued spread. This is 3x the normal report rate for mid-March.",
        affected_region: "GTA & Golden Horseshoe",
        affected_companies: dollarSpotCompanyIds,
        contributing_call_ids: dollarSpotCallIds,
        data_points: dollarSpotCallIds.length,
        first_reported_at: new Date(2026, 2, 14).toISOString(),
        last_reported_at: new Date(2026, 2, 20).toISOString(),
        is_active: true,
        recommended_actions: [
          { action: "Alert all reps in affected territories", priority: "high", status: "pending" },
          { action: "Proactively contact accounts without preventive programs", priority: "high", status: "pending" },
          { action: "Verify Banner Maxx II and Heritage stock levels", priority: "urgent", status: "in_progress" },
          { action: "Distribute Dollar Spot identification guide to superintendents", priority: "medium", status: "pending" },
          { action: "Recommend MOA rotation for accounts on single-product programs", priority: "medium", status: "pending" },
        ],
      },
      {
        signal_type: "product_demand_spike",
        severity: "watch",
        title: "Banner Maxx II Demand Spike",
        description: "Banner Maxx II requests have spiked significantly in the past week, driven by the regional Dollar Spot outbreak. Current inventory may not meet projected demand if the trend continues. 4-5 orders placed in the last 5 days versus the typical 1-2 per week.",
        affected_region: "GTA & Golden Horseshoe",
        affected_companies: bannerMaxxCompanyIds,
        contributing_call_ids: bannerMaxxCallIds,
        data_points: bannerMaxxCallIds.length,
        first_reported_at: new Date(2026, 2, 15).toISOString(),
        last_reported_at: new Date(2026, 2, 20).toISOString(),
        is_active: true,
        recommended_actions: [
          { action: "Check distributor stock levels for Banner Maxx II", priority: "urgent", status: "in_progress" },
          { action: "Identify alternative products (Heritage, Instrata) for potential supply shortage", priority: "high", status: "pending" },
          { action: "Notify sales team of potential allocation limits", priority: "medium", status: "pending" },
        ],
      },
      {
        signal_type: "seasonal_pattern",
        severity: "watch",
        title: "Early Season Disease Pressure — Above Normal",
        description: "Disease reports for March 2026 are running 40% above the 3-year average for this period. Warmer-than-normal temperatures in late February and early March have accelerated spring disease emergence. Dollar Spot, Snow Mould recovery issues, and early Anthracnose are all being reported earlier than typical.",
        affected_region: "Province-wide",
        affected_companies: dollarSpotCompanyIds.slice(0, 3),
        contributing_call_ids: allCallLogIds.slice(0, Math.min(15, allCallLogIds.length)),
        data_points: Math.min(15, allCallLogIds.length),
        first_reported_at: new Date(2026, 2, 5).toISOString(),
        last_reported_at: new Date(2026, 2, 20).toISOString(),
        is_active: true,
        recommended_actions: [
          { action: "Distribute early season disease advisory to all accounts", priority: "medium", status: "completed" },
          { action: "Review spring program timelines — consider moving up first applications", priority: "high", status: "pending" },
          { action: "Ensure adequate product inventory for accelerated season start", priority: "high", status: "in_progress" },
        ],
      },
      {
        signal_type: "pricing_concern",
        severity: "info",
        title: "Budget Concerns — Northern Ontario Territory",
        description: "3 accounts in the Northern Ontario territory have flagged budget constraints in recent conversations. Common themes include board-mandated spending cuts and requests for volume discounts or generic alternatives. May affect seasonal program revenue in this territory.",
        affected_region: "Northern Ontario",
        affected_companies: golfCourseIds.slice(0, Math.min(3, golfCourseIds.length)),
        contributing_call_ids: allCallLogIds.slice(-5),
        data_points: 3,
        first_reported_at: new Date(2026, 2, 10).toISOString(),
        last_reported_at: new Date(2026, 2, 18).toISOString(),
        is_active: true,
        recommended_actions: [
          { action: "Prepare budget-friendly program alternatives for affected accounts", priority: "medium", status: "pending" },
          { action: "Identify volume discount opportunities to retain business", priority: "medium", status: "pending" },
          { action: "Schedule face-to-face meetings to discuss value proposition", priority: "low", status: "pending" },
        ],
      },
    ];

    for (const signal of trendSignals) {
      const { error: trendError } = await supabase.from("field_trend_signals").insert(signal);

      if (trendError) {
        console.error(`  ERROR inserting trend signal "${signal.title}":`, trendError.message);
        continue;
      }
      trendsInserted++;
    }

    console.log(`  Trend signals: ${trendsInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 20: Daily Digests (7 days: Mar 14-20, 2026)
  // ----------------------------------------------------------
  console.log("STEP 20: Generating daily digests...\n");

  const { data: existingDigests } = await supabase.from("daily_digests").select("id");
  const existingDigestCount = existingDigests?.length || 0;

  let digestsInserted = 0;

  if (!shouldRun(20)) {
    console.log("  Skipping step 20 (not selected)\n");
  } else if (existingDigestCount > 0 && requestedStep !== 20) {
    console.log(`  ${existingDigestCount} daily digests already exist, skipping\n`);
  } else {
    // Group call logs by day for accurate counts
    const callsByDay = new Map<string, CallLogMeta[]>();
    for (const cl of callLogMetas) {
      const day = cl.createdAt.split("T")[0];
      const arr = callsByDay.get(day) || [];
      arr.push(cl);
      callsByDay.set(day, arr);
    }

    // Build rep name lookup for digest
    const repNameByIdForDigest = new Map<string, string>();
    for (const rep of DEMO_REPS) {
      const rid = repMap.get(rep.territory);
      if (rid) repNameByIdForDigest.set(rid, rep.name);
    }

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const digestDate = new Date(2026, 2, 14 + dayOffset);
      const digestDateStr = digestDate.toISOString().split("T")[0];

      const dayCalls = callsByDay.get(digestDateStr) || [];
      const totalCalls = dayCalls.length;
      const followUpCalls = dayCalls.filter(() => rng() < 0.6).length;

      // Top diseases for this day
      const diseaseCounts = new Map<string, number>();
      for (const cl of dayCalls) {
        for (const d of cl.diseases) {
          diseaseCounts.set(d, (diseaseCounts.get(d) || 0) + 1);
        }
      }
      const topDiseases = Array.from(diseaseCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({
          disease_name: name,
          mention_count: count,
          affected_regions: name === "Dollar Spot" ? ["GTA", "Golden Horseshoe"] : ["Various"],
          trending: name === "Dollar Spot" ? true : count > 2,
        }));

      // If no calls for this day, add realistic baseline data
      if (topDiseases.length === 0) {
        topDiseases.push({
          disease_name: "Dollar Spot",
          mention_count: randomInt(1, 3),
          affected_regions: ["GTA", "Golden Horseshoe"],
          trending: dayOffset >= 3,
        });
      }

      // Top products
      const productCounts = new Map<string, number>();
      for (const cl of dayCalls) {
        for (const p of cl.products) {
          productCounts.set(p, (productCounts.get(p) || 0) + 1);
        }
      }
      const topProducts = Array.from(productCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({
          product_name: name,
          product_id: productMap.get(name) || null,
          request_count: count,
          revenue_potential: count * randomInt(800, 3000),
        }));

      if (topProducts.length === 0) {
        topProducts.push({
          product_name: "Banner Maxx II",
          product_id: productMap.get("Banner Maxx II") || null,
          request_count: randomInt(1, 2),
          revenue_potential: randomInt(2000, 8000),
        });
      }

      // Rep activity breakdown
      const repActivity = new Map<string, { calls: number; followUps: number; companies: Set<string> }>();
      for (const cl of dayCalls) {
        if (!cl.repId) continue;
        const existing = repActivity.get(cl.repId) || { calls: 0, followUps: 0, companies: new Set<string>() };
        existing.calls++;
        if (rng() < 0.6) existing.followUps++;
        existing.companies.add(cl.companyId);
        repActivity.set(cl.repId, existing);
      }
      const repActivityBreakdown = Array.from(repActivity.entries()).map(([repId, data]) => ({
        rep_id: repId,
        rep_name: repNameByIdForDigest.get(repId) || "Unknown Rep",
        calls_logged: data.calls,
        follow_ups_needed: data.followUps,
        top_companies: Array.from(data.companies).slice(0, 3).map((cId) => companyNameByIdForCalls.get(cId) || "Unknown"),
      }));

      // Key highlights
      const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][digestDate.getDay()];
      let keyHighlights = `${dayOfWeek}, ${digestDateStr}: ${totalCalls || randomInt(8, 15)} calls logged across all territories.`;
      if (dayOffset >= 3) {
        keyHighlights += ` Dollar Spot reports continue to increase in the GTA and Golden Horseshoe regions. ${randomInt(2, 4)} new courses reported active outbreaks today.`;
      }
      if (dayOffset >= 5) {
        keyHighlights += ` Banner Maxx II demand at 3x normal levels. Recommend checking distributor inventory. Early season disease pressure running 40% above average.`;
      }
      if (dayOffset < 3) {
        keyHighlights += ` Normal spring activity levels. Reps focused on seasonal program quotation and early spring site visits.`;
      }

      // Alerts
      let alerts = "";
      if (dayOffset >= 4) {
        alerts = "⚠ Dollar Spot outbreak trending in GTA & Golden Horseshoe — proactive outreach recommended. Banner Maxx II stock levels should be monitored.";
      } else if (dayOffset >= 2) {
        alerts = "Dollar Spot reports increasing — monitor closely over next 48 hours.";
      } else {
        alerts = "No active alerts. Normal spring activity.";
      }

      const { error: digestError } = await supabase.from("daily_digests").insert({
        digest_date: digestDateStr,
        total_calls_logged: totalCalls || randomInt(8, 15),
        total_follow_ups_needed: followUpCalls || randomInt(3, 8),
        top_diseases: topDiseases,
        top_products: topProducts,
        rep_activity_breakdown: repActivityBreakdown,
        key_highlights: keyHighlights,
        alerts,
        generated_at: new Date(digestDate.getTime() + 23 * 60 * 60 * 1000).toISOString(), // 11pm that day
      });

      if (digestError) {
        console.error(`  ERROR inserting digest for ${digestDateStr}:`, digestError.message);
        continue;
      }
      digestsInserted++;
    }

    console.log(`  Daily digests: ${digestsInserted} inserted\n`);
  }

  // ----------------------------------------------------------
  // STEP 21: Weather Snapshots — 90 days of history
  // ----------------------------------------------------------
  console.log("STEP 21: Generating weather snapshots...\n");

  const { data: existingWeather } = await supabase.from("weather_snapshots").select("id");
  const existingWeatherCount = existingWeather?.length || 0;

  let weatherInserted = 0;

  if (!shouldRun(21)) {
    console.log("  Skipping step 21 (not selected)\n");
  } else if (existingWeatherCount > 50 && requestedStep !== 21) {
    console.log(`  ${existingWeatherCount} weather snapshots already exist, skipping\n`);
  } else {
    // Find the most active courses — those with the most deals and visits
    const courseActivityScores = new Map<string, number>();
    if (dealsForVisits) {
      for (const d of dealsForVisits) {
        if (d.company_id) {
          courseActivityScores.set(d.company_id, (courseActivityScores.get(d.company_id) || 0) + 1);
        }
      }
    }
    // Also count visit reports
    const { data: visitCompanies } = await supabase
      .from("visit_reports")
      .select("company_id");
    if (visitCompanies) {
      for (const v of visitCompanies) {
        if (v.company_id) {
          courseActivityScores.set(v.company_id, (courseActivityScores.get(v.company_id) || 0) + 2);
        }
      }
    }

    // Sort by score and pick top 10-15
    const sortedCourses = Array.from(courseActivityScores.entries())
      .sort((a, b) => b[1] - a[1]);
    const weatherCourseCount = Math.min(randomInt(10, 15), sortedCourses.length);
    const weatherCourseIds = sortedCourses.slice(0, weatherCourseCount).map(([id]) => id);

    // If not enough scored courses, pad with random golf course IDs
    while (weatherCourseIds.length < 10 && golfCourseIds.length > weatherCourseIds.length) {
      const candidate = golfCourseIds[randomInt(0, golfCourseIds.length - 1)];
      if (!weatherCourseIds.includes(candidate)) {
        weatherCourseIds.push(candidate);
      }
    }

    console.log(`  Generating weather for ${weatherCourseIds.length} courses over 90 days\n`);

    // Ontario monthly weather baselines
    const monthlyBaselines: Record<number, {
      highMin: number; highMax: number;
      lowMin: number; lowMax: number;
      humMin: number; humMax: number;
      rainChance: number; rainMin: number; rainMax: number;
      windMin: number; windMax: number;
    }> = {
      0: { highMin: -5, highMax: -1, lowMin: -12, lowMax: -7, humMin: 70, humMax: 85, rainChance: 0.10, rainMin: 0, rainMax: 3, windMin: 10, windMax: 25 },  // Jan
      1: { highMin: -4, highMax: 1, lowMin: -11, lowMax: -6, humMin: 65, humMax: 80, rainChance: 0.12, rainMin: 0, rainMax: 4, windMin: 10, windMax: 25 },   // Feb
      2: { highMin: 2, highMax: 10, lowMin: -5, lowMax: 2, humMin: 55, humMax: 75, rainChance: 0.30, rainMin: 2, rainMax: 15, windMin: 8, windMax: 22 },      // Mar
    };

    // Generate 90 days: Dec 21, 2025 → Mar 20, 2026
    const weatherStartDate = new Date(2025, 11, 21); // Dec 21
    const WEATHER_DAYS = 90;

    for (const courseId of weatherCourseIds) {
      // Each course gets slight regional variance
      const regionOffset = (rng() - 0.5) * 3; // ±1.5°C
      let gddCumulative = 0;
      let prevHigh: number | null = null;
      let prevLow: number | null = null;

      // Since we start Dec 21 and GDD accumulates from Jan 1, reset at Jan 1
      let daysSinceJan1 = 0;

      for (let d = 0; d < WEATHER_DAYS; d++) {
        const currentDate = new Date(weatherStartDate);
        currentDate.setDate(currentDate.getDate() + d);
        const dateStr = currentDate.toISOString().split("T")[0];
        const month = currentDate.getMonth();

        // December uses January-like baselines
        const baseline = month === 11
          ? { highMin: -4, highMax: 0, lowMin: -10, lowMax: -5, humMin: 70, humMax: 85, rainChance: 0.10, rainMin: 0, rainMax: 3, windMin: 10, windMax: 25 }
          : monthlyBaselines[month];

        if (!baseline) continue;

        // Generate temps with day-to-day continuity (±3°C from previous)
        let tempHigh: number;
        let tempLow: number;

        if (prevHigh !== null && prevLow !== null) {
          tempHigh = prevHigh + (rng() - 0.5) * 6; // ±3°C
          tempHigh = Math.max(baseline.highMin + regionOffset - 2, Math.min(baseline.highMax + regionOffset + 2, tempHigh));
          tempLow = prevLow + (rng() - 0.5) * 6;
          tempLow = Math.max(baseline.lowMin + regionOffset - 2, Math.min(baseline.lowMax + regionOffset + 2, tempLow));
        } else {
          tempHigh = baseline.highMin + regionOffset + rng() * (baseline.highMax - baseline.highMin);
          tempLow = baseline.lowMin + regionOffset + rng() * (baseline.lowMax - baseline.lowMin);
        }

        // Ensure high > low
        if (tempLow >= tempHigh) tempLow = tempHigh - 2 - rng() * 3;

        tempHigh = +tempHigh.toFixed(1);
        tempLow = +tempLow.toFixed(1);
        const tempAvg = +((tempHigh + tempLow) / 2).toFixed(1);

        prevHigh = tempHigh;
        prevLow = tempLow;

        // Rainfall
        const isRainy = rng() < baseline.rainChance;
        const rainfallMm = isRainy ? +(baseline.rainMin + rng() * (baseline.rainMax - baseline.rainMin)).toFixed(1) : 0;

        // Humidity
        const humidityAvg = +(baseline.humMin + rng() * (baseline.humMax - baseline.humMin)).toFixed(0);

        // Wind
        const windAvg = +(baseline.windMin + rng() * (baseline.windMax - baseline.windMin)).toFixed(1);

        // GDD: base 10°C, accumulate from Jan 1
        const isAfterJan1 = currentDate >= new Date(2026, 0, 1);
        const gddDaily = isAfterJan1 ? +Math.max(0, tempAvg - 10).toFixed(1) : 0;
        if (isAfterJan1) {
          gddCumulative = +(gddCumulative + gddDaily).toFixed(1);
        }

        // Spray window: wind < 15 km/h AND no rain AND temp > 5°C
        const isSprayWindow = windAvg < 15 && rainfallMm === 0 && tempHigh > 5;

        const { error: wxError } = await supabase.from("weather_snapshots").insert({
          company_id: courseId,
          snapshot_date: dateStr,
          temp_high_c: tempHigh,
          temp_low_c: tempLow,
          temp_avg_c: tempAvg,
          rainfall_mm: rainfallMm,
          humidity_avg: humidityAvg,
          wind_avg_kmh: windAvg,
          gdd_daily: gddDaily,
          gdd_cumulative: gddCumulative,
          gdd_base_temp_c: 10,
          is_spray_window: isSprayWindow,
          source: "Open-Meteo (demo data)",
        });

        if (wxError) {
          // UNIQUE constraint violation = already exists, skip silently
          if (!wxError.message.includes("duplicate")) {
            console.error(`  ERROR inserting weather for ${dateStr}:`, wxError.message);
          }
          continue;
        }
        weatherInserted++;
      }
    }

    console.log(`  Weather snapshots: ${weatherInserted} inserted for ${weatherCourseIds.length} courses\n`);
  }

  // ----------------------------------------------------------
  // STEP 22: Turf Knowledge Base Enrichment (30-50 entries)
  // ----------------------------------------------------------
  console.log("STEP 22: Enriching turf knowledge base...\n");

  const { data: existingKb } = await supabase
    .from("turf_knowledge_base")
    .select("title");
  const existingKbTitles = new Set<string>();
  if (existingKb) {
    for (const entry of existingKb) {
      existingKbTitles.add(entry.title.toLowerCase());
    }
  }
  console.log(`  Found ${existingKbTitles.size} existing knowledge base entries`);

  let kbInserted = 0;
  let kbSkipped = 0;

  if (!shouldRun(22)) {
    console.log("  Skipping step 22 (not selected)\n");
  } else {

  // All new knowledge base entries
  const newKbEntries: {
    category: string;
    title: string;
    content: string;
    symptoms: string | null;
    conditions: string | null;
    grass_types: string[] | null;
    seasonal_relevance: string[];
    keywords: string[];
    source: string;
  }[] = [
    // ===== GTI FACT SHEET: DOLLAR SPOT — expanded entries =====
    {
      category: "disease",
      title: "Dollar Spot — Cultural Control Strategies",
      content: "Cultural controls are the first line of defense against dollar spot. Maintain adequate nitrogen fertility (low N increases susceptibility dramatically). Remove morning dew by mowing, rolling, or poling before 10 a.m. to disrupt the infection period. Improve air circulation by pruning surrounding vegetation. Avoid drought stress through proper irrigation scheduling — water deeply and infrequently in early morning. Reduce thatch to below 1.5 cm through regular topdressing and aeration.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["dollar spot", "cultural control", "nitrogen", "dew removal", "poling", "air circulation", "thatch"],
      source: "GTI Fact Sheet — Dollar Spot (gti_fact_sheet-dollarspot-aoda.md)",
    },
    {
      category: "disease",
      title: "Dollar Spot — Chemical Control and Resistance Management",
      content: "Dollar spot has developed resistance to multiple fungicide classes, making MOA rotation essential. Rotate among at least 4 FRAC groups: DMI (Group 3), SDHI (Group 7), QoI (Group 11), and multi-site contacts (Group M5/29). Never apply the same MOA group consecutively. Tank mixing two different MOA groups provides additional resistance protection. In Ontario, chlorothalonil (limited to 2 foliar + 1 fall app) remains important as a multi-site rotation partner. Monitor for resistance by tracking efficacy duration after each application.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["dollar spot", "fungicide resistance", "chemical control", "FRAC", "MOA rotation", "tank mix", "chlorothalonil"],
      source: "GTI Fact Sheet — Dollar Spot (gti_fact_sheet-dollarspot-aoda.md)",
    },
    {
      category: "disease",
      title: "Dollar Spot — Conditions Favouring Outbreaks",
      content: "Dollar spot (Clarireedia jacksonii) thrives when daytime temperatures reach 15-30°C with warm humid nights and extended leaf wetness (dew). Heavy outbreaks correlate with drought-stressed turf that has inadequate nitrogen — the pathogen exploits weakened plants. Poor air circulation and shaded areas create microclimates with prolonged leaf wetness. In Ontario, peak pressure occurs June through September, with a secondary window in late spring. The 2026 March outbreak is atypically early, driven by above-normal temperatures.",
      symptoms: "Straw-coloured circular patches 2.5-5.0 cm diameter on closely mowed turf. Individual blades show hourglass-shaped lesions with bleached centers and reddish-brown borders. White cobweb-like aerial mycelium visible at dawn before dew dries.",
      conditions: "Warm days (15-30°C) with humid nights. Prolonged leaf wetness from dew. Drought stress and low nitrogen fertility. Poor air circulation and shade.",
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua", "Fine Fescue"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["dollar spot", "conditions", "humidity", "leaf wetness", "dew", "temperature", "outbreak", "identification"],
      source: "GTI Fact Sheet — Dollar Spot (gti_fact_sheet-dollarspot-aoda.md)",
    },

    // ===== GTI FACT SHEET: GRAY LEAF SPOT =====
    {
      category: "disease",
      title: "Gray Leaf Spot — Identification and Risk Assessment",
      content: "Gray leaf spot (Pyricularia grisea) produces tan to gray lesions with distinctive purple-brown borders on leaf blades. Advanced infections show characteristic 'fishhook' curling of leaf tips. The disease can expand rapidly — going from first symptoms to severe damage in 48-72 hours under ideal conditions. Risk is highest when temperatures are 27-32°C with 14+ hours of leaf wetness. Perennial ryegrass is most susceptible; tall fescue shows moderate resistance.",
      symptoms: "Tan to gray lesions with purple-brown edges on leaf blades. Fishhook curling of leaf tips. Rapid expansion of affected areas within 48-72 hours.",
      conditions: "Optimal 27-32°C. Requires 14+ hours continuous leaf wetness. High humidity. Soil compaction and high nitrogen increase susceptibility.",
      grass_types: ["Perennial Ryegrass", "Tall Fescue", "Bentgrass"],
      seasonal_relevance: ["Summer"],
      keywords: ["gray leaf spot", "pyricularia", "fishhook", "perennial ryegrass", "high temperature", "leaf wetness"],
      source: "GTI Fact Sheet — Gray Leaf Spot (gti_fact_sheet-grayleaf-aoda.md)",
    },
    {
      category: "disease",
      title: "Gray Leaf Spot — Cultural and Chemical Management",
      content: "Preventative management is essential because curative fungicide applications are far less effective once symptoms appear. Cultural controls: reduce leaf wetness duration through morning irrigation and improved air circulation, increase sun exposure, and avoid excess nitrogen in mid to late summer. Fungicide programs should be preventative — begin applications when extended hot humid periods are forecast. QoI (strobilurin) fungicides are effective but resistance has been documented. Rotate MOA groups and avoid consecutive QoI applications.",
      symptoms: null, conditions: null,
      grass_types: ["Perennial Ryegrass", "Tall Fescue", "Bentgrass"],
      seasonal_relevance: ["Summer"],
      keywords: ["gray leaf spot", "preventative", "fungicide", "strobilurin", "QoI", "cultural control", "nitrogen", "resistance"],
      source: "GTI Fact Sheet — Gray Leaf Spot (gti_fact_sheet-grayleaf-aoda.md)",
    },

    // ===== GTI FACT SHEET: MICRODOCHIUM PATCH =====
    {
      category: "disease",
      title: "Microdochium Patch — Year-Round Risk in Cool Wet Conditions",
      content: "Microdochium patch (Microdochium nivale) is unique among snow moulds because it does NOT require snow cover to develop. It is active whenever temperatures are 0-8°C with wet conditions, making it a threat from October through April in Ontario. Fall management is more critical than spring — failing to control the disease in fall leads to significantly worse spring outbreaks. The pathogen survives as mycelium in infected plant debris and can spread through infected clippings, foot traffic, and equipment.",
      symptoms: "Small yellow patches 2-5 cm expanding to 5-20 cm irregular patches. Pinkish-orange margins with white to pink cottony mycelium. Centers may recover creating a 'frog eye' appearance.",
      conditions: "Active 0-8°C in cool wet conditions. Can develop with or without snow cover. Poor drainage, lack of airflow, and excessive thatch increase severity.",
      grass_types: ["Bentgrass", "Poa annua", "Perennial Ryegrass", "Kentucky Bluegrass"],
      seasonal_relevance: ["Fall", "Winter", "Spring"],
      keywords: ["microdochium", "pink snow mould", "fusarium patch", "cool wet", "no snow cover", "fall management", "frog eye"],
      source: "GTI Fact Sheet — Microdochium Patch (gti_fact_sheet-microdochium-aoda.md)",
    },
    {
      category: "disease",
      title: "Microdochium Patch — Fall Prevention Program",
      content: "The fall prevention window for Microdochium patch is critical. Key practices: (1) Improve drainage on problem areas before onset of cool wet weather. (2) Maximize airflow — remove leaf debris, prune overhanging branches. (3) Avoid late-fall nitrogen applications that promote succulent growth. (4) Begin scouting when temperatures consistently drop below 10°C. (5) Apply preventive fungicides before conditions favour infection — do not wait for symptoms. Fludioxonil (Medallion), chlorothalonil, and DMI fungicides provide effective control when applied preventively.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Perennial Ryegrass"],
      seasonal_relevance: ["Fall"],
      keywords: ["microdochium", "fall prevention", "drainage", "fludioxonil", "medallion", "preventive", "scouting"],
      source: "GTI Fact Sheet — Microdochium Patch (gti_fact_sheet-microdochium-aoda.md)",
    },

    // ===== GTI FACT SHEET: RUST =====
    {
      category: "disease",
      title: "Rust — Identification and Cultural Management",
      content: "Turfgrass rust (Puccinia spp.) produces distinctive yellow flecks that develop into raised pustules releasing yellow, orange, or brown spores. The orange spores transfer readily to shoes, equipment, and clothing — a key diagnostic indicator. Rust is primarily a disease of slow-growing, nitrogen-deficient turf. The most effective management is promoting growth: apply light nitrogen (0.25-0.5 kg N/100m²) and irrigate deeply to stimulate leaf turnover. Mowing removes infected tissue. Improving air movement and reducing shade also help.",
      symptoms: "Yellow flecks on leaf blades expanding to raised pustules. Pustules release yellow, orange, or brown powdery spores. Spores transfer to clothing and equipment. Severe infections cause leaf dieback.",
      conditions: "Temperatures above 16°C. Evening dew periods exceeding 10 hours. Poor airflow and drainage. Nitrogen deficiency. Shade stress.",
      grass_types: ["Kentucky Bluegrass", "Perennial Ryegrass", "Fine Fescue"],
      seasonal_relevance: ["Summer", "Fall"],
      keywords: ["rust", "puccinia", "orange spores", "nitrogen deficiency", "cultural management", "slow growth", "pustules"],
      source: "GTI Fact Sheet — Rust (gti_fact_sheet-rust-aoda.md)",
    },
    {
      category: "disease",
      title: "Rust — When Chemical Control Is Warranted",
      content: "Chemical control for rust is rarely necessary — nitrogen application and cultural practices resolve most outbreaks. However, on high-visibility turf (greens surrounds, tees, clubhouse areas) where cosmetic standards are strict, preventative fungicide applications may be justified. DMI fungicides (propiconazole, myclobutanil) and QoI strobilurins (azoxystrobin) provide good control. Apply preventatively when conditions favour rust and turf growth is slow. Removing alternate host plants (certain woody species) in surrounding areas can reduce inoculum pressure.",
      symptoms: null, conditions: null,
      grass_types: ["Kentucky Bluegrass", "Perennial Ryegrass", "Fine Fescue"],
      seasonal_relevance: ["Summer", "Fall"],
      keywords: ["rust", "chemical control", "DMI", "propiconazole", "strobilurin", "preventative", "high visibility"],
      source: "GTI Fact Sheet — Rust (gti_fact_sheet-rust-aoda.md)",
    },

    // ===== OMAFRA PUB 845 — IPM PRINCIPLES =====
    {
      category: "cultural_practice",
      title: "IPM Fundamentals for Ontario Golf Courses",
      content: "Integrated Pest Management (IPM) is a systematic approach that combines cultural, biological, and chemical controls to manage pests with minimal environmental impact. The IPM process follows a cycle: (1) Plan — set realistic objectives and categorize sites by quality expectations. (2) Identify — correctly diagnose problems before treating. (3) Scout — monitor pest populations against established thresholds. (4) Decide — intervene only when thresholds are exceeded. (5) Act — select the least disruptive effective control. (6) Record — document all actions for compliance and trend analysis.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer", "Fall", "Winter"],
      keywords: ["IPM", "integrated pest management", "principles", "scouting", "thresholds", "decision making", "planning"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Site Classification for IPM Programs (Class A/B/C)",
      content: "Effective IPM programs categorize turf areas by quality expectations. Class A (highest): greens, tees, and high-visibility areas — lowest pest thresholds, most frequent scouting (2+ times/year), highest management intensity. Class B (moderate): fairways — moderate thresholds, annual scouting, standard maintenance. Class C (lowest): roughs, out-of-play areas — highest pest thresholds, minimal intervention, naturalized management acceptable. This classification prevents over-treating low-priority areas and focuses resources where they matter most.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["site classification", "class A", "class B", "class C", "greens", "fairways", "rough", "thresholds", "IPM"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Fertilization Best Practices — Balanced Nutrition Program",
      content: "A balanced fertility program is the foundation of healthy turf and disease resistance. Ontario recommendation: 0.5 kg N/100m² applied 4 times annually — this can reduce weed cover to less than 5% over 5 seasons. Key principles: (1) Soil test annually to guide P and K applications. (2) Avoid late-fall nitrogen that promotes succulent growth susceptible to snow mould. (3) Excessive summer nitrogen increases brown patch, Pythium, and gray leaf spot risk. (4) Insufficient nitrogen increases dollar spot and red thread. (5) Potassium supports winter hardiness and stress tolerance. (6) Maintain soil pH 6.0-7.0 for optimal nutrient availability.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Fine Fescue"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["fertilization", "nitrogen", "potassium", "phosphorus", "soil test", "pH", "balanced nutrition", "weed reduction"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Water Management — Irrigation Scheduling and Conservation",
      content: "Proper irrigation management directly impacts disease pressure and turf health. Schedule irrigation based on evapotranspiration (ET) rates, not a fixed calendar. Water deeply (2.0-2.5 cm per application) and infrequently to promote deep root growth. Always irrigate in early morning to minimize leaf wetness duration. Test water quality annually for pH, bicarbonates, sodium, and salinity. Turfgrass salinity tolerance varies: bentgrass tolerates up to 3 dS/m, while Kentucky bluegrass is sensitive above 2 dS/m. Reduce irrigation June-July to deter European chafer egg-laying.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Fine Fescue"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["irrigation", "water management", "evapotranspiration", "ET", "deep watering", "salinity", "water quality", "conservation"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "regulation",
      title: "Ontario Pesticide Regulatory Framework — Key Requirements",
      content: "Ontario golf courses operate under a layered regulatory framework. Federal: all products must have Health Canada PMRA PCP registration; the product label is a legal document. Provincial: Ontario's cosmetic pesticide ban (O. Reg. 63/09) exempts golf courses only if IPM accredited. Municipal: some municipalities impose additional restrictions. Key compliance requirements: (1) IPM Council registration and accreditation. (2) Annual pesticide use reporting by January 31. (3) Pesticide warning signs posted per regulation. (4) All applicators must hold Ontario Landscape Exterminator License. (5) Spray records maintained for audit.",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer", "Fall", "Winter"],
      keywords: ["regulation", "Ontario", "PMRA", "cosmetic ban", "IPM accreditation", "compliance", "license", "reporting"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Resistance Management — Preventing Fungicide Failure",
      content: "Fungicide resistance develops when the same mode of action is applied repeatedly, selecting for resistant pathogen populations. Ontario best practices: (1) Never apply the same FRAC group in consecutive applications. (2) Rotate among at least 3-4 MOA groups per season. (3) Include multi-site contact fungicides (chlorothalonil, mancozeb) which have low resistance risk. (4) Tank mix two different MOA groups for applications targeting dollar spot (highest resistance risk). (5) Use curative rates only when needed — they accelerate resistance. (6) Document all applications and track MOA usage per season.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Kentucky Bluegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["resistance management", "fungicide resistance", "MOA rotation", "FRAC group", "multi-site", "tank mix", "prevention"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Weed Scouting Methods — Transect and Grid Systems",
      content: "Accurate weed scouting enables threshold-based management decisions. Transect method: walk a straight line across the area, recording weed species and density at regular intervals. Grid method: divide the area into a grid, sample each cell. Center-line method: scout along the center of fairways. Record weed cover as percentage of total area. Action thresholds vary by site class: Class A (greens/tees) = 1-2% weed cover; Class B (fairways) = 5-10%; Class C (rough) = 15-25%. Always identify weeds to species before selecting control methods — broadleaf vs grassy weeds require different approaches.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["weed scouting", "transect", "grid", "threshold", "weed cover", "identification", "broadleaf", "grassy"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Insect Scouting Techniques — Soap Flush, Flotation, and Traps",
      content: "Different insect pests require different scouting techniques. Soap flush: mix 30 mL dish soap in 7L water, pour over 0.1m² area — surface insects (chinch bugs, sod webworms) come to the surface within 10 minutes. Cup cutter/soil sampling: cut 10 cm deep plugs to inspect root zone for white grubs — count per 0.1m². Flotation: remove a turf plug, place in salt water solution — ABW larvae float to surface. Pitfall traps: buried cups capture crawling insects. Visual inspection: check for frass, tunneling, and bird feeding activity (indicator of grubs).",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["insect scouting", "soap flush", "cup cutter", "flotation", "pitfall trap", "grub", "chinch bug", "ABW"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Turfgrass Species Selection for Ontario Conditions",
      content: "Selecting the right turfgrass species is the most impactful long-term management decision. Ontario greens: creeping bentgrass dominates (cut at 3.0-4.0 mm) with Poa annua as a common contaminant. Fairways: Kentucky bluegrass or Kentucky bluegrass/perennial ryegrass blends. Roughs: fine fescue blends for low-maintenance areas, Kentucky bluegrass for maintained rough. Sports turf: Kentucky bluegrass/perennial ryegrass blend for wear tolerance. Velvet bentgrass offers superior disease resistance on greens but requires specialized management. Always consult NTEP trial data for cultivar-specific performance in Ontario.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Fine Fescue", "Tall Fescue", "Poa annua"],
      seasonal_relevance: ["Spring", "Fall"],
      keywords: ["species selection", "bentgrass", "Kentucky bluegrass", "fine fescue", "ryegrass", "NTEP", "cultivar", "Ontario"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },

    // ===== OMAFRA — DISEASE-SPECIFIC IPM =====
    {
      category: "disease",
      title: "Disease Triangle — Understanding Disease Development",
      content: "All turfgrass diseases require three conditions simultaneously: (1) A susceptible host plant, (2) A virulent pathogen, and (3) Favourable environmental conditions. Removing any one element prevents disease. IPM focuses on reducing host susceptibility (proper species selection, cultural practices, adequate nutrition) and modifying the environment (irrigation timing, air circulation, drainage). Chemical control targets the pathogen directly but should be the last resort after cultural practices are optimized. Understanding the disease triangle helps superintendents predict and prevent outbreaks rather than reacting to them.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer", "Fall", "Winter"],
      keywords: ["disease triangle", "host", "pathogen", "environment", "prevention", "susceptibility", "IPM fundamentals"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "disease",
      title: "Winter Disease Diagnosis — Gray vs Pink Snow Mould",
      content: "Distinguishing gray snow mould (Typhula spp.) from pink snow mould (Microdochium nivale) is critical for management. Gray snow mould: requires 60+ days continuous snow cover; produces dark sclerotia (hard resting bodies) visible in infected tissue; grayish-white mycelium; circular matted patches after snow melt. Pink snow mould: does NOT require snow cover; active in cool wet conditions (0-8°C); pinkish-orange margins; no sclerotia produced. Key management difference: gray requires pre-snow fungicide only; pink can require treatment throughout cool wet periods in fall and spring.",
      symptoms: "Gray: bleached matted turf with dark sclerotia after snowmelt. Pink: yellow patches with pink-orange edges, white-pink mycelium, possible frog-eye centers.",
      conditions: "Gray: 60+ days snow cover, -5 to 5°C. Pink: 0-8°C, wet conditions, with or without snow.",
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Fall", "Winter", "Spring"],
      keywords: ["snow mould", "gray vs pink", "diagnosis", "sclerotia", "typhula", "microdochium", "winter disease"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },

    // ===== PESTICIDE DATA — INDUSTRY STATISTICS =====
    {
      category: "regulation",
      title: "Ontario Golf Course Pesticide Usage Statistics",
      content: "Analysis of Ontario golf course pesticide use reveals key patterns: fungicides account for approximately 85% of total pesticide weight applied, with herbicides at 10% and insecticides at 5%. The top 5 active ingredients represent 81% of total usage by weight. Private courses apply disproportionately more — 3 private courses in the Blue Mountain watershed apply 68% of all pesticide by weight despite being 43% of courses. Total pesticide use across 7 Blue Mountain watershed courses was 1,401 kg/year (2022), a 3% decrease from 2021.",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["pesticide usage", "statistics", "Ontario", "fungicide share", "private courses", "Blue Mountain", "industry data"],
      source: "Ontario Golf Course Pesticide Data — Aggregate Usage Data (Blue Mountain Watershed Trust, 2022)",
    },
    {
      category: "regulation",
      title: "Golf Course vs Agricultural Pesticide Application Rates",
      content: "Golf courses apply pesticides at significantly higher rates per hectare than agricultural operations — up to 7 times the average farm application rate per hectare. This reflects the intensive management required for turf surfaces, particularly putting greens where disease tolerance is near zero. The higher per-hectare rate is offset by the relatively small total area treated compared to farms. This disparity makes precise application, proper calibration, and IPM practices especially important for golf course environmental stewardship.",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["application rate", "golf vs agriculture", "per hectare", "environmental impact", "calibration", "stewardship"],
      source: "Ontario Golf Course Pesticide Data — Aggregate Usage Data (Blue Mountain Watershed Trust, 2022)",
    },
    {
      category: "regulation",
      title: "Neonicotinoid Phase-Out Trends on Ontario Golf Courses",
      content: "Ontario golf courses have significantly reduced neonicotinoid use. Clothianidin and thiamethoxam have been completely discontinued. Imidacloprid (Merit) remains registered but accounts for only 0.32% of total pesticide weight (#17 ranked), down from a historically much higher share. The shift is driven by pollinator protection concerns and the availability of effective reduced-risk alternatives, particularly chlorantraniliprole (Acelepryn, Group 28 diamide). Superintendents should plan complete transition away from neonicotinoids where alternatives exist.",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer"],
      keywords: ["neonicotinoid", "imidacloprid", "phase-out", "pollinator", "acelepryn", "reduced risk", "trend"],
      source: "Ontario Golf Course Pesticide Data — Aggregate Usage Data (Blue Mountain Watershed Trust, 2022)",
    },

    // ===== ACTIVE INGREDIENTS — KEY ENTRIES =====
    {
      category: "product_tip",
      title: "Chlorothalonil (Daconil/Bravo) — Most Used Fungicide in Ontario",
      content: "Chlorothalonil is a multi-site contact fungicide (FRAC Group M5) and the #1 most used active ingredient on Ontario golf courses, accounting for an estimated 40-55% of all fungicide weight applied. It provides broad-spectrum control of dollar spot, brown patch, leaf spot, anthracnose, and snow mould. PMRA restrictions (May 2020) limit use to 2 foliar applications + 1 fall snow mould application per season, with soluble packaging mandated. Strategic allocation is essential: reserve applications for highest-pressure periods and the critical fall snow mould window.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["chlorothalonil", "daconil", "bravo", "multi-site", "M5", "PMRA restriction", "most used", "broad spectrum"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Propiconazole (Banner Maxx) — DMI Workhorse for Dollar Spot",
      content: "Propiconazole is a DMI fungicide (FRAC Group 3) and one of the most widely used systemic fungicides on Ontario golf courses. Banner Maxx II is the primary trade name. Highly effective against dollar spot, brown patch, anthracnose, summer patch, and rusts. As a systemic fungicide, it is absorbed and translocated within the plant for both preventive and curative activity. DMI resistance in dollar spot populations has been documented — must be rotated with other MOA groups. Typically used at 2-4 week intervals during peak disease season.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["propiconazole", "banner maxx", "DMI", "group 3", "systemic", "dollar spot", "brown patch", "rotation"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Azoxystrobin (Heritage) — QoI Strobilurin Fungicide",
      content: "Azoxystrobin (Heritage, Heritage TL) is a QoI strobilurin fungicide (FRAC Group 11) with high usage on Ontario courses. Effective against brown patch, anthracnose, Pythium, and dollar spot. QoI fungicides inhibit mitochondrial respiration — they are highly effective but have a HIGH risk of resistance development. Never apply more than 2 consecutive Group 11 applications. Always alternate with different MOA groups. Heritage TL (turf and landscape) formulation provides extended residual activity. Best used as part of a multi-MOA rotation program.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["azoxystrobin", "heritage", "QoI", "strobilurin", "group 11", "resistance risk", "brown patch", "anthracnose"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Iprodione (Rovral/Chipco 26019) — Dicarboximide Contact Fungicide",
      content: "Iprodione is a dicarboximide fungicide (FRAC Group 2) with high usage on Ontario golf courses. Effective against dollar spot, brown patch, leaf spot, and snow mould. Primarily a contact fungicide with some local systemic activity. Provides good control when applied preventively. Resistance has been documented in dollar spot populations. Should be rotated with other MOA groups. Available as Rovral and Chipco 26019 formulations. Often used in tank mixes with systemic fungicides for broader spectrum activity.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["iprodione", "rovral", "chipco", "dicarboximide", "group 2", "contact", "dollar spot", "snow mould"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Fosetyl-Al (Aliette/Chipco Signature) — Phosphonate for Pythium",
      content: "Fosetyl-aluminum is a phosphonate fungicide (FRAC Group P07) with moderate-to-high usage on Ontario courses. Primary targets are Pythium species (blight and root rot), downy mildew, and Phytophthora. Unique mode of action stimulates the plant's own defense responses in addition to direct fungicidal activity. Low resistance risk due to multiple mechanisms. Applied as a foliar spray, it is translocated both upward and downward in the plant. Chipco Signature formulation is specifically designed for turfgrass. Essential component of summer Pythium prevention programs.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Perennial Ryegrass"],
      seasonal_relevance: ["Summer"],
      keywords: ["fosetyl-al", "aliette", "chipco signature", "phosphonate", "P07", "pythium", "defense response", "low resistance"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Boscalid (Emerald/Pristine) — SDHI Fungicide",
      content: "Boscalid is an SDHI fungicide (FRAC Group 7) with moderate usage on Ontario courses. Effective against dollar spot and brown patch. SDHI fungicides inhibit succinate dehydrogenase in the fungal respiration pathway. Moderate resistance risk — cross-resistance within SDHI group has been documented. Must be rotated with non-SDHI MOA groups. Pristine is a combination product (boscalid + pyraclostrobin) providing dual MOA in a single application. Emerald provides targeted dollar spot control. Key member of the MOA rotation toolkit.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["boscalid", "emerald", "pristine", "SDHI", "group 7", "dollar spot", "brown patch", "rotation"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Fluazinam (Secure) — Pyridinamine Multi-Target Fungicide",
      content: "Fluazinam is a pyridinamine fungicide (FRAC Group 29) with moderate usage on Ontario courses. Effective against dollar spot, Microdochium patch, anthracnose, and brown patch. Acts as an uncoupler of oxidative phosphorylation — a unique mode of action that provides excellent resistance management value. Contact activity with some local penetration. Particularly valuable in the fall snow mould tank mix as an alternative to chlorothalonil when application limits are reached. Rain-fast within 1-2 hours of application.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Kentucky Bluegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["fluazinam", "secure", "pyridinamine", "group 29", "resistance management", "microdochium", "snow mould", "dollar spot"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Fludioxonil (Medallion) — Phenylpyrrole for Snow Mould and Dollar Spot",
      content: "Fludioxonil is a phenylpyrrole fungicide (FRAC Group 12) with moderate usage on Ontario courses. Effective against dollar spot, brown patch, Microdochium patch, and snow mould. Contact activity with excellent residual. Particularly valued in fall snow mould programs — often tank mixed with a DMI (Banner Maxx) for synergistic activity: Medallion (Group 12) + Banner Maxx (Group 3) is a proven Ontario combination. Low resistance risk due to multi-site-like activity within its target. Good rotation partner for SDHI and QoI fungicides.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Summer", "Fall"],
      keywords: ["fludioxonil", "medallion", "phenylpyrrole", "group 12", "snow mould", "dollar spot", "tank mix", "banner maxx"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Chlorantraniliprole (Acelepryn) — Preferred Insecticide for Ontario Golf",
      content: "Chlorantraniliprole is a diamide insecticide (IRAC Group 28) and the preferred insecticide on Ontario golf courses due to its reduced-risk classification. Controls white grubs (European chafer, Japanese beetle), sod webworms, cutworms, and annual bluegrass weevil with a single application. Long residual activity (2-4 months). Low toxicity to pollinators, earthworms, and non-target organisms. Timing is critical: for grubs, apply May-June before egg-laying; for ABW, time to adult migration at 200-300 GDD base 10°C. Apply with sufficient water volume to move product into root zone.",
      symptoms: null, conditions: null,
      grass_types: ["Kentucky Bluegrass", "Bentgrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer"],
      keywords: ["chlorantraniliprole", "acelepryn", "diamide", "group 28", "reduced risk", "grub", "ABW", "pollinator safe"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "2,4-D / Mecoprop / Dicamba — Broadleaf Herbicide Combinations",
      content: "The combination of 2,4-D, mecoprop-p (MCPP), and dicamba (available as Par III, Killex) is the most widely used broadleaf herbicide on Ontario golf courses. All are synthetic auxin herbicides (HRAC Group 4). Effective against dandelion, clover, plantain, and most common broadleaf weeds. Classified as unlisted/Class 9 pesticides under Ontario regulations — golf course exemption with IPM accreditation required. Best results in spring and fall when weeds are actively growing. Spot treatment preferred over broadcast to minimize environmental impact. Apply when temperatures are 15-25°C.",
      symptoms: null, conditions: null,
      grass_types: ["Kentucky Bluegrass", "Perennial Ryegrass", "Fine Fescue"],
      seasonal_relevance: ["Spring", "Fall"],
      keywords: ["2,4-D", "mecoprop", "dicamba", "par III", "killex", "broadleaf", "herbicide", "auxin", "group 4"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Metalaxyl/Mefenoxam (Subdue Maxx) — Pythium Specialist",
      content: "Mefenoxam is a phenylamide fungicide (FRAC Group 4) that is the primary tool for Pythium blight and Pythium root rot on Ontario golf courses. Highly systemic with both preventive and curative activity against oomycete pathogens. Must be applied preventively before hot humid weather events (>25°C with saturated conditions) for best results. High resistance risk — always rotate with fosetyl-Al or other non-Group 4 Pythium products. Subdue Maxx is the primary turfgrass formulation. Essential to have on hand during July-August heat events.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Perennial Ryegrass", "Poa annua"],
      seasonal_relevance: ["Summer"],
      keywords: ["metalaxyl", "mefenoxam", "subdue maxx", "phenylamide", "group 4", "pythium", "oomycete", "preventive"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Mefentrifluconazole (Maxtima) — Next-Generation DMI",
      content: "Mefentrifluconazole (Revysol technology, marketed as Maxtima by BASF) is a newer DMI fungicide (FRAC Group 3) gaining adoption on Ontario courses. It offers improved efficacy against dollar spot, anthracnose, summer patch, and fairy ring compared to older DMIs. The isopropanol-azole structure provides better binding affinity to the target enzyme, maintaining efficacy even against DMI-shifted pathogen populations. Good fit for programs where propiconazole efficacy has declined. Use as part of MOA rotation — still Group 3, so do not apply consecutively with other DMIs.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Kentucky Bluegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["mefentrifluconazole", "maxtima", "revysol", "BASF", "DMI", "group 3", "next generation", "dollar spot", "anthracnose"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Difenoconazole + Benzovindiflupyr (Ascernity) — Dual MOA Combination",
      content: "Ascernity combines difenoconazole (DMI, FRAC Group 3) with benzovindiflupyr/Solatenol (SDHI, FRAC Group 7) in a single product. This dual MOA approach provides inherent resistance management in every application. Effective against dollar spot, brown patch, and anthracnose. Newer product gaining market share on Ontario courses. The combination provides both systemic and local activity. Fits well in programs where single-MOA products are showing reduced efficacy. Recommended as a rotation partner rather than a season-long sole product to preserve efficacy of both MOA groups.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["ascernity", "difenoconazole", "benzovindiflupyr", "solatenol", "DMI", "SDHI", "dual MOA", "combination"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Trinexapac-ethyl (Primo Maxx) — Growth Regulation for Turf Quality",
      content: "Trinexapac-ethyl (Primo Maxx) is a plant growth regulator (PGR) with high usage on Ontario golf courses. Though classified with herbicides, it functions by inhibiting gibberellic acid biosynthesis, reducing vertical growth by up to 50%. Benefits: increased turf density, improved stress tolerance, reduced mowing frequency, more consistent putting surfaces. Can be tank mixed with most fungicides. Rebound growth occurs 3-4 weeks after application and may increase disease susceptibility briefly. Not a pesticide in the traditional sense — primarily a turf quality management tool.",
      symptoms: null, conditions: null,
      grass_types: ["Bentgrass", "Poa annua", "Kentucky Bluegrass", "Perennial Ryegrass"],
      seasonal_relevance: ["Spring", "Summer"],
      keywords: ["trinexapac-ethyl", "primo maxx", "PGR", "growth regulator", "density", "mowing reduction", "gibberellic acid"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },
    {
      category: "product_tip",
      title: "Spinosad (Conserve) — Reduced-Risk Insecticide for Surface Feeders",
      content: "Spinosad is a spinosyn insecticide (IRAC Group 5) derived from a naturally occurring soil bacterium. Effective against caterpillars, sod webworms, and other surface-feeding insects. Classified as reduced risk with lower environmental impact than conventional insecticides. Works through both contact and ingestion. Best applied in late afternoon when target insects are most active. Rapid breakdown in sunlight — apply in evening for maximum residual. Compatible with IPM programs due to low toxicity to most beneficial insects. Limited activity against grubs (root feeders).",
      symptoms: null, conditions: null,
      grass_types: ["Kentucky Bluegrass", "Perennial Ryegrass", "Bentgrass"],
      seasonal_relevance: ["Summer"],
      keywords: ["spinosad", "conserve", "spinosyn", "group 5", "reduced risk", "caterpillar", "sod webworm", "biological"],
      source: "Ontario Golf Course Pesticide Data — Active Ingredients Reference",
    },

    // ===== OMAFRA — ADDITIONAL IPM TOPICS =====
    {
      category: "pest",
      title: "Sod Webworm — Identification and Management",
      content: "Sod webworms (Crambus spp.) are caterpillar larvae that feed on grass blades near the soil surface, creating irregular brown patches. Adults are buff-coloured moths that fly in a zigzag pattern at dusk over the turf. Larvae live in silk-lined tunnels in the thatch layer and feed at night. Damage appears as irregular brown patches with chewed leaf blades. Soap flush is the primary scouting method. Action threshold: 15+ larvae per 0.1m² in Class A turf. Chlorantraniliprole (Acelepryn) and spinosad (Conserve) are effective reduced-risk controls.",
      symptoms: "Irregular brown patches with ragged-cut leaf blades. Buff moths flying at dusk. Green frass pellets in thatch. Larvae in silk-lined tunnels visible when thatch is pulled back.",
      conditions: "Active May-September. Peak damage in late summer. Warm dry conditions favour population buildup.",
      grass_types: ["Kentucky Bluegrass", "Perennial Ryegrass", "Bentgrass"],
      seasonal_relevance: ["Summer"],
      keywords: ["sod webworm", "crambus", "caterpillar", "moth", "soap flush", "thatch", "night feeding", "acelepryn"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "pest",
      title: "Black Cutworm — Greens Pest with Ball Mark Damage",
      content: "Black cutworm (Agrotis ipsilon) larvae create distinctive circular depressions on putting greens by feeding on leaf tissue and burrowing into the turf surface. Damage is often confused with ball marks. Adults migrate from southern regions each spring — they do not overwinter in Ontario. Monitor with pheromone traps to detect adult arrival. Larvae feed at night and hide in burrows during the day. Soap flush or night inspection with flashlight are effective scouting methods. Chlorantraniliprole provides good preventive control. Spot treatment is often sufficient.",
      symptoms: "Small circular depressions on greens resembling ball marks. Holes 1-2 cm diameter with frass. Larvae feed at night and retreat into burrows.",
      conditions: "Adults migrate north in spring. Larvae active May-September. Night feeding makes daytime scouting difficult.",
      grass_types: ["Bentgrass", "Poa annua"],
      seasonal_relevance: ["Spring", "Summer"],
      keywords: ["black cutworm", "agrotis", "greens", "ball mark", "pheromone trap", "night feeding", "migration"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "cultural_practice",
      title: "Golf Course IPM Accreditation — Program Requirements",
      content: "Ontario golf courses must maintain IPM accreditation to use unlisted pesticides. The IPM Council of Canada administers the program. Requirements: (1) Register with the IPM Council. (2) Achieve accreditation within 2 years of registration. (3) Designate an IPM Certified Agent (must hold Ontario Landscape Exterminator License + IPM exam via University of Guelph). (4) Complete 6 hours/year continuing education. (5) Submit annual desk review documentation. (6) Pass triennial on-site audit. (7) Post annual pesticide use report on IPM Council website by January 31. (8) Maintain all scouting and application records.",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer", "Fall", "Winter"],
      keywords: ["IPM accreditation", "IPM Council", "certified agent", "audit", "documentation", "license", "continuing education"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
    {
      category: "regulation",
      title: "Pesticide Posting Signs — Ontario Requirements",
      content: "Ontario golf courses must post warning signs when pesticides are applied. Two sign types are required: Sign F for unlisted (Class 9) pesticide applications — must include product name, PCP number, and date of application. Sign E for Allowable List products — simpler posting requirements. Signs must be posted at all access points to treated areas and remain in place for the minimum duration specified by regulation. Failure to post signs is a regulatory violation that can jeopardize IPM accreditation and the golf course exemption from the cosmetic pesticide ban.",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer", "Fall"],
      keywords: ["posting signs", "sign F", "sign E", "warning", "notification", "regulatory", "compliance", "cosmetic ban"],
      source: "OMAFRA Publication 845; Ontario Regulation 63/09",
    },
    {
      category: "regulation",
      title: "IPM Record Keeping — Required Forms and Documentation",
      content: "Complete IPM documentation is mandatory for accreditation. Required records: (1) Scouting forms — date, location, pest identified, population count, threshold comparison, action taken or deferred. (2) Pest Control Products Application forms — product name, PCP number, active ingredient, area treated, rate applied, weather conditions, applicator name. (3) Sprayer calibration records — date, nozzle type, pressure, speed, output per hectare. (4) Staff IPM training records — dates, topics, attendees. (5) Annual Class 9 pesticide use summary. All records must be retained for the triennial audit cycle (3 years minimum).",
      symptoms: null, conditions: null,
      grass_types: null,
      seasonal_relevance: ["Spring", "Summer", "Fall", "Winter"],
      keywords: ["record keeping", "documentation", "scouting form", "application form", "calibration", "IPM audit", "compliance"],
      source: "OMAFRA Publication 845 — Integrated Pest Management for Turf",
    },
  ];

  // Insert entries, skipping duplicates by title
  for (const entry of newKbEntries) {
    if (existingKbTitles.has(entry.title.toLowerCase())) {
      kbSkipped++;
      continue;
    }

    const { error: kbError } = await supabase.from("turf_knowledge_base").insert({
      category: entry.category,
      title: entry.title,
      content: entry.content,
      symptoms: entry.symptoms,
      conditions: entry.conditions,
      grass_types: entry.grass_types,
      seasonal_relevance: entry.seasonal_relevance,
      keywords: entry.keywords,
      source: entry.source,
    });

    if (kbError) {
      console.error(`  ERROR inserting KB entry "${entry.title}":`, kbError.message);
      continue;
    }
    existingKbTitles.add(entry.title.toLowerCase());
    kbInserted++;
  }

  console.log(`  Knowledge base: ${kbInserted} inserted, ${kbSkipped} skipped (already exist)\n`);
  } // end shouldRun(22)

  // ----------------------------------------------------------
  // Save maps to JSON for subsequent prompts
  // ----------------------------------------------------------
  const mapPath = path.resolve(__dirname, "company-map.json");
  const mapObj: Record<string, string> = {};
  for (const [k, v] of companyMap) {
    mapObj[k] = v;
  }
  fs.writeFileSync(mapPath, JSON.stringify(mapObj, null, 2));

  const productMapPath = path.resolve(__dirname, "product-map.json");
  const productMapObj: Record<string, string> = {};
  for (const [k, v] of productMap) {
    productMapObj[k] = v;
  }
  fs.writeFileSync(productMapPath, JSON.stringify(productMapObj, null, 2));

  console.log(`Company map saved to ${mapPath}`);
  console.log(`Product map saved to ${productMapPath}\n`);

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------
  console.log("=== Import Summary ===");
  console.log(`  Golf course companies: ${companiesInserted} inserted, ${companiesSkipped} skipped`);
  console.log(`  Supplier companies:    ${suppliersInserted} inserted, ${suppliersSkipped} skipped`);
  console.log(`  Course profiles:       ${profilesInserted} inserted, ${profilesSkipped} skipped`);
  console.log(`  Contacts:              ${contactsInserted} inserted, ${contactsSkipped} skipped`);
  console.log(`  Products:              ${productsInserted} inserted, ${productsSkipped} skipped`);
  console.log(`  Sales reps:            ${repsCreated} created`);
  console.log(`  Deals:                 ${dealsInserted} inserted, ${dealItemsInserted} line items`);
  console.log(`  Activities:            ${activitiesInserted} inserted`);
  console.log(`  Calendar events:       ${eventsInserted} inserted`);
  console.log(`  Visit reports:         ${visitsInserted} inserted`);
  console.log(`  Observations:          ${observationsInserted} inserted`);
  console.log(`  Recommendations:       ${recommendationsInserted} inserted`);
  console.log(`  Treatment programs:    ${programsInserted} inserted`);
  console.log(`  Program tasks:         ${programTasksInserted} inserted`);
  console.log(`  Call logs:             ${callLogsInserted} inserted (${dollarSpotCallIds.length} dollar spot, ${bannerMaxxCallIds.length} Banner Maxx)`);
  console.log(`  Extractions:           ${extractionsInserted} inserted`);
  console.log(`  Rep nudges:            ${nudgesInserted} inserted`);
  console.log(`  Trend signals:         ${trendsInserted} inserted`);
  console.log(`  Daily digests:         ${digestsInserted} inserted`);
  console.log(`  Weather snapshots:     ${weatherInserted} inserted`);
  console.log(`  Knowledge base:        ${kbInserted} inserted, ${kbSkipped} skipped`);
  console.log(`  Company name→ID map:   ${companyMap.size} entries`);
  console.log(`  Product name→ID map:   ${productMap.size} entries`);
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

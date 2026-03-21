#!/usr/bin/env npx tsx
/**
 * Allturf CRM API CLI — TypeScript helper for Claude skills to call v1 endpoints.
 *
 * Usage:
 *   npx tsx scripts/crm-api.ts <entity> <action> [--key=value ...]
 *
 * Examples:
 *   npx tsx scripts/crm-api.ts contacts list --status=Active+Customer --limit=10
 *   npx tsx scripts/crm-api.ts contacts get --id=uuid
 *   npx tsx scripts/crm-api.ts contacts create --first_name=Test --last_name=User
 *   npx tsx scripts/crm-api.ts deals list --stage=Quote+Sent
 *   npx tsx scripts/crm-api.ts courses list
 *   npx tsx scripts/crm-api.ts products get --id=uuid
 *   npx tsx scripts/crm-api.ts diseases list --type=Disease --ontario_common=true
 *   npx tsx scripts/crm-api.ts visits list --company_id=uuid
 *   npx tsx scripts/crm-api.ts weather list --company_id=uuid
 *   npx tsx scripts/crm-api.ts programs list
 *   npx tsx scripts/crm-api.ts knowledge list --category=disease
 *
 * Environment:
 *   PROJECT_SYNC_API_KEY — Bearer token (required)
 *   CRM_API_URL — Base URL (default: http://localhost:3000)
 */

const BASE_URL = process.env.CRM_API_URL ?? "http://localhost:3000";
const API_KEY = process.env.PROJECT_SYNC_API_KEY;

if (!API_KEY) {
  console.error(JSON.stringify({ success: false, error: "PROJECT_SYNC_API_KEY not set" }));
  process.exit(1);
}

// ---------- Arg parsing ----------

const [, , entity, action, ...rawArgs] = process.argv;

if (!entity || !action) {
  console.error(JSON.stringify({
    success: false,
    error: "Usage: crm-api.ts <entity> <action> [--key=value ...]\nEntities: contacts, companies, courses, deals, activities, products, diseases, visits, weather, deliveries, programs, knowledge",
  }));
  process.exit(1);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) {
      result[match[1]] = match[2] ?? "true";
    }
  }
  return result;
}

const args = parseArgs(rawArgs);

// ---------- Entity → endpoint mapping ----------

const ENTITY_MAP: Record<string, string> = {
  contacts: "/api/v1/contacts",
  companies: "/api/v1/companies",
  courses: "/api/v1/golf-course-profiles",
  deals: "/api/v1/deals",
  activities: "/api/v1/activities",
  products: "/api/v1/offerings",
  offerings: "/api/v1/offerings",
  diseases: "/api/v1/diseases-pests",
  "diseases-pests": "/api/v1/diseases-pests",
  visits: "/api/v1/visit-reports",
  "visit-reports": "/api/v1/visit-reports",
  weather: "/api/v1/weather",
  deliveries: "/api/v1/deliveries",
  programs: "/api/v1/treatment-programs",
  "treatment-programs": "/api/v1/treatment-programs",
  knowledge: "/api/v1/knowledge-base",
  "knowledge-base": "/api/v1/knowledge-base",
};

// AI endpoint mapping (POST-only)
const AI_ENTITY_MAP: Record<string, string> = {
  diagnose: "/api/turf/diagnose",
  recommend: "/api/turf/recommend",
  "program-builder": "/api/turf/program-builder",
  "visit-prep": "/api/turf/visit-prep",
  "quote-from-notes": "/api/turf/quote-from-notes",
  "budget-optimizer": "/api/turf/budget-optimizer",
};

const isAI = entity in AI_ENTITY_MAP;
const endpoint = isAI ? AI_ENTITY_MAP[entity] : ENTITY_MAP[entity];

if (!endpoint) {
  const allEntities = [...Object.keys(ENTITY_MAP), ...Object.keys(AI_ENTITY_MAP)];
  console.error(JSON.stringify({
    success: false,
    error: `Unknown entity: ${entity}. Valid: ${Array.from(new Set(allEntities)).join(", ")}`,
  }));
  process.exit(1);
}

// ---------- Determine HTTP method and build request ----------

// Actions → HTTP methods for REST endpoints
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

function resolveMethod(): HttpMethod {
  if (isAI) return "POST"; // AI endpoints are always POST
  switch (action) {
    case "list":
      return "GET";
    case "get":
      return "GET";
    case "create":
      return "POST";
    case "update":
      return "PUT";
    case "delete":
      return "DELETE";
    default:
      console.error(JSON.stringify({
        success: false,
        error: `Unknown action: ${action}. Valid: list, get, create, update, delete`,
      }));
      process.exit(1);
  }
}

const method = resolveMethod();

// Build the URL
let urlPath = endpoint;

// For get/update/delete, append the ID to the path
if ((action === "get" || action === "update" || action === "delete") && args.id) {
  urlPath = `${endpoint}/${args.id}`;
}

const url = new URL(urlPath, BASE_URL);

// For GET requests, add remaining args as query params
if (method === "GET") {
  for (const [key, value] of Object.entries(args)) {
    if (key === "id" && (action === "get")) continue; // already in path
    url.searchParams.set(key, value);
  }
}

// ---------- Build body for POST/PUT ----------

// Fields that should be numbers
const NUMERIC_FIELDS = new Set([
  "value_cad", "price", "quantity", "unit_price", "discount_percent",
  "total_cad", "sort_order", "position", "limit", "offset",
  "num_holes", "total_acreage", "annual_turf_budget_min", "annual_turf_budget_max",
  "application_rate_min", "application_rate_max", "re_entry_interval_hours",
  "rain_fast_hours", "temperature_c", "humidity_percent", "recent_rainfall_mm",
  "area_m2_affected", "application_rate", "coverage_area_m2", "application_count",
  "temp_high_c", "temp_low_c", "temp_avg_c", "rainfall_mm", "humidity_avg",
  "wind_avg_kmh", "gdd_daily", "gdd_cumulative", "gdd_base_temp_c",
  "optimal_temp_min_c", "optimal_temp_max_c",
  "total_budget", "spent_to_date", "gdd_threshold", "budget",
]);

// Fields that should be booleans
const BOOLEAN_FIELDS = new Set([
  "is_active", "ipm_program", "ontario_common", "is_primary",
  "is_spray_window", "was_ordered",
]);

// Fields that should be arrays (comma-separated → string[])
const ARRAY_FIELDS = new Set([
  "grass_types", "active_ingredients", "target_diseases", "target_pests",
  "compatible_tank_mixes", "seasonal_availability", "affected_grass_types",
  "affected_areas", "photo_urls", "seasonal_relevance", "keywords",
]);

function coerceValue(key: string, value: string): unknown {
  if (value === "null") return null;
  if (BOOLEAN_FIELDS.has(key)) return value === "true";
  if (NUMERIC_FIELDS.has(key)) {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  if (ARRAY_FIELDS.has(key)) {
    return value.split(",").map((s) => s.trim());
  }
  return value;
}

let body: Record<string, unknown> | undefined;

// Special handling for --json flag (pass raw JSON body)
if (args.json) {
  try {
    body = JSON.parse(args.json);
  } catch {
    console.error(JSON.stringify({ success: false, error: "Invalid --json value" }));
    process.exit(1);
  }
} else if (method === "POST" || method === "PUT") {
  body = {};
  for (const [key, value] of Object.entries(args)) {
    if (key === "id" && action === "update") continue; // id is in the URL path
    if (key === "json") continue;
    body[key] = coerceValue(key, value);
  }
}

// ---------- Make the request ----------

const headers: Record<string, string> = {
  Authorization: `Bearer ${API_KEY}`,
};

const fetchOptions: RequestInit = {
  method,
  headers,
};

if (body) {
  headers["Content-Type"] = "application/json";
  fetchOptions.body = JSON.stringify(body);
}

(async () => {
  try {
    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    // Pretty-print for readability in Claude's context
    console.log(JSON.stringify(data, null, 2));

    if (!response.ok) {
      process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Request failed",
    }));
    process.exit(1);
  }
})();

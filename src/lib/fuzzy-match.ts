// ============================================================================
// Allturf CRM — Fuzzy String Matching Utilities
// Used by call-processor.ts to match LLM-extracted names to CRM records.
// No external dependencies — pure DP + Supabase ilike queries.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Core algorithms
// ---------------------------------------------------------------------------

/** Standard Levenshtein distance — two-row DP, O(n*m) */
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

/** Normalized 0-1 similarity: 1 = identical, 0 = completely different */
export function normalizedSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

/** Jaccard similarity on lowercased word tokens */
export function tokenOverlapScore(query: string, candidate: string): number {
  const qTokens = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
  const cTokens = new Set(candidate.toLowerCase().split(/\s+/).filter(Boolean));
  if (qTokens.size === 0 && cTokens.size === 0) return 1;
  if (qTokens.size === 0 || cTokens.size === 0) return 0;

  let intersection = 0;
  Array.from(qTokens).forEach((t) => {
    if (cTokens.has(t)) intersection++;
  });
  const union = new Set(Array.from(qTokens).concat(Array.from(cTokens))).size;
  return intersection / union;
}

// ---------------------------------------------------------------------------
// Best-match selector
// ---------------------------------------------------------------------------

interface MatchResult<T> {
  item: T;
  score: number;
}

/**
 * Weighted combo match: 0.6 Levenshtein + 0.4 token overlap.
 * Returns best match above threshold, or null.
 */
export function bestMatch<T>(
  query: string,
  candidates: T[],
  getLabel: (item: T) => string,
  threshold = 0.5
): MatchResult<T> | null {
  let best: MatchResult<T> | null = null;

  for (const item of candidates) {
    const label = getLabel(item);
    const levScore = normalizedSimilarity(query, label);
    const tokenScore = tokenOverlapScore(query, label);
    const score = 0.6 * levScore + 0.4 * tokenScore;

    if (score >= threshold && (!best || score > best.score)) {
      best = { item, score };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// CRM entity matchers — each builds a single .or() ilike filter
// ---------------------------------------------------------------------------

interface MatchedContact {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
}

/**
 * Match extracted contact names to CRM contacts via ilike + re-rank.
 * Returns Map<extractedName, { id, company_id }>
 */
export async function matchContacts(
  names: string[],
  supabase: SupabaseClient
): Promise<Map<string, { id: string; company_id: string | null }>> {
  const result = new Map<string, { id: string; company_id: string | null }>();
  if (names.length === 0) return result;

  // Build ilike filter for each name against first_name + last_name
  const filters = names.map((n) => {
    const escaped = n.replace(/[%_]/g, "");
    return `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`;
  });

  const { data: candidates } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id")
    .or(filters.join(","));

  if (!candidates || candidates.length === 0) return result;

  for (const name of names) {
    const match = bestMatch(
      name,
      candidates as MatchedContact[],
      (c) => `${c.first_name} ${c.last_name}`,
      0.5
    );
    if (match) {
      result.set(name, { id: match.item.id, company_id: match.item.company_id });
    }
  }

  return result;
}

/**
 * Match extracted company names to CRM companies via ilike + re-rank.
 * Returns Map<extractedName, { id: string }>
 */
export async function matchCompanies(
  names: string[],
  supabase: SupabaseClient
): Promise<Map<string, { id: string }>> {
  const result = new Map<string, { id: string }>();
  if (names.length === 0) return result;

  const filters = names.map((n) => {
    const escaped = n.replace(/[%_]/g, "");
    return `name.ilike.%${escaped}%`;
  });

  const { data: candidates } = await supabase
    .from("companies")
    .select("id, name")
    .or(filters.join(","));

  if (!candidates || candidates.length === 0) return result;

  for (const name of names) {
    const match = bestMatch(
      name,
      candidates as Array<{ id: string; name: string }>,
      (c) => c.name,
      0.5
    );
    if (match) {
      result.set(name, { id: match.item.id });
    }
  }

  return result;
}

/**
 * Match extracted disease names to turf_diseases_pests via ilike + re-rank.
 * Returns Map<extractedName, { id: string }>
 */
export async function matchDiseases(
  names: string[],
  supabase: SupabaseClient
): Promise<Map<string, { id: string }>> {
  const result = new Map<string, { id: string }>();
  if (names.length === 0) return result;

  const filters = names.map((n) => {
    const escaped = n.replace(/[%_]/g, "");
    return `name.ilike.%${escaped}%`;
  });

  const { data: candidates } = await supabase
    .from("turf_diseases_pests")
    .select("id, name")
    .or(filters.join(","));

  if (!candidates || candidates.length === 0) return result;

  for (const name of names) {
    const match = bestMatch(
      name,
      candidates as Array<{ id: string; name: string }>,
      (c) => c.name,
      0.5
    );
    if (match) {
      result.set(name, { id: match.item.id });
    }
  }

  return result;
}

interface OfferingCandidate {
  id: string;
  name: string;
  active_ingredients: string[] | null;
  is_active: boolean;
}

/**
 * Match extracted product names to offerings via ilike + active_ingredients overlap + re-rank.
 * Only returns active products.
 * Returns Map<extractedName, { id: string; pcp_registration_number: string | null }>
 */
export async function matchProducts(
  names: string[],
  supabase: SupabaseClient
): Promise<Map<string, { id: string; pcp_registration_number: string | null }>> {
  const result = new Map<string, { id: string; pcp_registration_number: string | null }>();
  if (names.length === 0) return result;

  const filters = names.map((n) => {
    const escaped = n.replace(/[%_]/g, "");
    return `name.ilike.%${escaped}%`;
  });

  const { data: candidates } = await supabase
    .from("offerings")
    .select("id, name, active_ingredients, is_active, pcp_registration_number")
    .eq("is_active", true)
    .or(filters.join(","));

  if (!candidates || candidates.length === 0) return result;

  for (const name of names) {
    const match = bestMatch(
      name,
      candidates as Array<OfferingCandidate & { pcp_registration_number: string | null }>,
      (c) => c.name,
      0.5
    );
    if (match) {
      result.set(name, {
        id: match.item.id,
        pcp_registration_number: match.item.pcp_registration_number,
      });
    }
  }

  return result;
}

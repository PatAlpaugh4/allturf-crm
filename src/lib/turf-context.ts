// ============================================================================
// Allturf CRM — Entity Context Builder
// Assembles lightweight entity lists for AI fuzzy matching during extraction.
// Target: ~1000 tokens (~4000 chars) — just names for matching.
// ============================================================================

import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EntityContext {
  companies: string;
  contacts: string;
  products: string;
  diseases: string;
  totalChars: number;
}

// ---------------------------------------------------------------------------
// Main builder — returns entity name lists for LLM context
// ---------------------------------------------------------------------------
export async function buildEntityContext(): Promise<EntityContext> {
  const supabase = createServiceClient();

  const [companiesRes, contactsRes, productsRes, diseasesRes] =
    await Promise.all([
      supabase
        .from("companies")
        .select("name")
        .order("name"),
      supabase
        .from("contacts")
        .select("first_name, last_name, company:companies(name)")
        .order("last_name"),
      supabase
        .from("offerings")
        .select("name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("turf_diseases_pests")
        .select("name")
        .order("name"),
    ]);

  const companies = companiesRes.data
    ? "KNOWN COURSES/COMPANIES:\n" +
      companiesRes.data.map((c) => c.name).join(", ")
    : "";

  const contacts = contactsRes.data
    ? "KNOWN CONTACTS:\n" +
      contactsRes.data
        .map((c) => {
          const co = c.company as unknown as { name: string } | null;
          return `${c.first_name} ${c.last_name}${co ? ` (${co.name})` : ""}`;
        })
        .join(", ")
    : "";

  const products = productsRes.data
    ? "KNOWN PRODUCTS:\n" +
      productsRes.data.map((p) => p.name).join(", ")
    : "";

  const diseases = diseasesRes.data
    ? "KNOWN DISEASES/PESTS:\n" +
      diseasesRes.data.map((d) => d.name).join(", ")
    : "";

  const totalChars =
    companies.length + contacts.length + products.length + diseases.length;

  return { companies, contacts, products, diseases, totalChars };
}

// ---------------------------------------------------------------------------
// Flatten into a single string for prompt injection
// ---------------------------------------------------------------------------
export function flattenEntityContext(ctx: EntityContext): string {
  return [ctx.companies, ctx.contacts, ctx.products, ctx.diseases]
    .filter(Boolean)
    .join("\n\n");
}

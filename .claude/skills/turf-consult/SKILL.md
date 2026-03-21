---
name: turf-consult
description: >
  Trigger AI-powered turf diagnosis and product recommendations from the CLI.
  Trigger on phrases like "diagnose", "what disease is this", "recommend a product",
  "what should I spray", "treatment for", "identify disease", "turf problem",
  "fungicide recommendation", or any request for turf health diagnosis or product advice.
allowed-tools:
  - Bash(npx tsx *)
  - Read
---

# turf-consult

This skill triggers the Allturf CRM's AI consultation engine to diagnose turf issues and recommend products.

## How it works

Uses the CLI at `scripts/crm-api.ts` to call the AI endpoints under `/api/turf/`. The `PROJECT_SYNC_API_KEY` env var must be set.

## Commands

### Diagnose symptoms
```bash
npx tsx scripts/crm-api.ts diagnose create --json='{
  "symptoms": "Small straw-colored spots on greens, 1-3 inch diameter, cobweb-like mycelium visible in morning dew",
  "grass_type": "Bentgrass",
  "season": "Summer",
  "course_id": "uuid"
}'
```
Returns: ranked diagnoses with confidence levels, follow-up questions, and recommended actions.

### Get product recommendations
```bash
npx tsx scripts/crm-api.ts recommend create --json='{
  "diagnosis": "Dollar Spot",
  "course_id": "uuid",
  "target_area": "Greens",
  "budget": 5000,
  "exclude_moa_groups": ["3"]
}'
```
Returns: ranked products with application rates, timing, cost estimates, resistance risk, and tank mix compatibility.

### Build a seasonal treatment program
```bash
npx tsx scripts/crm-api.ts program-builder create --json='{
  "course_id": "uuid",
  "season_year": 2026,
  "program_type": "Spring Program",
  "goals": ["Disease prevention", "Growth regulation", "Green color"],
  "budget_cap": 25000
}'
```
Returns: complete program with products, rates, timing, estimated cost, and budget-adjusted alternatives.

### Extract a quote from notes
```bash
npx tsx scripts/crm-api.ts quote-from-notes create --json='{
  "notes": "Mike wants 4 cases of Banner for the greens, maybe some Primo too. He also asked about Heritage pricing for the fairways.",
  "course_id": "uuid"
}'
```
Returns: extracted product mentions matched to catalog, quantities, and auto-generated quote items.

### Optimize a treatment budget
```bash
npx tsx scripts/crm-api.ts budget-optimizer create --json='{
  "course_id": "uuid",
  "program_id": "uuid",
  "budget": 20000,
  "priorities": ["greens", "disease_prevention"]
}'
```
Returns: optimized program within budget with tradeoffs and risk notes.

## Workflow

### Diagnosis workflow
1. Ask the user to describe symptoms: what they see, where, grass type, recent weather
2. Call the diagnose endpoint with details
3. Present diagnoses ranked by confidence
4. If confidence < 0.5, recommend consulting a certified agronomist
5. Offer to get product recommendations for the top diagnosis

### Recommendation workflow
1. Confirm the diagnosis and target area
2. Ask about budget constraints and any MOA groups to exclude (for resistance rotation)
3. Call the recommend endpoint
4. Present products with rates, cost, and timing
5. Highlight any safety warnings (rate limits, Ontario registration, tank mix issues)
6. Offer to create a quote/deal with the recommended products

## Safety constraints (NON-NEGOTIABLE)

- NEVER recommend application rates exceeding the PMRA label maximum (this is illegal)
- ALWAYS verify Ontario registration (ontario_class must not be null)
- CHECK Mode of Action rotation — flag if the same MOA group was used in the last 2 treatments
- FLAG tank mix incompatibilities
- When AI confidence is below 0.5, RECOMMEND consulting a certified agronomist
- ALWAYS include PCP registration numbers when referencing products

## Display guidelines

- Show diagnoses as a ranked list with confidence percentages
- For products, always show: name, PCP #, MOA group, rate range, cost estimate
- Highlight any resistance risk warnings prominently
- Show tank mix compatibility notes
- Include timing recommendations (GDD thresholds, spray windows)
- Keep the output actionable — the rep needs to advise their superintendent

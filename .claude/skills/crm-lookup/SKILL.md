---
name: crm-lookup
description: >
  Search and look up contacts, companies, golf courses, products, deals, diseases/pests,
  visit reports, weather data, and knowledge base entries in the Allturf CRM.
  Trigger on phrases like "find contact", "look up", "who is", "search CRM",
  "find course", "check product", "show visit report", "weather for", "GDD for",
  or any request to find or retrieve CRM records.
allowed-tools:
  - Bash(npx tsx *)
  - Read
---

# crm-lookup

This skill helps users search and retrieve Allturf CRM data using the TypeScript CLI helper.

## How it works

All commands use the CLI at `scripts/crm-api.ts`:
```bash
npx tsx scripts/crm-api.ts <entity> <action> [--key=value ...]
```

The CLI reads `PROJECT_SYNC_API_KEY` from environment and hits `http://localhost:3000/api/v1/` by default (set `CRM_API_URL` to override).

## Commands

### Contacts
```bash
npx tsx scripts/crm-api.ts contacts list
npx tsx scripts/crm-api.ts contacts list --status=Active+Customer --role=Superintendent
npx tsx scripts/crm-api.ts contacts list --company_id=uuid --limit=10
npx tsx scripts/crm-api.ts contacts list --search=john
npx tsx scripts/crm-api.ts contacts get --id=uuid
```

### Companies (Golf Courses)
```bash
npx tsx scripts/crm-api.ts companies list
npx tsx scripts/crm-api.ts companies list --industry=Golf+Course --search=Royal
npx tsx scripts/crm-api.ts companies get --id=uuid
```

### Golf Course Profiles
```bash
npx tsx scripts/crm-api.ts courses list
npx tsx scripts/crm-api.ts courses list --course_type=Private --maintenance_level=Championship
npx tsx scripts/crm-api.ts courses get --id=uuid
```

### Products (Offerings)
```bash
npx tsx scripts/crm-api.ts products list
npx tsx scripts/crm-api.ts products list --category=Fungicide
npx tsx scripts/crm-api.ts products list --moa_group=3
npx tsx scripts/crm-api.ts products list --search=Banner
npx tsx scripts/crm-api.ts products get --id=uuid
```
The GET by ID includes disease/pest links with efficacy ratings.

### Diseases & Pests
```bash
npx tsx scripts/crm-api.ts diseases list
npx tsx scripts/crm-api.ts diseases list --type=Disease --ontario_common=true
npx tsx scripts/crm-api.ts diseases list --search=dollar+spot
npx tsx scripts/crm-api.ts diseases get --id=uuid
```
The GET by ID includes linked products with efficacy ratings.

### Deals (Quotes/Orders)
```bash
npx tsx scripts/crm-api.ts deals list
npx tsx scripts/crm-api.ts deals list --stage=Quote+Sent --season=2026
npx tsx scripts/crm-api.ts deals list --company_id=uuid
npx tsx scripts/crm-api.ts deals get --id=uuid
```

### Activities
```bash
npx tsx scripts/crm-api.ts activities list
npx tsx scripts/crm-api.ts activities list --contact_id=uuid --type=Site+Visit
npx tsx scripts/crm-api.ts activities list --deal_id=uuid --limit=20
npx tsx scripts/crm-api.ts activities get --id=uuid
```

### Visit Reports
```bash
npx tsx scripts/crm-api.ts visits list
npx tsx scripts/crm-api.ts visits list --company_id=uuid
npx tsx scripts/crm-api.ts visits list --rep_id=uuid
npx tsx scripts/crm-api.ts visits get --id=uuid
```
The GET by ID includes observations (disease sightings) and recommendations (products suggested).

### Weather & GDD
```bash
npx tsx scripts/crm-api.ts weather list --company_id=uuid
npx tsx scripts/crm-api.ts weather list --company_id=uuid --from=2026-03-01 --to=2026-03-20
npx tsx scripts/crm-api.ts weather get --id=uuid
```

### Deliveries
```bash
npx tsx scripts/crm-api.ts deliveries list
npx tsx scripts/crm-api.ts deliveries list --deal_id=uuid --status=Scheduled
npx tsx scripts/crm-api.ts deliveries get --id=uuid
```

### Treatment Programs
```bash
npx tsx scripts/crm-api.ts programs list
npx tsx scripts/crm-api.ts programs list --season=2026 --company_id=uuid
npx tsx scripts/crm-api.ts programs get --id=uuid
```

### Knowledge Base
```bash
npx tsx scripts/crm-api.ts knowledge list
npx tsx scripts/crm-api.ts knowledge list --category=disease
npx tsx scripts/crm-api.ts knowledge list --category=regulation --search=ontario
npx tsx scripts/crm-api.ts knowledge get --id=uuid
```
Categories: disease, pest, cultural_practice, regulation, product_tip

## Display guidelines

- Present results in clean, scannable tables or lists
- For contacts: show name, role, email, company, status
- For companies/courses: show name, course type, grass types, maintenance level
- For products: show name, category, PCP #, MOA group, active ingredients
- For diseases: show name, type, severity, season, affected grass types
- For deals: show name, stage, value, company, season
- For visits: show date, course, overall condition, key observations
- For weather: show date, temps, rainfall, GDD, spray window status
- Keep output concise — the user wants quick answers, not data dumps
- If no results found, say so clearly and suggest broadening the search

## Modes

### /crm-lookup (default — interactive search)
Ask what the user is looking for, then search. Start with the most likely entity type.

### /crm-lookup contacts
List or search contacts.

### /crm-lookup courses
Look up golf course profiles and company details.

### /crm-lookup products
Search products by name, category, MOA group, or disease target.

### /crm-lookup diseases
Look up turf diseases, pests, and weeds with treatment options.

### /crm-lookup deals
List or search deals/quotes/orders.

### /crm-lookup visits
Retrieve visit reports with observations and recommendations.

### /crm-lookup weather
Check weather snapshots and GDD data for a course.

### /crm-lookup knowledge
Search the turf knowledge base for disease info, regulations, or tips.

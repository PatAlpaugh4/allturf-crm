---
name: crm-manage
description: >
  Create and update CRM records — contacts, companies, golf course profiles, deals,
  products, visit reports, treatment programs, weather data, deliveries, and knowledge
  base entries. Trigger on phrases like "add a contact", "create a deal", "update the
  stage", "add a course", "file a visit report", "create a treatment program",
  "log weather data", "move deal to", or any request to create or modify CRM data.
  Do NOT trigger on delete requests — the user handles those manually.
allowed-tools:
  - Bash(npx tsx *)
  - Read
---

# crm-manage

This skill helps users create and update any Allturf CRM entity through the TypeScript CLI.

## How it works

Uses the CLI at `scripts/crm-api.ts`:
```bash
npx tsx scripts/crm-api.ts <entity> <action> [--key=value ...]
```

For complex objects (nested observations, recommendations, program tasks), use `--json='{"key":"value"}'` to pass a raw JSON body.

## Entity reference

### Contacts
```bash
# Create (required: first_name, last_name)
npx tsx scripts/crm-api.ts contacts create --first_name=John --last_name=Smith --email=john@course.com --company_id=uuid --status=New --role=Superintendent

# Update (required: id)
npx tsx scripts/crm-api.ts contacts update --id=uuid --status=Active+Customer --preferred_contact_method=Email
```
Roles: Superintendent, Assistant Superintendent, Grounds Crew, General Manager, Director of Agronomy, Owner, Purchasing
Statuses: New, No Answer, Left Voicemail, Follow Up, Active Customer, Inactive, Prospect, Do Not Contact

### Companies
```bash
# Create (required: name)
npx tsx scripts/crm-api.ts companies create --name="Royal Ottawa GC" --industry=Golf+Course --province=ON --city=Ottawa

# Update
npx tsx scripts/crm-api.ts companies update --id=uuid --city=Kanata
```
Industries: Golf Course, Sports Turf, Municipal Parks, Landscaping, Other

### Golf Course Profiles
```bash
# Create (required: company_id)
npx tsx scripts/crm-api.ts courses create --company_id=uuid --num_holes=18 --course_type=Private --maintenance_level=Championship --green_grass=Poa+annua/Bentgrass --fairway_grass=Kentucky+Bluegrass --grass_types=Poa+annua,Bentgrass,Kentucky+Bluegrass --ipm_program=true

# Update
npx tsx scripts/crm-api.ts courses update --id=uuid --maintenance_level=High --annual_turf_budget_min=150000 --annual_turf_budget_max=250000
```
Course types: Private, Public, Semi-Private, Resort, Municipal
Maintenance levels: Championship, High, Standard, Budget

### Deals (Quotes/Orders)
```bash
# Create (required: name, stage)
npx tsx scripts/crm-api.ts deals create --name="Spring Fungicide Program" --stage=Quote+Draft --company_id=uuid --contact_id=uuid --value_cad=12500 --order_type=Seasonal+Program --season=2026

# Update (move stage, change value)
npx tsx scripts/crm-api.ts deals update --id=uuid --stage=Quote+Sent --value_cad=15000
```
Stages: Quote Draft, Quote Sent, Quote Approved, Order Placed, Shipped, Delivered, Invoiced, Paid, Closed Lost
Order types: Standard, Seasonal Program, Emergency, Re-Order

### Products (Offerings)
```bash
# Create (required: name, category)
npx tsx scripts/crm-api.ts products create --name="Banner MAXX II" --category=Fungicide --manufacturer=Syngenta --active_ingredients=Propiconazole,Azoxystrobin --pcp_registration_number=33040 --moa_group=3/11 --ontario_class=Commercial

# Update
npx tsx scripts/crm-api.ts products update --id=uuid --price=450 --application_rate_min=3.2 --application_rate_max=9.8
```
Categories: Fungicide, Herbicide, Insecticide, Fertilizer, Seed, Wetting Agent, Growth Regulator, Adjuvant, Other

### Activities
```bash
# Create (required: type)
npx tsx scripts/crm-api.ts activities create --type=Site+Visit --summary="Spring inspection, greens in good shape" --contact_id=uuid --deal_id=uuid --assigned_rep_id=uuid

# Update
npx tsx scripts/crm-api.ts activities update --id=uuid --summary="Updated notes" --visit_report_id=uuid
```
Types: Phone Call, Email, Site Visit, Meeting, Note, Product Demo, Sample Drop-off, Follow Up

### Visit Reports
```bash
# Create (required: visit_date)
npx tsx scripts/crm-api.ts visits create --visit_date=2026-03-20 --company_id=uuid --contact_id=uuid --rep_id=uuid --overall_condition=Good --greens_condition=Excellent --fairways_condition=Good --temperature_c=18 --humidity_percent=65 --observations="Greens recovering well from winter"

# Create with nested observations and recommendations (use --json)
npx tsx scripts/crm-api.ts visits create --json='{"visit_date":"2026-03-20","company_id":"uuid","overall_condition":"Fair","observations":[{"disease_pest_id":"uuid","severity":"Moderate","affected_area":"Greens 1-9","notes":"Dollar spot pressure building"}],"recommendations":[{"product_id":"uuid","application_rate":6.5,"target_area":"Greens","priority":"This Week"}]}'

# Update
npx tsx scripts/crm-api.ts visits update --id=uuid --follow_up_date=2026-04-01 --follow_up_actions="Check dollar spot progression"
```
Condition ratings: Excellent, Good, Fair, Poor, Critical
Recommendation priorities: Immediate, This Week, This Month, Seasonal

### Weather Snapshots
```bash
# Create (required: company_id, snapshot_date)
npx tsx scripts/crm-api.ts weather create --company_id=uuid --snapshot_date=2026-03-20 --temp_high_c=22 --temp_low_c=8 --rainfall_mm=0 --humidity_avg=55 --wind_avg_kmh=12

# Update
npx tsx scripts/crm-api.ts weather update --id=uuid --rainfall_mm=15
```
GDD and spray window are auto-calculated by the API.

### Deliveries
```bash
# Create (required: deal_id, status)
npx tsx scripts/crm-api.ts deliveries create --deal_id=uuid --scheduled_date=2026-04-01 --status=Scheduled --delivery_notes="Morning delivery preferred"

# Update
npx tsx scripts/crm-api.ts deliveries update --id=uuid --status=Delivered --actual_date=2026-04-01 --received_by="Mike Johnson"
```
Statuses: Scheduled, In Transit, Delivered, Partial, Cancelled

### Treatment Programs
```bash
# Create (required: name)
npx tsx scripts/crm-api.ts programs create --json='{"name":"2026 Spring Fungicide Program","project_type":"Spring Program","season_year":2026,"company_id":"uuid","total_budget":25000,"tasks":[{"title":"Banner MAXX - Round 1","application_date":"2026-04-15","product_id":"uuid","application_rate":6.5,"target_area":"Greens"}]}'

# Update
npx tsx scripts/crm-api.ts programs update --id=uuid --status=In+Progress --spent_to_date=8500
```
Program types: Spring Program, Summer Program, Fall Program, Winter Prep, Full Season, Custom

### Knowledge Base
```bash
# Create (required: category, title)
npx tsx scripts/crm-api.ts knowledge create --category=product_tip --title="Banner MAXX Tank Mix Guide" --content="Compatible with Primo MAXX and most fertilizers..." --keywords=banner,tank+mix,fungicide --grass_types=Bentgrass,Poa+annua

# Update
npx tsx scripts/crm-api.ts knowledge update --id=uuid --content="Updated content..."
```
Categories: disease, pest, cultural_practice, regulation, product_tip

## Safety constraints

- NEVER recommend pesticide application rates exceeding the PMRA label maximum
- ALWAYS verify Ontario registration before recommending products (ontario_class must not be null)
- CHECK Mode of Action rotation against treatment history to prevent resistance
- When creating product records, always include PCP registration numbers

## Guidelines

- Always confirm with the user before creating records
- When creating contacts or deals, search first to avoid duplicates
- For deal stage changes, show the pipeline context (what stage they're moving from/to)
- NEVER delete records — the user handles deletions manually
- After any create/update, display what was created/changed as confirmation

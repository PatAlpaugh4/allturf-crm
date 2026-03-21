---
name: log-activity
description: >
  Log activities (calls, emails, site visits, meetings, notes, demos, sample drop-offs)
  against contacts and deals in the Allturf CRM. Trigger on phrases like "log a call",
  "log email", "add a note", "record meeting", "log activity", "log site visit",
  "file a visit report", or any request to record an interaction with a contact or deal.
allowed-tools:
  - Bash(npx tsx *)
  - Read
---

# log-activity

This skill helps users quickly log activities to the Allturf CRM, including structured site visit reports.

## How it works

Uses the CLI at `scripts/crm-api.ts`. The `PROJECT_SYNC_API_KEY` env var must be set.

## Activity types

Valid types: `Phone Call`, `Email`, `Site Visit`, `Meeting`, `Note`, `Product Demo`, `Sample Drop-off`, `Follow Up`

## Commands

### Create an activity
```bash
npx tsx scripts/crm-api.ts activities create --type="Email" --summary="Follow-up about spring fungicide quote" --contact_id=uuid
npx tsx scripts/crm-api.ts activities create --type="Phone Call" --summary="Discussed dollar spot treatment options" --contact_id=uuid --deal_id=uuid
npx tsx scripts/crm-api.ts activities create --type="Site Visit" --summary="Spring course inspection" --contact_id=uuid --assigned_rep_id=uuid
npx tsx scripts/crm-api.ts activities create --type="Product Demo" --summary="Demonstrated Acelepryn application on practice green" --contact_id=uuid
npx tsx scripts/crm-api.ts activities create --type="Sample Drop-off" --summary="Left Heritage sample for greens trial" --contact_id=uuid
npx tsx scripts/crm-api.ts activities create --type="Note" --summary="Superintendent mentioned budget increase for next season"
```

### List activities
```bash
npx tsx scripts/crm-api.ts activities list --contact_id=uuid
npx tsx scripts/crm-api.ts activities list --deal_id=uuid
npx tsx scripts/crm-api.ts activities list --type=Site+Visit --limit=20
npx tsx scripts/crm-api.ts activities list --assigned_rep_id=uuid
```

## Site Visit workflow

For Site Visit activities, create a structured visit report alongside the activity:

1. Create the activity:
```bash
npx tsx scripts/crm-api.ts activities create --type="Site Visit" --summary="Spring inspection at Royal Ottawa" --contact_id=uuid --assigned_rep_id=uuid
```

2. Create the visit report with observations and recommendations:
```bash
npx tsx scripts/crm-api.ts visits create --json='{
  "visit_date": "2026-03-20",
  "company_id": "uuid",
  "contact_id": "uuid",
  "rep_id": "uuid",
  "overall_condition": "Good",
  "greens_condition": "Excellent",
  "fairways_condition": "Good",
  "tees_condition": "Good",
  "rough_condition": "Fair",
  "temperature_c": 18,
  "humidity_percent": 65,
  "observations": "Greens in excellent shape post-winter. Some dollar spot pressure on fairways 4-7.",
  "recommendations": "Apply Banner MAXX at 6.5 mL/100m² to affected fairways. Consider preventive Instrata on greens.",
  "follow_up_date": "2026-04-03",
  "follow_up_actions": "Check fairway response to Banner MAXX treatment"
}'
```

3. Link the visit report back to the activity:
```bash
npx tsx scripts/crm-api.ts activities update --id=<activity_id> --visit_report_id=<visit_report_id>
```

## Workflow

1. The user says something like "log a site visit at Royal Ottawa"
2. First, find the contact: `npx tsx scripts/crm-api.ts contacts list --search=Royal+Ottawa`
3. If there's an active deal, find it: `npx tsx scripts/crm-api.ts deals list --company_id=uuid`
4. Create the activity with the matched IDs
5. If it's a site visit, ask about conditions and create a visit report
6. Confirm what was logged

## Guidelines

- Always try to link activities to both a contact AND a deal when possible
- If the user doesn't specify a contact, ask or search first
- Write clear, concise summaries — these become the team's activity history
- After logging, confirm: type, summary, linked contact/deal
- If the contact isn't in the CRM, offer to create them first
- For site visits, always ask about turf conditions (overall, greens, fairways, tees, rough)
- For site visits, ask about any disease/pest observations to include in the report
- Include weather conditions if the user mentions them

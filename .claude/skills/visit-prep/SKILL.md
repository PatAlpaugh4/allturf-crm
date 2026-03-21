---
name: visit-prep
description: >
  Generate a pre-visit briefing for a golf course before a sales rep visit.
  Trigger on phrases like "prep for visit", "visit briefing", "brief me on",
  "prepare for meeting with", "what should I know before visiting",
  "course briefing", or any request to prepare for an upcoming course visit.
allowed-tools:
  - Bash(npx tsx *)
  - Read
---

# visit-prep

This skill generates comprehensive pre-visit briefings for sales reps before visiting a golf course.

## How it works

Uses the CLI at `scripts/crm-api.ts` to call the AI visit-prep endpoint. The `PROJECT_SYNC_API_KEY` env var must be set.

## Commands

### Generate a visit briefing
```bash
npx tsx scripts/crm-api.ts visit-prep create --json='{
  "course_id": "uuid",
  "contact_id": "uuid"
}'
```

Returns a comprehensive briefing including:
- **Course summary**: type, grass types, maintenance level, budget range
- **Recent visit history**: last visit date, conditions, observations
- **Active deals**: outstanding quotes, orders in progress
- **Products running low**: based on last order dates and typical reorder cycles
- **Seasonal disease risks**: diseases likely active based on current weather and GDD
- **Upsell opportunities**: products the course doesn't use but could benefit from
- **Weather context**: recent temps, rainfall, GDD accumulation, spray window status
- **Suggested talking points**: AI-generated conversation starters based on all context

## Workflow

1. The user says "prep me for my visit to Royal Ottawa" or "brief me on Oakville Golf Club"
2. Search for the course:
```bash
npx tsx scripts/crm-api.ts companies list --search=Royal+Ottawa
```
3. Find the superintendent contact:
```bash
npx tsx scripts/crm-api.ts contacts list --company_id=uuid --role=Superintendent
```
4. Generate the briefing:
```bash
npx tsx scripts/crm-api.ts visit-prep create --json='{"course_id":"uuid","contact_id":"uuid"}'
```
5. Present the briefing in a structured, scannable format

### If the AI endpoint is unavailable, build a manual briefing

Fall back to direct data lookups:
```bash
# Course profile
npx tsx scripts/crm-api.ts courses list --company_id=uuid

# Recent visits
npx tsx scripts/crm-api.ts visits list --company_id=uuid --limit=3

# Active deals
npx tsx scripts/crm-api.ts deals list --company_id=uuid

# Recent weather
npx tsx scripts/crm-api.ts weather list --company_id=uuid --limit=7

# Contact details
npx tsx scripts/crm-api.ts contacts get --id=uuid

# Seasonal diseases to watch for
npx tsx scripts/crm-api.ts diseases list --ontario_common=true
```

Then compile the information into a concise briefing.

## Display guidelines

- Lead with the course name, contact name, and key facts (holes, grass, maintenance level)
- Highlight any urgent items: disease alerts, overdue follow-ups, expiring quotes
- Show recent visit conditions with trend (improving/declining/stable)
- List active deals with stages and values
- Keep seasonal risk section focused on the 2-3 most likely issues for current conditions
- End with 3-5 suggested talking points
- Format for quick scanning — the rep will review this on their phone before walking in

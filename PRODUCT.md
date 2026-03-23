# Allturf CRM — Product Documentation

**Version:** Phase 1.3 (Inventory & Demand Intelligence)
**Last Updated:** 2026-03-21
**Deployment:** Vercel (yul1 region) | Supabase backend

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Authentication & Roles](#2-authentication--roles)
3. [Dashboard](#3-dashboard)
4. [Call Logging & AI Processing](#4-call-logging--ai-processing)
5. [Nudge System](#5-nudge-system)
6. [Daily Digest](#6-daily-digest)
7. [Field Intelligence](#7-field-intelligence)
8. [Golf Courses](#8-golf-courses)
9. [Contacts](#9-contacts)
10. [Visit Reports](#10-visit-reports)
11. [Sales Pipeline](#11-sales-pipeline)
12. [Products](#12-products)
13. [Calendar](#13-calendar)
14. [Reports & Analytics](#14-reports--analytics)
15. [AI & Safety Systems](#15-ai--safety-systems)
16. [Trend Detection Engine](#16-trend-detection-engine)
17. [Data Model](#17-data-model)

---

## 1. Product Overview

Allturf CRM is an industry-specific customer relationship management platform built for **Allturf LTD**, an Ontario-based turf products distributor. The company employs 20 sales reps who sell pesticides, fungicides, herbicides, fertilizers, seed, and wetting agents to golf course superintendents across Ontario. Reps act as turf consultants — diagnosing diseases and pests, recommending products based on budget, weather, grass type, and maintenance goals.

The platform's core innovation is an **AI-powered call processing pipeline** that converts voice-dictated or typed field notes into structured intelligence: extracting diseases, products, action items, and commitments, then generating adaptive nudges, demand signals, and trend alerts — all while enforcing Canadian pesticide safety regulations at the prompt, validation, and query layers.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database & Auth | Supabase (PostgreSQL, Row Level Security, Realtime) |
| Styling | Tailwind CSS |
| UI Primitives | Radix UI |
| Charts | Recharts |
| LLM | Groq llama-3.3-70b-versatile (future Claude API support) |
| Deployment | Vercel (yul1 region, Canada) |
| Voice Input | Web Speech API (en-CA) |

### Who Uses It

| Role | Users | Access Level |
|------|-------|-------------|
| Sales Rep (`rep`) | ~20 field reps | Personal dashboard, call logging, contacts, courses, visits, deals, products, calendar, nudges |
| Manager (`admin`) | Management team | Everything reps see + daily digest, field intelligence, promotion management, inventory management, trend alerts |

---

## 2. Authentication & Roles

### Login Flow

The login page presents a branded split-screen layout: left panel with email/password form, right panel with a golf course sunset hero image (hidden on mobile, replaced with a compact banner). Authentication is handled by Supabase Auth with email/password credentials.

- Users enter their email and password
- On success, they are redirected to `/dashboard` (or a previously requested route via `?redirect=` query parameter)
- On failure, an error message is displayed inline
- The page supports both light and dark mode theming

### Route Protection

**Middleware** intercepts every request and enforces authentication:

- **Public routes:** Login page only (`/login`)
- **Protected routes:** All dashboard routes (`/dashboard`, `/contacts`, `/courses`, `/calls`, `/pipeline`, `/visits`, `/calendar`, `/nudges`, `/products`, `/reports`, `/field-intel`, `/digest`)
- **API routes:** Protected by their own auth guards (not middleware); each API route uses the `withApiProtection()` wrapper that validates the Supabase session token and user role
- **Static assets:** Excluded from middleware checks

Unauthenticated users are redirected to `/login?redirect={pathname}` so they return to their intended page after signing in.

### Roles

| Role | Value | Dashboard | Field Intel | Daily Digest | Promo Manager | Inventory Manager |
|------|-------|-----------|-------------|--------------|---------------|-------------------|
| Admin | `admin` | Manager Dashboard | Full access | Generate & view | Create/edit/delete | Edit stock levels |
| Sales Rep | `member` | Rep Dashboard | Redirected away | View only (if navigated directly) | View current specials only | No access |

Role is stored in `user_profiles.role` and checked at both the component and API level.

---

## 3. Dashboard

The dashboard is the landing page after login. It renders a completely different experience based on the user's role.

### Rep Dashboard

The rep dashboard is action-oriented, surfacing the most important items a field rep needs at the start of their day:

**Call Capture Prompt** — A prominent card encouraging reps to log calls. Clicking it opens the Call Capture FAB (floating action button) with voice recording ready. Features a microphone icon and "Log a Call" text with a chevron.

**My Nudges** — Shows the top 5 active nudges (not dismissed or completed), sorted by priority: urgent > high > medium > low. Each nudge displays a priority dot, title, message snippet, and time ago. A "See all nudges" link navigates to the full `/nudges` page. Data is fetched from the `rep_nudges` table filtered to the current rep.

**Recent Calls** — The 5 most recent call logs ordered by creation date. Displays course name, processing status badge (pending/processing/completed/failed), summary snippet, rep name, and sentiment badge. Links to the full `/calls` page.

**My Open Commitments** — Extracts commitments from the `extracted_commitments` field in call extractions. Only shows commitments where the owner is the rep (not customer-owned). Categorizes by status: overdue (red), due today (amber), and pending. Shows up to 8 commitments with description, company name, and due date.

**Upcoming Events** — Calendar events for the logged-in user, filtered by matching profile name or email. Shows up to 3 upcoming events with title, event type icon (map pin for site visits, truck for deliveries, users for meetings, flask for demos), date, company, and event type badge.

### Manager Dashboard

The manager dashboard provides a birds-eye view of team activity, market intelligence, and operational health:

**Quick Stats Row** — Four summary cards displayed in a responsive grid:
- **Calls Today** with comparison to yesterday's total
- **Active Field Alerts** with a critical-severity flag if any exist
- **Overdue Commitments** highlighted red when count is greater than zero
- **Demand Signals** from the last 7 days

All stats are fetched via parallel Supabase queries for fast loading.

**Field Trends Card** — Shows the top 5 active trend signals from the `field_trend_signals` table. Each displays a severity badge (critical/warning/info), signal type, title, description, and affected regions. Critical signals are highlighted with a red border and alert triangle icon.

**Daily Digest Card** — Shows yesterday's digest summary: total calls, follow-ups needed, and key highlights. Offers a "View Full Digest" link or "Generate Digest" button if none exists for the previous day.

**Rep Activity Snapshot** — A table of all active reps with their activity for today: rep name and territory, calls logged today, last call time, and active nudge count. Active reps (with calls) sort first with a green checkmark; inactive reps show a minus icon.

**Demand Signals Card** — Aggregates demand signals from the last 7 days, enriched with inventory data. Shows the top 5 products with mention count, current inventory on hand, and a low-stock indicator when applicable.

---

## 4. Call Logging & AI Processing

Call logging is the core feature of Allturf CRM. Every interaction a rep has with a golf course superintendent can be captured through voice dictation or typed notes, then processed by AI to extract structured intelligence.

### Entry Points

There are two ways to log a call:

1. **Floating Action Button (FAB)** — A persistent microphone button fixed to the bottom-right corner of every page. On mobile it sits at `bottom-24 right-6` (above the quick-check-in button if present); on desktop it moves to `bottom-6`. It features a subtle pulse animation (3-second ring) to draw attention. Clicking opens a sheet modal with voice recording controls.

2. **Dedicated Page (`/calls/new`)** — A full-page call logging form accessed from the navigation or the "Log Call" button on the calls list page.

### Voice Dictation

Voice input uses the Web Speech API with `en-CA` (Canadian English) locale:

- **Continuous recording** with interim results displayed in real-time
- **Auto-restart** when the browser's ~60-second timeout fires (seamless to the user)
- **Error handling** for microphone permission denial, no speech detected, network errors, and aborted sessions
- **Text fallback** — If the browser doesn't support Speech Recognition (non-Chrome), a toggle switches to a plain textarea for typed input
- **Word count indicator** displayed below the input area

### Call Logging Form (Full Page)

The `/calls/new` page provides:

- **Voice Recorder component** — Primary interaction for dictation
- **Textarea** — For typed notes or editing dictated text
- **Course selector** — Optional searchable dropdown querying the companies table
- **Contact selector** — Optional dropdown that filters by selected course, or shows all contacts if no course selected
- **Draft auto-save** — Every change is saved to `localStorage` under the key `allturf_call_log_draft`. Drafts are restored on page load if less than 24 hours old. Auto-save triggers every 1 second with debounce.
- **Submit** — Creates a call log record with status `pending`, then fires an async POST to `/api/turf/process-call-log` (fire-and-forget)
- **Success state** — Shows a check circle icon with options to "Log Another" or "View All Calls"

### Data Submitted

```
rep_id          — from authenticated user profile
company_id      — optional, from course selector
contact_id      — optional, from contact selector
input_type      — "voice_dictation" or "typed_notes"
raw_transcript  — cleaned call notes text
processing_status — "pending"
```

### AI Processing Pipeline

When a call is submitted, the 5-stage pipeline runs asynchronously:

#### Stage 1: LLM Extraction

The raw transcript is sent to Groq's llama-3.3-70b model with a safety system prompt and task-specific extraction prompt. The extraction prompt is optimized for informal conversational patterns typical of field reps ("Just left Oak Grove", "They need Banner", "Call back Friday").

Temperature is set to 0.1 for maximum precision. The LLM returns structured JSON with 18 fields:

- **summary** — 2-3 sentence call summary
- **sentiment** — positive, neutral, concerned, or urgent
- **diseases_mentioned** — Array of disease/pest names discussed
- **products_mentioned** — Array of product names referenced
- **products_requested** — Array of objects with product name, quantity, unit, urgency, and notes
- **competitor_mentions** — Any competitor products or companies mentioned
- **budget_signals** — Budget-related information (e.g., "tight budget this year")
- **follow_up_needed** — Boolean indicating if follow-up is required
- **follow_up_date** — Parsed date in YYYY-MM-DD format (LLM receives today's date for relative date parsing)
- **action_items** — Array of objects with type, description, due date, and priority
- **key_topics** — Array of discussion topics
- **confidence_score** — 0.0 to 1.0 confidence in extraction accuracy
- **contact_names** — Names mentioned in the transcript
- **company_names** — Course/company names mentioned
- **commitments** — What the rep promised (description, deadline, owner)
- **reorders** — Repeat product requests (product name, quantity, unit, needed-by date)
- **urgency_level** — routine, soon, urgent, or emergency

All outputs undergo strict structure validation with defensive defaults — the system does not trust the shape of LLM output.

#### Stage 2: CRM Record Matching (Fuzzy Matching)

Extracted entity names are matched against CRM database records using a weighted combination of:

- **Levenshtein distance** (60% weight) — Character-level edit distance, normalized to 0.0–1.0
- **Token overlap / Jaccard similarity** (40% weight) — Word-level overlap, more lenient for multi-word names like "St. Andrews Golf Club" vs "St Andrews GC"

**Confidence threshold:** 0.5 (50% minimum similarity required for a match)

The system matches four entity types in parallel:
- **Contacts** — Extracted names matched against `contacts.first_name + last_name`
- **Companies** — Course/company names matched against `companies.name`
- **Diseases** — Disease names matched against `turf_diseases_pests.name`
- **Products** — Product names matched against `offerings.name` (active products only)

Database queries use `ilike` prefix matching to generate candidates, then re-rank with the similarity scoring algorithm. If a match is found, the call log is updated with the matched `company_id` and `contact_id`. Matching is non-fatal — if no match is found, fields remain null and the pipeline continues.

#### Stage 3: Nudge Generation

Based on the extraction and matched records, up to 10 nudges are generated per call (maximum 5 of the same type). There are 12 trigger types — see [Section 5: Nudge System](#5-nudge-system) for the complete list.

#### Stage 4: Activity Creation

If the extraction's confidence score is >= 0.5, an activity record is created in the `activities` table with type "Phone Call", the raw transcript (first 500 characters), AI summary, rep ID, and contact ID. If confidence is below 0.5, no activity is created and a warning is logged recommending manual rep review.

#### Stage 5: Demand Signal Generation

For each product referenced in the call, a demand signal is created:

| Signal Type | Source | Description |
|-------------|--------|-------------|
| `request` | `products_requested[]` | Rep explicitly says the customer needs a product |
| `reorder` | `extracted_reorders[]` | Customer is running low on a previously purchased product |
| `inquiry` | `products_mentioned` (not already a request) | Product was discussed but not actively requested |

Each signal captures: product ID (if matched), product name, signal type, source call log, rep ID, company ID, quantity mentioned, and rep territory/region. Signals are stored in the `demand_signals` table and feed into the demand intelligence features on the manager dashboard and daily digest.

### Call Log List Page

The `/calls` page displays all call logs in a searchable, filterable table:

- **Auto-polling** — Every 5 seconds while any logs have `pending` or `processing` status
- **Search** — By course name, contact name, transcript content, or summary
- **Status filter** — Pending, Processing, Completed, Failed
- **Table columns** — Date/time, course name, summary (AI-extracted or raw transcript preview), processing status badge, sentiment badge
- **Responsive** — Course and status columns hide on mobile; sentiment shows inline on mobile instead

### Call Detail Sheet

Clicking a row opens a right-side detail sheet showing:

- **Call metadata** — Date, status, course, contact
- **Raw transcript** — The original dictated or typed notes
- **AI Extraction section:**
  - Summary
  - Sentiment badge (positive = green, neutral = gray, concerned = amber, urgent = red)
  - Confidence score
  - Follow-up needed indicator with date
  - Diseases mentioned (as color-coded pills)
  - Products mentioned (as color-coded pills)
  - Key topics (as secondary pills)
  - Action items with completion checkboxes
- **AI Suggestions section** — Generated nudges with type, priority, title, message, and status badges

---

## 5. Nudge System

Nudges are smart, contextual notifications generated automatically from call processing and trend detection. They surface actionable intelligence to reps without requiring them to dig through data.

### Nudge Types

| Type | Icon | Description |
|------|------|-------------|
| `inventory_alert` | Package | Stock level warnings, reorder notifications |
| `action_reminder` | AlertTriangle | Follow-ups, commitments, quotes needed |
| `cross_sell` | ShoppingCart | Related products for discussed diseases |
| `promo_available` | Tag | Active promotions matching discussed products |
| `related_info` | Info | Knowledge base articles, competitor intelligence |
| `disease_alert` | Sparkles | Cross-rep disease outbreak intelligence |

### Priority Levels

| Priority | Visual | Duration (Toast) |
|----------|--------|------------------|
| `urgent` | Red left border | Persistent until dismissed |
| `high` | Orange left border | 10 seconds |
| `medium` | No colored border | 5 seconds |
| `low` | No colored border | 3 seconds |

### 12 Nudge Triggers

| # | Trigger Condition | Nudge Type | Priority | Description |
|---|-------------------|------------|----------|-------------|
| 1 | Follow-up needed from call | `action_reminder` | Based on sentiment + due date | Reminds rep to follow up by the extracted date |
| 2 | Product requested but no active deal | `action_reminder` | `high` | Prompts rep to create a quote |
| 3 | Disease mentioned → Ontario-registered products exist | `cross_sell` | `medium` | Cross-references `product_disease_links` for treatment options |
| 4 | Competitor mentioned in call | `related_info` | `medium` | Alerts rep to review competitive positioning |
| 5 | Disease has knowledge base entry | `related_info` | `low` | Links to educational material about the disease |
| 6 | Product requested but not in current season | `inventory_alert` | `medium` | Flags seasonal availability mismatch |
| 7 | Active promotion matches mentioned product | `promo_available` | `high` | Alerts rep to offer the current special |
| 8 | 2+ other reps reported same disease in 72 hours | `disease_alert` | `high` | Cross-rep disease trending intelligence |
| 9 | Disease discussed but best treatment product not mentioned | `cross_sell` | `medium` | Suggests the top product for that disease |
| 10 | Reorder detected (repeat purchase) | `inventory_alert` | `high` or `medium` | Flags for warehouse/fulfillment team |
| 11 | Commitment with deadline extracted | `action_reminder` | `high` or `medium` | Ensures rep keeps promises made to customers |
| 12 | Emergency urgency level | `action_reminder` | `urgent` | Flags emergency situations for immediate attention |

**Deduplication rules:** Maximum 5 nudges of the same type per rep, maximum 10 total per call.

### Notification Delivery

**Nudge Bell** — A bell icon in the top navigation bar shows the unread nudge count. The count updates via:
- Polling every 30 seconds (fetches from `/api/v1/nudges/unread-count`)
- Supabase Realtime subscription on the `rep_nudges` table for instant updates

**Toast Notifications** — When a new nudge is created (detected via Realtime subscription), a toast notification appears with priority-based duration. The toast shows the nudge title and a snippet of the message.

### Nudges Page (`/nudges`)

The full nudges page displays all nudges grouped by date:

- **Groups:** Today, Yesterday, This Week, Earlier
- **Active nudge count** displayed in the header
- **Toggle** to show/hide dismissed and completed nudges (default: hidden)
- **Each nudge card shows:**
  - Type icon in a colored circle
  - Priority indicator (left border: red for urgent, orange for high)
  - Title and message text
  - Suggested action in italic (e.g., "Create a quote for Banner")
  - Metadata row: time ago, linked course (clickable link to course detail), contact name, due date (red if overdue)
  - Action buttons: Mark as Done (green check), Dismiss (red X)
- **Dismissed/completed nudges** appear at 40% opacity
- **Empty state** with message when no nudges exist

### Nudge Actions

- **Complete:** Sets `is_completed = true` and `completed_at = current timestamp`. Removes from active view.
- **Dismiss:** Sets `is_dismissed = true` and `dismissed_at = current timestamp`. Removes from active view.

---

## 6. Daily Digest

The daily digest is an admin-generated executive briefing that summarizes a full day's field activity into a single, scannable document.

### Accessing the Digest

Navigate to `/digest` from the sidebar navigation or from the "View Full Digest" link on the manager dashboard. The page displays a date picker with previous/next day navigation buttons, defaulting to yesterday's date.

### Generating a Digest

If no digest exists for the selected date, a "Generate Digest" call-to-action is displayed. Clicking it triggers the AI-powered generation pipeline (admin-only). The "Regenerate" button allows re-generating a digest to pick up any late-arriving call data.

### Digest Sections

**Stats Bar** — Four summary metrics across the top:
- Total calls logged that day
- Active reps (reps who logged at least one call)
- Total follow-ups needed
- Active trend alerts

**Executive Briefing** — An AI-generated 3-4 sentence summary written in a conversational tone ("like a CEO's aide"). Highlights the most important patterns: trending diseases, supply/demand mismatches, specific numbers, and urgent items. Generated by Groq at temperature 0.4 for balanced creativity. Falls back to a basic text summary if AI generation fails.

**Rep Activity Breakdown** — Per-rep cards showing:
- Rep name with initials avatar
- Number of calls logged
- Accounts touched (course names)
- Commitments made with deadlines
- Sentiment distribution bar (stacked horizontal bar: green for positive, gray for neutral, amber for concerned, red for urgent)
- Icon indicator for urgent or concerned calls
- Top 5 reps shown by default, expandable to show all
- Inactive reps listed separately in a dashed outline box

**Demand Intelligence** — Two sub-sections:
- *Products in Demand:* Table with product name, mention count, request count, and inventory status (with "LOW" indicator when stock is below reorder point)
- *Reorder Requests:* Individual requests with product, customer name, rep, quantity, and needed-by date

**Disease/Pest Watch** — Per-disease cards showing:
- Disease name with trending indicator (up arrow for increasing, "NEW" badge for first appearance)
- Mention count and rep count
- Affected regions
- Related treatment products (top 3)
- Trend comparison against the previous 7-day period

**Action Items Rollup** — Grouped by rep, showing all open action items:
- **Overdue** — Red border, red clock icon
- **Due today** — Amber border, amber clock icon
- **Pending/upcoming** — Default styling
- Each item shows: type badge, description, company context, due date

**Active Trend Alerts** — Current trend signals with severity badge, title, description, and recommended actions. Includes an "Acknowledge" button to dismiss alerts.

### Data Gathering Process

The digest generator (`digest-generator.ts`) gathers data from all completed call logs for the target date:

1. Per-rep activity: calls logged, accounts touched, commitments, sentiment breakdown
2. Disease intelligence: mentions aggregated by disease, trending status compared to prior week
3. Product demand: mention and request counts enriched with inventory levels
4. Reorder requests: product, customer, quantity, needed-by date
5. Action items: categorized by status (overdue, due today, pending)
6. Sentiment totals: positive, neutral, concerned, urgent counts
7. Urgent calls: calls with concerning or urgent sentiment
8. Inactive reps: active user profiles with no call logs that day
9. Trend context: active signals from `field_trend_signals` table (top 10 by severity)

The structured data is stored as JSONB in the `daily_digests` table along with scalar metrics for quick querying.

---

## 7. Field Intelligence

Field Intelligence (`/field-intel`) is an admin-only real-time cross-rep activity dashboard that provides a unified view of what's happening across all territories.

### Access Control

Non-admin users are automatically redirected to `/dashboard` when attempting to access this page.

### Filters

- **Date range:** Today, Last 3 Days, This Week, Last 2 Weeks
- **Territory:** Clickable region buttons from the "Hot Regions" sidebar section; clicking a region filters the timeline to that territory

### Active Alerts Section

At the top of the page, any active trend signals are displayed as color-coded alert boxes:
- **Critical** — Red background, alert triangle icon
- **Warning** — Amber background
- **Watch** — Yellow background
- **Info** — Blue background

Each alert shows: title, description, affected region, data points count, and an "Acknowledge" button to dismiss.

### Timeline View

The main content area is a vertical timeline of recent field activity, with each card representing a processed call log:

- **Rep avatar** — Initials in a primary-colored circle
- **Rep name** with sentiment dot indicator (colored per sentiment)
- **Timestamp** — Relative time (e.g., "2 hours ago")
- **Urgency badge** — Shown if not "routine" (soon = blue, urgent = orange, emergency = red)
- **Course name** (clickable link to course detail) + contact name + rep territory
- **AI-generated summary** paragraph
- **Disease mentions** — Orange-colored pill badges
- **Product mentions** — Blue-colored pill badges
- **Product requests** — Green-colored pill badges with quantity (if specified)
- **Extracted commitments** — Formatted as arrow bullets with deadline dates
- **Expandable raw transcript** — Click to reveal the original dictated/typed notes

### Sidebar Intelligence Panels

**Trending Diseases** — Horizontal bar chart showing disease mentions ranked by the number of reporting reps. Helps identify emerging outbreaks across territories.

**Trending Products** — Product names with two metrics: "discussed" count and "requested" count. Products with active requests are highlighted in green.

**Hot Regions** — Clickable territory buttons with call count badges. Clicking a region filters the main timeline. Helps managers focus on the most active areas.

**Stock Alerts** — Shown when inventory items are flagged:
- Product name and category
- Current stock level (red if below reorder point) vs. reorder threshold
- Quantity currently on order
- High demand indicator with weekly request count

---

## 8. Golf Courses

Golf courses are the primary accounts in Allturf CRM. Each course has a rich profile with treatment history, seasonal programs, orders, visits, photos, and activity tracking.

### Course List (`/courses`)

- **Header** with course count badge
- **Search** by course name, city, or assigned rep
- **Table columns:**
  - Course name with maintenance level badge (color-coded by level)
  - City and province (hidden on mobile)
  - Number of holes (hidden on tablets)
  - Grass type for greens/fairways (hidden on large screens)
  - Last visit date with overall condition badge (Excellent = green, Good = blue, Fair = yellow, Poor = orange)
  - Active quote name and dollar value (hidden on large screens)
  - Assigned rep name (hidden on extra-large screens)
- **Row click** navigates to the course detail page

### Course Detail (`/courses/[id]`)

The detail page has a rich header section followed by a 7-tab interface.

**Header:**
- Back link to courses list
- Course name with MapPin icon
- Location (city, province)
- Badges: hole count, acreage, green grass type
- Maintenance level badge (color-coded primary)
- Annual turf budget range with dollar icon
- IPM program indicator badge (green) if enrolled

**Tab 1: Overview**
- Two-column layout: Course Details + Contacts
- Course details: course type, grass types (greens/fairways/rough), soil type, irrigation system, water source, USDA hardiness zone, microclimate notes, general notes
- Contacts section: list of contacts linked to the course showing name, role, phone, and email

**Tab 2: Treatment History**
- Vertical timeline view with connector line
- Timeline cards showing each treatment application:
  - Visit date (monospace font)
  - Product category badge (color-coded by category)
  - MOA (Mode of Action) group badge
  - Product name with PCP registration number
  - Target disease, application rate, target area
  - Treatment notes
- Empty state with icon when no treatment history exists
- Covers a 2-year rolling window for MOA rotation verification

**Tab 3: Seasonal Program**
- Program summary card: program name, type (Spring/Summer/Fall), season, budget tracking with a progress bar showing spend vs. budget
- Drag-and-drop task list (using @hello-pangea/dnd library):
  - Grip handle icon for reordering
  - Task title
  - Application date badge
  - Status badge (Done = green, In Progress = blue, Pending = gray)
  - Product name with application rate and target area subtitle
- "Create Program" button if no seasonal program exists for the course

**Tab 4: Orders**
- Spend summary: two-column grid showing "Delivered/Invoiced" total and "Pending" total
- Orders table: quote name (with PO number if present), pipeline stage (color-coded badge), value in CAD, expected delivery date
- Empty state when no orders exist

**Tab 5: Visits**
- Collapsible visit cards, one per visit report:
  - Visit date, overall condition badge, temperature, photo count badge
  - Expanded view shows:
    - Condition ratings for each area (greens, fairways, tees, rough) as individual badges
    - Weather info: temperature, humidity, rainfall, soil moisture
    - Observations and recommendations text
    - Follow-up actions with follow-up date
    - AI-generated summary in a highlighted box

**Tab 6: Photos**
- Grid gallery layout (2 columns on mobile, 3 on tablet, 4 on desktop)
- Photo cards with date overlay at the bottom
- Empty state with image icon

**Tab 7: Activity**
- Vertical timeline with connector line
- Activity cards showing:
  - Sentiment-colored dot (positive = green, neutral = gray, concerned = amber, urgent = red)
  - Type badge (Call Log or Activity)
  - Processing status indicator (if still processing)
  - Sentiment badge (if available)
  - Timestamp
  - Summary text (line-clamped to prevent overflow)
  - Rep name

---

## 9. Contacts

Contacts represent the people at golf courses — superintendents, general managers, assistant superintendents, and other staff.

### Contact List (`/contacts`)

**Header:** "Contacts" title with total count

**Filters:**
- Search box — by name, course, city, or email
- Status dropdown — New, Active, Inactive, Closed
- Role dropdown — Superintendent, General Manager, Assistant Superintendent, and other roles

**Bulk Actions Bar** (appears when one or more contacts are selected via checkboxes):
- Selection count display
- Status change dropdown with Apply button (change status for all selected contacts)
- Export CSV button (downloads selected contacts as CSV)
- Clear selection button

**Table** (25 rows per page with pagination):

| Column | Visibility |
|--------|-----------|
| Checkbox (selection) | Always |
| Name (with role shown inline on mobile) | Always |
| Role | Hidden on mobile |
| Course (clickable link to course detail) | Always |
| City | Hidden on mobile |
| Status (color-coded badge) | Hidden on mobile |
| Last Contacted (relative date) | Hidden on large screens |
| Follow-up Date (with overdue alert icon in red) | Hidden on medium screens |
| Preferred Contact Method icon (phone/email/text) | Hidden on extra-large screens |
| Chevron (click to open detail) | Always |

**Pagination:** Previous/Next buttons with page counter (e.g., "Page 2 of 15")

### Contact Detail Sheet

Clicking a contact row opens a right-side sheet panel with:

- **Header:** Full name, role, status badge
- **Company link** (clickable, navigates to course detail)
- **Contact grid:** Email, phone, preferred contact method, next follow-up date (highlighted red if overdue)
- **Quick actions:** Call button, Email button, Edit button
- **Notes textarea** — Auto-saves on blur (no explicit save button needed)
- **Activity timeline** — Last 10 activities showing type, relative date, and summary
- **Recent call summaries** — Last 3 processed calls with AI-generated summaries
- **Open deals** — Active deals linked to this contact

### Add/Edit Contact Dialog

A modal dialog for creating or editing contacts with fields:

- First name and last name (required)
- Email and phone
- Role dropdown
- Company/course selector (searchable, required)
- Status dropdown (required)
- Preferred contact method (phone/email/text)
- Next follow-up date picker
- Notes textarea
- Error message display for validation failures
- Save and Cancel buttons

---

## 10. Visit Reports

Visit reports capture what reps observe when they physically visit a golf course — conditions, weather, disease observations, photos, and follow-up needs.

### Visits Page (`/visits`)

**Header:** Visit count, view toggle (List/Calendar), "New Report" button

**List View:**
- Table with columns: date (monospace), course name, observations (truncated), follow-up date (with clock icon), rep name (hidden on extra-large screens)
- Pagination support for large datasets

**Calendar View:**
- Full month calendar with previous/next month navigation
- Day headers (Sun–Sat)
- Day cells containing:
  - Date number
  - Visit cards (up to 3 shown per day)
  - Each visit card has a color-coded condition badge background with course name
  - "+X more" indicator when a day has more than 3 visits

### New Visit Report Dialog

A modal dialog for logging a visit:

- **Course select** — Required, searchable dropdown
- **Contact select** — Optional, filters contacts by selected course
- **Visit type** — Routine, Follow-up, Demo, or Emergency
- **Visit date** — Required, defaults to today
- **Notes textarea** — Large text area with:
  - Voice input button (VoiceInput component for dictation)
  - Word count indicator
  - Generous minimum height for detailed field observations
- **Photo capture** — PhotoCapture component for taking and attaching photos from mobile camera
- **Follow-up date** — Optional date picker for scheduling the next visit
- Save button (disabled until course and date are filled)

**Quick Check-in FAB** — A mobile-first floating button for rapid visit logging (QuickCheckInFab component).

---

## 11. Sales Pipeline

The sales pipeline tracks deals (quotes and orders) through their lifecycle from initial quote to final invoice.

### Pipeline Page (`/pipeline`)

**Header:** Deal count, total pipeline value in CAD, search box, season filter dropdown

**Search:** By deal name, course name, or rep name

**Season Filter:** Derived from existing deals; allows filtering to a specific sales season

**Pipeline Summary:** Total number of deals and aggregate pipeline value displayed prominently

**Table Columns:**

| Column | Visibility |
|--------|-----------|
| Deal name with season badge | Always |
| Course name | Hidden on mobile |
| Number of items (products in the deal) | Hidden on tablet |
| Value in CAD | Always |
| Stage (inline dropdown for direct editing) | Always |
| Assigned rep | Hidden on large screens |
| Last updated date | Hidden on medium screens |

### Pipeline Stages

Deals progress through 7 active stages via an inline dropdown that persists changes immediately to the database:

| Stage | Color |
|-------|-------|
| Quote Draft | Light gray |
| Quote Sent | Light blue |
| Quote Approved | Light green |
| Order Placed | Light yellow |
| Shipped | Light amber |
| Delivered | Light green |
| Invoiced | Light gray |

Additional terminal stages (not shown in the pipeline view): Paid (green), Closed Lost (red).

---

## 12. Products

The products section serves as a catalog, inventory manager, and promotions hub.

### Product Catalog

**Category Filter Pills** — Horizontal scrollable row of category buttons, each with a category-specific background color:
- All (default)
- Fungicide
- Herbicide
- Insecticide
- Fertilizer
- Wetting Agent
- Seed

**Search** — By product name, active ingredient, target disease, or manufacturer name

**Product Cards** — Grid layout with cards showing:
- Product name
- Manufacturer name and PCP registration number
- Category badge (color-coded)
- MOA (Mode of Action) group
- Active ingredients (first 3 shown as badges)
- Target diseases (truncated list)
- Application rate range (min–max with unit)
- Price (bold)
- Ontario registration status — Green badge if registered (`ontario_class` populated), red badge if not registered

### Current Specials Section

Visible to all users. Displays active promotions as cards with:
- Promotion title
- Discount badge (percentage off, fixed dollar amount, volume discount, or bundle deal)
- Product name (if promotion targets a specific product)
- Description text
- Minimum quantity requirement (if applicable) and end date

### Promotion Manager (Admin-Only)

Accessed via the "Manage Specials" button in the header:

- **List of promotions** with edit and delete icons per row
- **Add Special** button to create new promotions
- **Promotion form fields:**
  - Title and description
  - Product selector (optional — can be a general promotion)
  - Discount type: Percentage, Fixed Amount, Volume Discount, or Bundle
  - Discount value
  - Minimum quantity (optional)
  - Start date and end date
  - Save and Cancel buttons

### Inventory Manager (Admin-Only)

Accessed via the "Manage Inventory" button in the header:

**Summary bar:** Number of tracked products and count of low-stock items

**Inventory table:**

| Column | Description | Visibility |
|--------|-------------|-----------|
| Product name | With "LOW" badge if below reorder point | Always |
| On Hand | Editable inline, highlighted red if below reorder point | Always |
| Committed | Editable inline | Hidden on mobile |
| On Order | Editable inline | Hidden on mobile |
| Reorder Point | Editable inline | Always |
| Demand/Week | Color-coded indicator if high demand | Always |
| Save | Appears when values are changed | Always |

- Low-stock products sort to the top of the table
- "Add untracked product" section at the bottom for newly added products
- All edits save inline with a per-row save button

---

## 13. Calendar

The calendar provides schedule management for reps and managers, aggregating events from multiple sources.

### Calendar Page (`/calendar`)

**Header:** "Calendar" title, view mode toggle (Month/Week/Day/List), "Create Event" button

### Views

**Month View** — Standard calendar grid with day cells. Events appear as color-coded cards on their dates:

| Event Type | Color |
|------------|-------|
| Site Visit | Green |
| Meeting | Blue |
| Delivery | Amber |
| Demo | Purple |
| Vacation | Gray |
| Networking | Indigo |
| Treatment Application | Teal |
| Follow-up | Orange |
| Overdue Follow-up | Red |

**Week View** — Seven-day layout with hourly time slots (6 AM – 9 PM)

**Day View** — Single-day hourly breakdown

**List View** — 30-day chronological list of events

### Event Sources

The calendar merges events from multiple data sources:

1. **Explicit calendar events** — Created directly in the calendar
2. **Deal deliveries** — Deals at the "Shipped" stage appear as delivery events
3. **Treatment program tasks** — Scheduled applications from seasonal programs
4. **Contact follow-ups** — Contacts with `next_follow_up` dates appear as follow-up events

### Event Types

Treatment Application, Follow-up, Sales Call, Site Visit, Demo, Meeting, Note, Reminder

### Create Event Dialog

- Title and description
- Event type selector
- Date picker
- Start and end time inputs
- All-day checkbox toggle
- Team member selector
- Location input
- Company and contact multi-select
- Save button

### Event Detail Sheet

Clicking an event opens a detail view with: title, description, type (color-coded label), date/time range, all-day indicator, team member, location, linked company and contact (as clickable links), and Edit/Delete buttons.

---

## 14. Reports & Analytics

The reports page provides at-a-glance metrics and visualizations for field activity and sales performance.

### Reports Page (`/reports`)

**Field Activity Section:**
- **Stat cards:** Calls This Week, Calls This Month, Visits This Week, Visits This Month
- **Top Diseases Mentioned** — Horizontal bar chart showing the top 5 diseases by mention count across all call logs
- **Top Products Discussed** — Horizontal bar chart showing the top 5 products by mention count

**Sales Summary Section:**
- **Stat cards:** Open Deals (count + total pipeline value in CAD), Closed This Month (count + revenue)
- **Revenue by Month** — Vertical bar chart showing the last 12 months of closed deal revenue

**Quick link** to the Daily Digest page for deeper analysis.

---

## 15. AI & Safety Systems

### LLM Architecture

**Provider:** Groq (llama-3.3-70b-versatile model)
- Default temperature: 0.3 (precision-oriented)
- Max tokens: 4096
- JSON response format support
- Single cached provider instance per process lifetime
- Architecture supports future Claude API integration via the `LLMProvider` interface abstraction

### 3-Layer Safety Model

Allturf CRM enforces Canadian pesticide regulations and professional best practices through three complementary layers:

#### Layer 1: System Prompt Injection

Every AI call includes the `SAFETY_SYSTEM_PROMPT` which mandates:

1. **PMRA Compliance** — "NEVER recommend pesticide application rates exceeding the PMRA label maximum."
2. **Ontario Registration** — "NEVER recommend products where `ontario_class` is null."
3. **PCP Registration Numbers** — "ALWAYS include PCP# when referencing any product."
4. **MOA Rotation** — "Check treatment history and flag if same MOA group used in last 2 applications on same area."
5. **Tank Mix Compatibility** — "Only recommend tank mixes in `compatible_tank_mixes` array."
6. **Agronomist Fallback** — "When confidence < 0.5, recommend consulting a certified agronomist."
7. **Application Rate Units** — "Always specify the unit (L/ha, mL/100m², kg/ha)."
8. **No Fabrication** — "Never fabricate product data — only reference provided context."

#### Layer 2: Task-Specific Prompts

Pre-defined prompt templates for 6 consultation tasks, each with domain-specific instructions:

| Task | Purpose |
|------|---------|
| `diagnose` | Disease/pest identification with confidence level, severity, and cultural recommendations |
| `recommend` | Product recommendations with MOA rotation checks and tank mix warnings |
| `programBuilder` | Seasonal treatment program design with budget constraints and MOA planning |
| `visitPrep` | Pre-visit briefing with weather context, recent treatments, and MOA alerts |
| `quoteFromNotes` | Extract product requests from conversation notes and match to catalog |
| `budgetOptimizer` | Optimize treatment programs within budget constraints |

#### Layer 3: Post-Processing Validation

The `validateRecommendations()` function runs after every AI response that includes product recommendations:

1. **Fetch product from database** — Verify the recommended product actually exists
2. **Ontario registration check** — If `ontario_class` is null, the recommendation is removed entirely with an error logged
3. **Clamp application rate to label max** — If the AI recommends a rate above `application_rate_max`, it is clamped to the label maximum with a warning
4. **Clamp to label minimum** — If the AI recommends a rate below `application_rate_min`, it is raised to the label minimum
5. **MOA rotation check** — Queries the last 2 treatments on the course; if the same MOA group was used, a resistance risk warning is generated
6. **Tank mix compatibility** — Cross-checks recommended combinations against the `compatible_tank_mixes` array; incompatible mixes generate warnings
7. **Attach PCP number** — Ensures PCP registration number is included in all outputs

### Safety Rule Enforcement Summary

| Rule | Prompt Layer | Validation Layer | Query Filter | UI Display |
|------|-------------|-----------------|-------------|-----------|
| PMRA label max rate | Yes | Yes (clamp) | No | No |
| Ontario registration | Yes | Yes (remove) | Yes (exclude unregistered) | Yes (badge) |
| PCP registration # | Yes | Yes (enrich) | No | Yes (on cards + nudges) |
| MOA rotation | Yes | Yes (2-year history check) | Yes (in turf context) | Yes (treatment history tab) |
| Tank mix compatibility | Yes | Yes (warning) | No | No |
| Confidence < 0.5 → agronomist | Yes | Yes (skip activity creation) | No | No |
| Application rate units | Yes | No | No | Yes (on product cards) |
| No fabrication | Yes | Yes (DB lookup validation) | Yes (only active, registered products in context) | No |

### Turf Context Builder

Before any AI call that requires domain context, the turf context builder assembles relevant information capped at ~6,000 tokens (~24,000 characters):

1. **Course Profile** (~800 chars) — Name, location, holes, acreage, grass types, soil, irrigation, maintenance level, budget
2. **Treatment History** (~2,000 chars) — Last 2 years of treatments with products, MOA groups, PCP numbers, rates
3. **Knowledge Base** (~1,500 chars) — Keyword-matched entries from `turf_knowledge_base` including symptoms and conditions
4. **Matching Products** (~1,500 chars) — Active, Ontario-registered offerings matching category/keywords with full product details
5. **Recent Weather** (~500 chars) — Last 7 days of weather snapshots with temperature, rainfall, humidity, GDD, and spray window status

A budget management system ensures no section exceeds its allocation, truncating gracefully if needed.

### AI Features Summary

| Feature | Trigger | Output |
|---------|---------|--------|
| Call summarization | Call log submitted | Summary, sentiment, confidence score |
| Entity extraction | Call log submitted | Diseases, products, contacts, companies, topics |
| Sentiment classification | Call log submitted | Positive, neutral, concerned, urgent |
| Commitment extraction | Call log submitted | What rep promised, deadline, owner |
| Reorder detection | Call log submitted | Repeat product requests with quantities |
| Nudge generation | Call processing pipeline | Up to 10 contextual nudges per call |
| Demand signal creation | Call processing pipeline | Request, reorder, and inquiry signals |
| Visit prep briefing | Manual trigger via API | Course history, weather, MOA alerts, suggestions |
| Quote extraction | Manual trigger via API | Product list with quantities from conversation notes |
| Trend detection | Daily digest generation or manual trigger | Disease outbreaks, demand spikes, inventory risks, seasonal patterns |
| Executive summary | Daily digest generation | 3-4 sentence management briefing |

---

## 16. Trend Detection Engine

The trend detection engine analyzes call log data over a rolling window to identify emerging patterns that require management attention.

### Detection Algorithms

#### Algorithm 1: Disease Outbreaks

**Trigger:** 3+ mentions from 2+ reps within the analysis window

**Process:** Clusters disease mentions by name (case-insensitive), aggregating call count, rep count, company count, affected regions, and first/last reported timestamps.

**Severity Classification:**
| Severity | Criteria |
|----------|----------|
| Critical | 5+ reps reporting |
| Warning | 3+ reps OR 2+ reps with 5+ total mentions |
| Watch | 2+ reps with fewer than 5 mentions |

**Recommended Actions:** Verify stock levels for key treatments (linked via `product_disease_links`), send advisory to reps in affected regions, update disease risk alerts on dashboard.

#### Algorithm 2: Product Demand Spikes

**Trigger:** 4+ calls mentioning the same product within the analysis window

**Process:** Clusters by product name, aggregating requests, mentions, rep count, and total requested quantity. Cross-references historical average order quantity from `deal_items`.

**Severity Classification:**
| Severity | Criteria |
|----------|----------|
| Critical | 8+ calls |
| Warning | 6+ calls |
| Watch | 4+ calls |

**Recommended Actions:** Verify stock levels, consider bulk ordering, alert warehouse team.

#### Algorithm 3: Inventory Risks

**Trigger:** Derived from demand spikes when committed quantity exceeds 1.5x the historical average

**Process:** For each demand spike signal, queries committed quantities from `deal_items` (deals at "Quote Approved", "Order Placed", or "Shipped" stages) and compares against the historical average from the last 100 deal items.

**Severity Classification:**
| Severity | Demand Multiplier |
|----------|------------------|
| Critical | 3x+ above historical average |
| Warning | 2x+ above historical average |
| Watch | 1.5x+ above historical average |

**Recommended Actions:** Review inventory and reorder thresholds, contact supplier about availability and lead times.

#### Algorithm 4: Seasonal Patterns

**Trigger:** Disease mentions 2x+ above the same calendar period in the previous year (or 5+ mentions with no prior year data)

**Process:** Compares current week's disease mentions against the same week in the previous year's call log extractions.

**Severity Classification:**
| Severity | Criteria |
|----------|----------|
| Warning | 3x+ increase vs. last year |
| Watch | 2x+ increase vs. last year |

**Recommended Actions:** Brief reps on proactive treatment recommendations, review product inventory against projected demand.

### Signal Storage & Deduplication

Trend signals are stored in the `field_trend_signals` table. Before inserting a new signal, the system checks for existing active signals of the same type and identifier:

- **If exists:** Merge contributing call IDs, update affected companies, upgrade severity if warranted
- **If new:** Insert fresh signal record

Each signal includes: type, severity, title, description, affected region, affected companies (array), contributing call IDs (array), data points count, recommended actions (array), and active status.

### Analysis Window

Default: 7-day rolling window. Configurable per invocation. The trend detection engine runs:
- During daily digest generation (automatic)
- On manual trigger via `POST /api/turf/detect-trends` (admin-only)

Signals feed into the daily digest alerts section and the field intelligence dashboard.

---

## 17. Data Model

### Core CRM Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `user_profiles` | Sales reps and admin users | → call_logs, deals, activities (as assignee) |
| `companies` | Golf courses and other customers | → contacts, deals, golf_course_profiles, visit_reports, weather_snapshots, demand_signals, calendar_events |
| `contacts` | People at courses (supers, managers) | → deals, activities, visit_reports, calendar_events |
| `offerings` | Turf products (fungicides, etc.) | → deal_items, product_disease_links, project_tasks, visit_recommendations, demand_signals, inventory |
| `deals` | Quotes and orders | → deal_items, projects, order_deliveries |
| `deal_items` | Line items in deals | → offerings (product reference) |
| `activities` | CRM activity records | → contacts, user_profiles |
| `calendar_events` | Scheduled events | → companies, contacts |

### Turf Domain Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `golf_course_profiles` | Course-specific agronomic data | → companies (1:1) |
| `turf_diseases_pests` | Disease and pest library | → product_disease_links, visit_observations, visit_recommendations |
| `product_disease_links` | Which products treat which diseases | → offerings, turf_diseases_pests |
| `visit_reports` | Field visit documentation | → companies, contacts, visit_observations, visit_recommendations |
| `visit_observations` | Diseases/pests observed at visits | → visit_reports, turf_diseases_pests |
| `visit_recommendations` | Products recommended during visits | → visit_reports, offerings, turf_diseases_pests |
| `weather_snapshots` | Daily weather per course | → companies |
| `order_deliveries` | Delivery tracking | → deals |
| `turf_knowledge_base` | Educational content library | Standalone (keyword-matched) |
| `projects` | Seasonal treatment programs | → companies, deals |
| `project_tasks` | Individual applications in programs | → projects, offerings |

### Sales Intelligence Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `call_logs` | Raw call records (voice/typed) | → user_profiles, companies, contacts → call_log_extractions (1:1), rep_nudges, demand_signals |
| `call_log_extractions` | AI-extracted structured data | → call_logs (1:1) |
| `rep_nudges` | Adaptive notifications for reps | → user_profiles, companies, contacts, call_logs |
| `field_trend_signals` | Auto-detected trends | → companies (array), call_logs (array) |
| `daily_digests` | Daily management briefings | Standalone (aggregated JSONB) |
| `inventory` | Product stock levels | → offerings (1:1) |
| `demand_signals` | Product demand from calls | → offerings, call_logs, user_profiles, companies |
| `promotions` | Active sales promotions | → offerings (optional) |

### Key Relationship Patterns

```
user_profiles (reps/admins)
├── call_logs (rep_id)
├── deals (assigned_rep_id)
├── activities (assigned_rep_id)
├── rep_nudges (rep_id)
└── demand_signals (source_rep_id)

companies (golf courses)
├── contacts (company_id)
├── golf_course_profiles (company_id, 1:1)
├── deals (company_id)
├── visit_reports (company_id)
├── weather_snapshots (company_id)
├── call_logs (company_id)
├── demand_signals (company_id)
└── calendar_events (company_id)

offerings (products)
├── deal_items (offering_id)
├── product_disease_links (product_id)
├── project_tasks (product_id)
├── visit_recommendations (product_id)
├── inventory (product_id, 1:1)
├── demand_signals (product_id)
└── promotions (product_id, optional)

call_logs
├── call_log_extractions (call_log_id, 1:1)
├── rep_nudges (call_log_id)
└── demand_signals (source_call_log_id)

turf_diseases_pests
├── product_disease_links (disease_pest_id)
├── visit_observations (disease_pest_id)
└── visit_recommendations (disease_pest_id)
```

---

*This document describes Allturf CRM as built through Phase 1.3 (Inventory & Demand Intelligence). Generated 2026-03-21.*

# Allturf CRM — Demo Walkthrough Guide

**Total demo time: ~17 minutes**
**Date in demo system: March 20, 2026**

---

## 1. Setup (30 seconds)

```bash
npm run dev
```

Open `http://localhost:3000` and log in with a demo rep account:

| Rep | Email | Territory | Password |
|-----|-------|-----------|----------|
| Mike Thompson | mike.thompson@allturf.ca | GTA / Toronto | DemoPass2026! |
| Sarah Chen | sarah.chen@allturf.ca | Golden Horseshoe / Niagara | DemoPass2026! |
| Dave Kowalski | dave.kowalski@allturf.ca | Eastern Ontario / Ottawa | DemoPass2026! |
| Lisa Moreau | lisa.moreau@allturf.ca | Northern Ontario | DemoPass2026! |
| James Wilson | james.wilson@allturf.ca | Blue Mountain / Collingwood | DemoPass2026! |

**Start as Mike Thompson** (GTA territory — has the most demo data and Dollar Spot activity).

> Switch between reps or use an admin account to show manager views during the Sales Intelligence section.

---

## 2. Dashboard Tour (2 minutes)

After login, the dashboard shows four widgets:

- **Recent Calls** — latest call logs across all reps with sentiment indicators (green/yellow/orange/red dots for positive/neutral/concerned/urgent)
- **Daily Digest** — yesterday's field activity summary: total calls, top diseases mentioned, top products requested
- **Team Activity** — management overview of rep activity levels
- **Field Trends** (manager view) — active trend signals including the Dollar Spot outbreak warning

**What to point out:**
- The Daily Digest shows Dollar Spot as the #1 mentioned disease across the team
- The Field Trends card shows a **warning-level** "Dollar Spot Outbreak — GTA & Golden Horseshoe" signal and a **watch-level** "Banner Maxx II Demand Spike"
- 90 days of Ontario weather data (Dec 2025 – Mar 2026) powers GDD tracking and spray window calculations behind the scenes
- The **Quick Check-in FAB** (floating button) lets reps log calls from mobile

---

## 3. Consultation Engine Demo (3 minutes)

Navigate to **Consultation** in the sidebar.

**Left panel:**
- Search and select **Lambton Golf and Country Club** (GTA territory)
- The course context panel shows recent visits, open quotes, and course profile summary

**Right panel — run a diagnosis:**
- Type this symptom description:

> Seeing dollar spot on greens 3, 7, and 12. Patches about 2 inches, straw colored, cobweb mycelium visible in morning dew. Appears to be spreading to fairway approaches.

- Click **Diagnose**
- **Show the diagnosis cards:**
  - Dollar Spot (Clarireedia jacksonii) — high confidence
  - Each card shows: confidence score, matched symptoms, cultural control recommendations
- Click **Get Recommendations** on the Dollar Spot card
- **Show the product recommendations:**
  - Banner Maxx II (Propiconazole, DMI Group 3) — PCP #24353
  - Heritage Maxx (Azoxystrobin, QoI Group 11)
  - Daconil Action (Chlorothalonil, Multi-site M5)
  - Products are ranked by fit, with MOA rotation considered against the course's treatment history

**Safety features to highlight:**
- Application rates stay within PMRA label maximums (legal requirement)
- Only Ontario-registered products shown (`ontario_class` verified)
- MOA rotation warnings if the course recently used the same group
- "If the AI confidence drops below 50%, it recommends consulting a certified agronomist"

- Click **Add to Quote** on a recommended product → it appears in the sticky quote builder at the bottom
- Click **Create Quote Draft** → creates a deal in the pipeline automatically

---

## 4. Product Catalog Demo (2 minutes)

Navigate to **Products** in the sidebar.

- **Filter by category:** select "Fungicide" — shows Banner Maxx II, Heritage Maxx, Daconil Action, Instrata II, Emerald, Pristine, Chipco Signature, Rovral, Subdue Maxx
- **Search by disease:** type "dollar spot" — filters to products targeting Dollar Spot
- **Open Banner Maxx II** — show the product detail card:
  - Active ingredient: Propiconazole
  - MOA Group: 3 (DMI)
  - PCP Registration: #24353
  - Application rate: 1.6–3.2 L/ha
  - Target diseases: Dollar Spot, Brown Patch, Gray Snow Mold, Pink Snow Mold, Fairy Ring, Anthracnose, Red Thread, Leaf Spot, Summer Patch
  - Signal word, re-entry interval, rain-fast hours
- **Rate Calculator:** input course acreage → shows quantity needed at label rate
- **Tank Mix Checker:** select Banner Maxx II + Daconil Action → show compatibility result

---

## 5. Course Profile Demo (2 minutes)

Navigate to **Courses** → open **Lambton Golf and Country Club** (or **Brockville Country Club** for Eastern Ontario data).

Walk through the **7 tabs:**

| Tab | What to show |
|-----|-------------|
| **Overview** | Course type, number of holes, acreage, grass types (greens/fairways/rough), soil type, irrigation system, maintenance level, budget range, IPM accreditation |
| **Treatment History** | Timeline of applied products with MOA group badges — point out rotation patterns |
| **Seasonal Program** | Drag-and-drop treatment schedule — Spring/Summer/Fall programs with products, target dates, application rates, status toggles (To Do → In Progress → Done) |
| **Orders** | Spend summary (Delivered/Invoiced vs. Pending), deal table with stages and values |
| **Visits** | Expandable visit report cards — condition ratings, temperature/humidity/rainfall readings, disease observations, AI-generated summaries |
| **Photos** | Gallery grid from visit reports with date and condition overlays |
| **Activity** | Combined timeline of calls and activities with sentiment indicators |

**Key talking point:** "Everything about this course — history, programs, visits, orders — is in one place. The rep walks in fully prepared."

---

## 6. Pipeline Demo (1 minute)

Navigate to **Deals** / **Pipeline** in the sidebar.

- **Kanban board** shows deals across 9 stages:
  Quote Draft → Quote Sent → Quote Approved → Order Placed → Shipped → Delivered → Invoiced → Paid → Closed Lost
- **Drag a deal** from "Quote Sent" to "Quote Approved" — shows the stage update in real time
- Toggle **season grouping** to see deals organized by Spring/Summer/Fall programs
- **Quick action:** click a deal in "Quote Approved" → convert to order (moves to "Order Placed")

**Point out:** Deals created from the Consultation Engine flow directly into this pipeline.

---

## 7. Sales Intelligence Demo (3 minutes)

**This is the key differentiator. Spend the most energy here.**

### Rep View — Log a Call

- Click the **Quick Check-in FAB** (or navigate to call logging)
- Open in a narrow viewport or phone to show mobile-first design
- Select **Lambton Golf and Country Club** as the course
- Type (or dictate) this call note:

> Just met with the super at Lambton. Dollar spot is getting worse on the front 9 greens, especially 3, 5, and 7. He wants Banner Maxx urgently — at least 6 cases. Also asked about Heritage Maxx as a rotation option and wants pricing on a fall overseeding program.

- Submit the call log
- **Show processing:** status changes from "pending" → "processing" → "completed"
- **Show the AI extraction** that appears:
  - Contact matched to the Lambton superintendent
  - Diseases identified: Dollar Spot
  - Products mentioned: Banner Maxx II, Heritage Maxx
  - Products requested: Banner Maxx II (6 cases, urgent)
  - Action items generated with due dates
  - Sentiment: concerned
  - Key topics tagged: `dollar_spot`, `product_inquiry`, `fall_program`

- **Show nudges generated** from the call:
  - Inventory alert: "Banner Maxx II — check stock levels, 6 cases requested"
  - Cross-sell opportunity: "Heritage Maxx mentioned as MOA rotation — send pricing"
  - Action reminder: "Follow up on fall overseeding program quote"

### Manager View — Field Intelligence

Switch to an admin/manager account (or show the manager widgets).

- **Daily Digest** (covers March 14–20, 2026):
  - Total calls logged per day across all reps
  - Top diseases: Dollar Spot dominates from March 16 onward
  - Top products requested: Banner Maxx II spike visible from March 17
  - Per-rep activity breakdown with call counts and follow-up needs

- **Field Trends** — four active signals:

| Signal | Severity | What it shows |
|--------|----------|---------------|
| **Dollar Spot Outbreak — GTA & Golden Horseshoe** | Warning | 8–10 call logs from 3+ reps mention Dollar Spot in the last 7 days. Recommended actions: alert reps, proactive outreach, verify Banner Maxx stock |
| **Banner Maxx II Demand Spike** | Watch | 4–5 orders in 5 days vs. typical 1–2/week. Actions: check stock, prepare Heritage/Instrata alternatives |
| **Early Season Disease Pressure — Above Normal** | Watch | March 2026 disease reports 40% above 3-year average. Warmer late-Feb temps accelerated spring emergence |
| **Budget Concerns — Northern Ontario** | Info | 3 accounts flagged budget constraints — prepare alternative programs |

**Closing line for this section:**

> "This is how management knows what's happening in the field in real time — without waiting for Friday sales meetings. The system detected the Dollar Spot outbreak by connecting call logs from three different reps across two territories. No one rep saw the full picture, but the AI did."

---

## 8. Visit Workflow Demo (2 minutes)

### Pre-Visit Briefing
- Navigate to a course (e.g., **Scarboro Golf and Country Club**)
- Show the **pre-visit briefing**: AI-generated talking points based on recent activity, disease risks from weather data, outstanding quotes, and last visit notes

### Post-Visit Report
- Open the visit report form
- Show the structured input: overall condition rating (1–5), temperature, humidity, soil moisture readings
- Add disease observations (select from disease list → condition area → severity)
- Add recommendations with product links
- Photo upload capability
- Submit → report appears in the course's **Visits** tab with an AI-generated summary

---

## 9. Treatment Programs Demo (1 minute)

Navigate to a course with an active program (check the **Seasonal Program** tab on any GTA or Golden Horseshoe course).

- Show the **program overview**: Spring 2026 or Full Season program
- **Application schedule**: ordered list of treatment tasks with:
  - Product name and MOA group
  - Target application date
  - Application rate (within PMRA limits)
  - Target area (Greens / Fairways / Tees)
  - Status: To Do → In Progress → Done (drag to reorder)
- **Budget tracking bar**: spent vs. allocated budget with visual progress
- **MOA rotation**: point out alternating MOA groups across sequential applications (e.g., Group 3 → Group 11 → Group M5 → Group 7)

**Talking point:** "The system enforces MOA rotation in the program builder — it won't let you stack the same mode of action back-to-back, which prevents fungicide resistance."

---

## 10. Reports Demo (1 minute)

Navigate to **Reports** in the sidebar.

- **Territory overview**: revenue by month across the rep's territory
- **Product category breakdown**: Fungicide vs. Insecticide vs. Wetting Agent vs. Seed revenue mix
- **Disease occurrence**: map of disease reports across the territory — Dollar Spot concentrated in GTA and Golden Horseshoe

---

## Closing Talking Points

Use these to wrap up the demo:

> **"Every interaction feeds the intelligence layer."**
> The more reps use it — logging calls, filing visit reports, running consultations — the smarter the system gets. Trend detection improves with volume.

> **"Management gets real-time field intelligence without waiting for meetings."**
> The Daily Digest and Field Trends surface what matters automatically. The Dollar Spot outbreak was detected across three reps' territories before anyone connected the dots manually.

> **"The AI follows PMRA regulations automatically."**
> Application rates never exceed label maximums. Only Ontario-registered products are recommended. MOA rotation is checked against the course's 2-year treatment history. Safer for the courses, less compliance risk for Allturf.

> **"Reps spend less time on data entry and more time selling."**
> Voice dictation on mobile, AI extraction of contacts/products/action items, automatic nudge generation — the system does the admin work so reps can focus on relationships and revenue.

---

## Demo Data Reset

If you need to reset and reimport the demo data:

```bash
npm run reset-demo      # clears all demo data (preserves seed/reference data)
npm run import-demo     # reimports everything (~2 minutes)
npm run verify-demo     # confirms all data is correct
```

To reimport a single step (e.g., just call logs):
```bash
npm run import-demo -- --step=16
```

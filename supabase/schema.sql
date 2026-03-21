-- ============================================================================
-- Allturf CRM — Core Schema (Phase 1.1)
-- 10 tables adapted from Avant CRM patterns for the turf products domain
-- Uses gen_random_uuid() (PG13+ built-in) — no extensions required
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Shared trigger function — sets updated_at = now() on every UPDATE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Tables (FK-dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1  user_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- no default; value comes from Supabase Auth
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  approved    BOOLEAN NOT NULL DEFAULT false,
  territory   TEXT,
  phone       TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.2  companies
-- ----------------------------------------------------------------------------
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  industry    TEXT CHECK (industry IS NULL OR industry IN ('Golf Course', 'Sports Turf', 'Municipal Parks', 'Landscaping', 'Other')),
  website     TEXT,
  city        TEXT,
  province    TEXT CHECK (province IS NULL OR province IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.3  contacts
-- ----------------------------------------------------------------------------
CREATE TABLE contacts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name               TEXT NOT NULL,
  last_name                TEXT NOT NULL,
  email                    TEXT,
  phone                    TEXT,
  title                    TEXT,
  company_id               UUID REFERENCES companies(id) ON DELETE SET NULL,
  role                     TEXT CHECK (role IS NULL OR role IN ('Superintendent', 'Assistant Superintendent', 'Grounds Crew', 'General Manager', 'Director of Agronomy', 'Owner', 'Purchasing')),
  status                   TEXT DEFAULT 'New' CHECK (status IN ('New', 'No Answer', 'Left Voicemail', 'Follow Up', 'Active Customer', 'Inactive', 'Prospect', 'Do Not Contact')),
  preferred_contact_method TEXT,
  notes                    TEXT,
  last_contacted_at        TIMESTAMPTZ,
  next_follow_up           DATE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.4  offerings
-- ----------------------------------------------------------------------------
-- NOTE: compatible_tank_mixes is UUID[] referencing other offerings rows.
-- PostgreSQL cannot enforce FK constraints on array elements; enforce at the
-- application layer.
CREATE TABLE offerings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  description               TEXT,
  price                     NUMERIC NOT NULL DEFAULT 0,
  category                  TEXT NOT NULL DEFAULT 'Other' CHECK (category IN ('Fungicide', 'Herbicide', 'Insecticide', 'Fertilizer', 'Seed', 'Wetting Agent', 'Growth Regulator', 'Adjuvant', 'Other')),
  is_active                 BOOLEAN DEFAULT true,
  manufacturer              TEXT,
  active_ingredients        TEXT[],
  pcp_registration_number   TEXT,
  application_rate_min      NUMERIC,
  application_rate_max      NUMERIC,
  application_rate_unit     TEXT,
  pack_sizes                JSONB,
  target_diseases           TEXT[],
  target_pests              TEXT[],
  compatible_tank_mixes     UUID[],
  seasonal_availability     TEXT[],
  re_entry_interval_hours   NUMERIC,
  rain_fast_hours           NUMERIC,
  signal_word               TEXT,
  mode_of_action            TEXT,
  moa_group                 TEXT,
  sds_url                   TEXT,
  label_pdf_url             TEXT,
  ontario_class             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.5  deals
-- ----------------------------------------------------------------------------
CREATE TABLE deals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  company_id              UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id              UUID REFERENCES contacts(id) ON DELETE SET NULL,
  stage                   TEXT DEFAULT 'Quote Draft' CHECK (stage IN ('Quote Draft', 'Quote Sent', 'Quote Approved', 'Order Placed', 'Shipped', 'Delivered', 'Invoiced', 'Paid', 'Closed Lost')),
  value_cad               NUMERIC DEFAULT 0,
  notes                   TEXT,
  order_type              TEXT CHECK (order_type IS NULL OR order_type IN ('Standard', 'Seasonal Program', 'Emergency', 'Re-Order')),
  expected_delivery_date  DATE,
  actual_delivery_date    DATE,
  po_number               TEXT,
  season                  TEXT,
  assigned_rep_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.6  deal_items
-- ----------------------------------------------------------------------------
CREATE TABLE deal_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  offering_id       UUID REFERENCES offerings(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit_price        NUMERIC NOT NULL DEFAULT 0,
  discount_percent  NUMERIC DEFAULT 0,
  notes             TEXT,
  coverage_area_m2  NUMERIC,
  application_count INTEGER,
  pack_size_label   TEXT,
  application_rate  NUMERIC,
  target_area       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.7  activities
-- ----------------------------------------------------------------------------
-- NOTE: visit_report_id FK will be added in Phase 1.2 when the
-- visit_reports table is created. Column is included now for forward compat.
CREATE TABLE activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id       UUID REFERENCES contacts(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('Phone Call', 'Email', 'Site Visit', 'Meeting', 'Note', 'Product Demo', 'Sample Drop-off', 'Follow Up')),
  summary          TEXT,
  ai_summary       TEXT,
  assigned_rep_id  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  visit_report_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.8  projects
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  deal_id          UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_type     TEXT NOT NULL CHECK (project_type IN ('Spring Program', 'Summer Program', 'Fall Program', 'Winter Prep', 'Full Season', 'Custom')),
  status           TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
  sales_owner      TEXT,
  project_lead     TEXT,
  team_members     TEXT[] DEFAULT '{}',
  description      TEXT,
  value_cad        NUMERIC DEFAULT 0,
  start_date       DATE,
  target_end_date  DATE,
  actual_end_date  DATE,
  season_year      INTEGER,
  total_budget     NUMERIC,
  spent_to_date    NUMERIC DEFAULT 0,
  assigned_rep_id  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.9  project_tasks
-- ----------------------------------------------------------------------------
CREATE TABLE project_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Done')),
  assignee              TEXT,
  priority              TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  due_date              DATE,
  sort_order            INTEGER DEFAULT 0,
  application_date      DATE,
  product_id            UUID REFERENCES offerings(id) ON DELETE SET NULL,
  application_rate      NUMERIC,
  target_area           TEXT,
  weather_window_start  TIMESTAMPTZ,
  weather_window_end    TIMESTAMPTZ,
  gdd_threshold         NUMERIC,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2.10  calendar_events
-- ----------------------------------------------------------------------------
CREATE TABLE calendar_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  event_type   TEXT NOT NULL CHECK (event_type IN ('meeting', 'networking', 'vacation', 'site_visit', 'delivery', 'demo')),
  start_date   DATE NOT NULL,
  end_date     DATE,
  start_time   TIME,
  end_time     TIME,
  is_all_day   BOOLEAN DEFAULT false,
  team_member  TEXT NOT NULL,
  location     TEXT,
  company_id   UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. Triggers — update updated_at on every table
-- ============================================================================

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_offerings_updated_at
  BEFORE UPDATE ON offerings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deal_items_updated_at
  BEFORE UPDATE ON deal_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4. Indexes — FK columns + frequently filtered/sorted columns
-- ============================================================================

-- contacts
CREATE INDEX idx_contacts_company_id     ON contacts(company_id);
CREATE INDEX idx_contacts_status         ON contacts(status);
CREATE INDEX idx_contacts_email          ON contacts(email);
CREATE INDEX idx_contacts_next_follow_up ON contacts(next_follow_up);

-- offerings
CREATE INDEX idx_offerings_category      ON offerings(category);
CREATE INDEX idx_offerings_is_active     ON offerings(is_active);
CREATE INDEX idx_offerings_moa_group     ON offerings(moa_group);

-- deals
CREATE INDEX idx_deals_company_id        ON deals(company_id);
CREATE INDEX idx_deals_contact_id        ON deals(contact_id);
CREATE INDEX idx_deals_stage             ON deals(stage);
CREATE INDEX idx_deals_assigned_rep_id   ON deals(assigned_rep_id);

-- deal_items
CREATE INDEX idx_deal_items_deal_id      ON deal_items(deal_id);
CREATE INDEX idx_deal_items_offering_id  ON deal_items(offering_id);

-- activities
CREATE INDEX idx_activities_deal_id          ON activities(deal_id);
CREATE INDEX idx_activities_contact_id       ON activities(contact_id);
CREATE INDEX idx_activities_type             ON activities(type);
CREATE INDEX idx_activities_assigned_rep_id  ON activities(assigned_rep_id);
CREATE INDEX idx_activities_created_at       ON activities(created_at DESC);

-- projects
CREATE INDEX idx_projects_deal_id          ON projects(deal_id);
CREATE INDEX idx_projects_company_id       ON projects(company_id);
CREATE INDEX idx_projects_contact_id       ON projects(contact_id);
CREATE INDEX idx_projects_status           ON projects(status);
CREATE INDEX idx_projects_assigned_rep_id  ON projects(assigned_rep_id);

-- project_tasks
CREATE INDEX idx_project_tasks_project_id  ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_product_id  ON project_tasks(product_id);
CREATE INDEX idx_project_tasks_status      ON project_tasks(status);

-- calendar_events
CREATE INDEX idx_calendar_events_start_end    ON calendar_events(start_date, end_date);
CREATE INDEX idx_calendar_events_team_member  ON calendar_events(team_member);
CREATE INDEX idx_calendar_events_company_id   ON calendar_events(company_id);
CREATE INDEX idx_calendar_events_contact_id   ON calendar_events(contact_id);

-- ============================================================================
-- 5. Row-Level Security — enable + permissive policy per table
-- ============================================================================

ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON user_profiles   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON companies       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON contacts        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON offerings       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON deals           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON deal_items      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON activities      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON projects        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON project_tasks   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON calendar_events FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Phase 1.2 — Turf-Domain Tables (9 tables)
-- ============================================================================

-- ============================================================================
-- 6. Tables (FK-dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1  golf_course_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE golf_course_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  num_holes             INTEGER,
  total_acreage         NUMERIC,
  course_type           TEXT CHECK (course_type IS NULL OR course_type IN ('Private', 'Public', 'Semi-Private', 'Resort', 'Municipal')),
  grass_types           TEXT[],
  green_grass           TEXT,
  fairway_grass         TEXT,
  rough_grass           TEXT,
  irrigation_type       TEXT,
  water_source          TEXT,
  soil_type             TEXT,
  microclimate_zone     TEXT,
  usda_zone             TEXT,
  annual_turf_budget_min NUMERIC,
  annual_turf_budget_max NUMERIC,
  maintenance_level     TEXT CHECK (maintenance_level IS NULL OR maintenance_level IN ('Championship', 'High', 'Standard', 'Budget')),
  ipm_program           BOOLEAN DEFAULT false,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6.2  turf_diseases_pests
-- ----------------------------------------------------------------------------
CREATE TABLE turf_diseases_pests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('Disease', 'Pest', 'Weed')),
  scientific_name      TEXT,
  symptoms             TEXT,
  affected_grass_types TEXT[],
  affected_areas       TEXT[],
  season_start         TEXT,
  season_end           TEXT,
  optimal_temp_min_c   NUMERIC,
  optimal_temp_max_c   NUMERIC,
  humidity_factor      TEXT,
  severity             TEXT,
  cultural_controls    TEXT,
  image_url            TEXT,
  ontario_common       BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6.3  product_disease_links
-- ----------------------------------------------------------------------------
CREATE TABLE product_disease_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  disease_pest_id UUID NOT NULL REFERENCES turf_diseases_pests(id) ON DELETE CASCADE,
  efficacy        TEXT CHECK (efficacy IS NULL OR efficacy IN ('Excellent', 'Good', 'Fair', 'Preventive Only')),
  is_primary      BOOLEAN DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, disease_pest_id)
);

-- ----------------------------------------------------------------------------
-- 6.4  visit_reports
-- ----------------------------------------------------------------------------
CREATE TABLE visit_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id         UUID REFERENCES activities(id) ON DELETE SET NULL,
  company_id          UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  rep_id              UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  visit_date          DATE NOT NULL,
  overall_condition   TEXT CHECK (overall_condition IS NULL OR overall_condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Critical')),
  greens_condition    TEXT CHECK (greens_condition IS NULL OR greens_condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Critical')),
  fairways_condition  TEXT CHECK (fairways_condition IS NULL OR fairways_condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Critical')),
  tees_condition      TEXT CHECK (tees_condition IS NULL OR tees_condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Critical')),
  rough_condition     TEXT CHECK (rough_condition IS NULL OR rough_condition IN ('Excellent', 'Good', 'Fair', 'Poor', 'Critical')),
  temperature_c       NUMERIC,
  humidity_percent    NUMERIC,
  recent_rainfall_mm  NUMERIC,
  soil_moisture       TEXT,
  observations        TEXT,
  recommendations     TEXT,
  follow_up_actions   TEXT,
  follow_up_date      DATE,
  photo_urls          TEXT[],
  ai_summary          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6.5  visit_observations
-- ----------------------------------------------------------------------------
CREATE TABLE visit_observations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_report_id  UUID NOT NULL REFERENCES visit_reports(id) ON DELETE CASCADE,
  disease_pest_id  UUID REFERENCES turf_diseases_pests(id) ON DELETE SET NULL,
  severity         TEXT,
  affected_area    TEXT,
  area_m2_affected NUMERIC,
  photo_url        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6.6  visit_recommendations
-- ----------------------------------------------------------------------------
CREATE TABLE visit_recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_report_id  UUID NOT NULL REFERENCES visit_reports(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES offerings(id) ON DELETE SET NULL,
  disease_pest_id  UUID REFERENCES turf_diseases_pests(id) ON DELETE SET NULL,
  application_rate NUMERIC,
  target_area      TEXT,
  priority         TEXT CHECK (priority IS NULL OR priority IN ('Immediate', 'This Week', 'This Month', 'Seasonal')),
  was_ordered      BOOLEAN DEFAULT false,
  deal_id          UUID REFERENCES deals(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6.7  weather_snapshots
-- ----------------------------------------------------------------------------
CREATE TABLE weather_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date    DATE NOT NULL,
  temp_high_c      NUMERIC,
  temp_low_c       NUMERIC,
  temp_avg_c       NUMERIC,
  rainfall_mm      NUMERIC,
  humidity_avg     NUMERIC,
  wind_avg_kmh     NUMERIC,
  gdd_daily        NUMERIC,
  gdd_cumulative   NUMERIC,
  gdd_base_temp_c  NUMERIC,
  is_spray_window  BOOLEAN DEFAULT false,
  source           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, snapshot_date)
);

-- ----------------------------------------------------------------------------
-- 6.8  order_deliveries
-- ----------------------------------------------------------------------------
CREATE TABLE order_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  scheduled_date  DATE,
  actual_date     DATE,
  status          TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Transit', 'Delivered', 'Partial', 'Cancelled')),
  delivery_notes  TEXT,
  received_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6.9  turf_knowledge_base
-- ----------------------------------------------------------------------------
CREATE TABLE turf_knowledge_base (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category            TEXT NOT NULL CHECK (category IN ('disease', 'pest', 'cultural_practice', 'regulation', 'product_tip')),
  title               TEXT NOT NULL,
  content             TEXT,
  symptoms            TEXT,
  conditions          TEXT,
  grass_types         TEXT[],
  seasonal_relevance  TEXT[],
  keywords            TEXT[],
  source              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. Deferred FK — activities.visit_report_id → visit_reports
-- ============================================================================

ALTER TABLE activities
  ADD CONSTRAINT fk_activities_visit_report
  FOREIGN KEY (visit_report_id) REFERENCES visit_reports(id) ON DELETE SET NULL;

-- ============================================================================
-- 8. Triggers — Phase 1.2 tables
-- ============================================================================

CREATE TRIGGER trg_golf_course_profiles_updated_at
  BEFORE UPDATE ON golf_course_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_turf_diseases_pests_updated_at
  BEFORE UPDATE ON turf_diseases_pests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_product_disease_links_updated_at
  BEFORE UPDATE ON product_disease_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_visit_reports_updated_at
  BEFORE UPDATE ON visit_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_visit_observations_updated_at
  BEFORE UPDATE ON visit_observations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_visit_recommendations_updated_at
  BEFORE UPDATE ON visit_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_weather_snapshots_updated_at
  BEFORE UPDATE ON weather_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_order_deliveries_updated_at
  BEFORE UPDATE ON order_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_turf_knowledge_base_updated_at
  BEFORE UPDATE ON turf_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 9. Indexes — Phase 1.2 tables
-- ============================================================================

-- product_disease_links
CREATE INDEX idx_product_disease_links_product_id      ON product_disease_links(product_id);
CREATE INDEX idx_product_disease_links_disease_pest_id ON product_disease_links(disease_pest_id);

-- visit_reports
CREATE INDEX idx_visit_reports_company_visit_date ON visit_reports(company_id, visit_date);
CREATE INDEX idx_visit_reports_rep_id             ON visit_reports(rep_id);
CREATE INDEX idx_visit_reports_activity_id        ON visit_reports(activity_id);

-- visit_observations
CREATE INDEX idx_visit_observations_visit_report_id ON visit_observations(visit_report_id);
CREATE INDEX idx_visit_observations_disease_pest_id ON visit_observations(disease_pest_id);

-- visit_recommendations
CREATE INDEX idx_visit_recommendations_visit_report_id ON visit_recommendations(visit_report_id);
CREATE INDEX idx_visit_recommendations_product_id      ON visit_recommendations(product_id);

-- order_deliveries
CREATE INDEX idx_order_deliveries_deal_id ON order_deliveries(deal_id);
CREATE INDEX idx_order_deliveries_status  ON order_deliveries(status);

-- turf_knowledge_base
CREATE INDEX idx_turf_knowledge_base_category ON turf_knowledge_base(category);
CREATE INDEX idx_turf_knowledge_base_keywords ON turf_knowledge_base USING GIN (keywords);

-- ============================================================================
-- 10. Row-Level Security — Phase 1.2 tables
-- ============================================================================

ALTER TABLE golf_course_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE turf_diseases_pests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_disease_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_observations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_recommendations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliveries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE turf_knowledge_base     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON golf_course_profiles    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON turf_diseases_pests     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON product_disease_links   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON visit_reports           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON visit_observations      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON visit_recommendations   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON weather_snapshots       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON order_deliveries        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON turf_knowledge_base     FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Phase 1.3 — Call Activity & AI Analysis Tables (5 tables)
-- ============================================================================

-- ============================================================================
-- 11. Tables (FK-dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 11.1  call_logs — Raw rep input (voice memos, typed notes, quick check-ins)
-- ----------------------------------------------------------------------------
CREATE TABLE call_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id              UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  activity_id         UUID REFERENCES activities(id) ON DELETE SET NULL,
  input_type          TEXT NOT NULL CHECK (input_type IN ('voice_dictation', 'typed_notes', 'call_recording_transcript', 'visit_notes')),
  raw_transcript      TEXT,
  duration_seconds    INTEGER,
  processing_status   TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11.2  call_log_extractions — AI-extracted structured data from call_logs
-- ----------------------------------------------------------------------------
CREATE TABLE call_log_extractions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id          UUID NOT NULL UNIQUE REFERENCES call_logs(id) ON DELETE CASCADE,
  summary              TEXT,
  sentiment            TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'concerned', 'urgent')),
  diseases_mentioned   TEXT[],
  products_mentioned   TEXT[],
  products_requested   JSONB,
  competitor_mentions  TEXT[],
  budget_signals       TEXT,
  follow_up_needed     BOOLEAN DEFAULT false,
  follow_up_date       DATE,
  action_items         JSONB,
  key_topics           TEXT[],
  confidence_score     NUMERIC CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11.3  rep_nudges — AI-generated follow-up suggestions for reps
-- ----------------------------------------------------------------------------
CREATE TABLE rep_nudges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id            UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  call_log_id       UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  nudge_type        TEXT NOT NULL CHECK (nudge_type IN ('inventory_alert', 'promo_available', 'related_info', 'action_reminder', 'cross_sell', 'disease_alert')),
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title             TEXT NOT NULL,
  message           TEXT,
  suggested_action  TEXT,
  due_date          DATE,
  is_dismissed      BOOLEAN DEFAULT false,
  dismissed_at      TIMESTAMPTZ,
  is_completed      BOOLEAN DEFAULT false,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11.4  field_trend_signals — Aggregated trends across rep activities
-- ----------------------------------------------------------------------------
CREATE TABLE field_trend_signals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type           TEXT NOT NULL CHECK (signal_type IN ('disease_outbreak', 'product_demand_spike', 'inventory_risk', 'seasonal_pattern', 'pricing_concern')),
  severity              TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'warning', 'critical')),
  title                 TEXT NOT NULL,
  description           TEXT,
  affected_region       TEXT,
  affected_companies    UUID[],
  contributing_call_ids UUID[],
  data_points           INTEGER DEFAULT 0,
  first_reported_at     TIMESTAMPTZ,
  last_reported_at      TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT true,
  resolved_at           TIMESTAMPTZ,
  recommended_actions   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11.5  daily_digests — Management summaries generated daily
-- ----------------------------------------------------------------------------
CREATE TABLE daily_digests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date              DATE NOT NULL UNIQUE,
  total_calls_logged       INTEGER DEFAULT 0,
  total_follow_ups_needed  INTEGER DEFAULT 0,
  top_diseases             JSONB,
  top_products             JSONB,
  rep_activity_breakdown   JSONB,
  key_highlights           TEXT,
  alerts                   TEXT,
  generated_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. Triggers — Phase 1.3 tables
-- ============================================================================

CREATE TRIGGER trg_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_call_log_extractions_updated_at
  BEFORE UPDATE ON call_log_extractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rep_nudges_updated_at
  BEFORE UPDATE ON rep_nudges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_field_trend_signals_updated_at
  BEFORE UPDATE ON field_trend_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_daily_digests_updated_at
  BEFORE UPDATE ON daily_digests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 13. Indexes — Phase 1.3 tables
-- ============================================================================

-- call_logs
CREATE INDEX idx_call_logs_rep_id              ON call_logs(rep_id);
CREATE INDEX idx_call_logs_company_id          ON call_logs(company_id);
CREATE INDEX idx_call_logs_contact_id          ON call_logs(contact_id);
CREATE INDEX idx_call_logs_activity_id         ON call_logs(activity_id);
CREATE INDEX idx_call_logs_processing_status   ON call_logs(processing_status);
CREATE INDEX idx_call_logs_created_at          ON call_logs(created_at DESC);

-- call_log_extractions (call_log_id already has UNIQUE index)
CREATE INDEX idx_call_log_extractions_diseases  ON call_log_extractions USING GIN (diseases_mentioned);
CREATE INDEX idx_call_log_extractions_products  ON call_log_extractions USING GIN (products_mentioned);
CREATE INDEX idx_call_log_extractions_topics    ON call_log_extractions USING GIN (key_topics);
CREATE INDEX idx_call_log_extractions_sentiment ON call_log_extractions(sentiment);

-- rep_nudges
CREATE INDEX idx_rep_nudges_rep_id      ON rep_nudges(rep_id);
CREATE INDEX idx_rep_nudges_company_id  ON rep_nudges(company_id);
CREATE INDEX idx_rep_nudges_contact_id  ON rep_nudges(contact_id);
CREATE INDEX idx_rep_nudges_call_log_id ON rep_nudges(call_log_id);
CREATE INDEX idx_rep_nudges_nudge_type  ON rep_nudges(nudge_type);
CREATE INDEX idx_rep_nudges_priority    ON rep_nudges(priority);
CREATE INDEX idx_rep_nudges_due_date    ON rep_nudges(due_date);
CREATE INDEX idx_rep_nudges_active      ON rep_nudges(is_dismissed, is_completed);

-- field_trend_signals
CREATE INDEX idx_field_trend_signals_signal_type       ON field_trend_signals(signal_type);
CREATE INDEX idx_field_trend_signals_severity          ON field_trend_signals(severity);
CREATE INDEX idx_field_trend_signals_is_active         ON field_trend_signals(is_active);
CREATE INDEX idx_field_trend_signals_affected_companies ON field_trend_signals USING GIN (affected_companies);
CREATE INDEX idx_field_trend_signals_contributing_calls ON field_trend_signals USING GIN (contributing_call_ids);

-- daily_digests (digest_date already has UNIQUE index)
CREATE INDEX idx_daily_digests_generated_at ON daily_digests(generated_at);

-- ============================================================================
-- 14. Row-Level Security — Phase 1.3 tables
-- ============================================================================

ALTER TABLE call_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_log_extractions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_nudges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_trend_signals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_digests         ENABLE ROW LEVEL SECURITY;

-- call_logs: reps see own, managers/admins see all
CREATE POLICY "Reps see own call logs" ON call_logs
  FOR SELECT USING (
    rep_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Reps insert own call logs" ON call_logs
  FOR INSERT WITH CHECK (rep_id = auth.uid());
CREATE POLICY "Reps update own call logs" ON call_logs
  FOR UPDATE USING (
    rep_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins delete call logs" ON call_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- call_log_extractions: follow parent call_log visibility
CREATE POLICY "Reps see own extractions" ON call_log_extractions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM call_logs WHERE call_logs.id = call_log_extractions.call_log_id
        AND (call_logs.rep_id = auth.uid()
             OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );
CREATE POLICY "System inserts extractions" ON call_log_extractions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System updates extractions" ON call_log_extractions
  FOR UPDATE USING (true);

-- rep_nudges: reps see own, admins see all
CREATE POLICY "Reps see own nudges" ON rep_nudges
  FOR SELECT USING (
    rep_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "System inserts nudges" ON rep_nudges
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Reps update own nudges" ON rep_nudges
  FOR UPDATE USING (
    rep_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins delete nudges" ON rep_nudges
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- field_trend_signals: all authenticated users can read, admins manage
CREATE POLICY "Authenticated users read trends" ON field_trend_signals
  FOR SELECT USING (true);
CREATE POLICY "System inserts trends" ON field_trend_signals
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System updates trends" ON field_trend_signals
  FOR UPDATE USING (true);
CREATE POLICY "Admins delete trends" ON field_trend_signals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- daily_digests: all authenticated users can read, system manages
CREATE POLICY "Authenticated users read digests" ON daily_digests
  FOR SELECT USING (true);
CREATE POLICY "System inserts digests" ON daily_digests
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System updates digests" ON daily_digests
  FOR UPDATE USING (true);
CREATE POLICY "Admins delete digests" ON daily_digests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

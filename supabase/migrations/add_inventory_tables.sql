-- Lightweight inventory tracking + automatic demand signal generation
-- from rep call processing. Not a full warehouse system — a demand
-- intelligence layer that helps the company "buy better, inventory better."

-- Simple inventory tracker
CREATE TABLE inventory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  quantity_on_hand  integer NOT NULL DEFAULT 0,
  quantity_committed integer NOT NULL DEFAULT 0,
  quantity_on_order integer NOT NULL DEFAULT 0,
  reorder_point     integer NOT NULL DEFAULT 0,
  last_updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES user_profiles(id),
  notes             text,
  UNIQUE (product_id)
);

-- Demand signals (auto-generated from call processing)
CREATE TABLE demand_signals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid REFERENCES offerings(id),
  product_name        text NOT NULL,
  signal_type         text NOT NULL CHECK (signal_type IN ('request', 'reorder', 'inquiry', 'complaint')),
  source_call_log_id  uuid REFERENCES call_logs(id),
  source_rep_id       uuid REFERENCES user_profiles(id),
  company_id          uuid REFERENCES companies(id),
  quantity_mentioned  integer,
  region              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_low_stock ON inventory(quantity_on_hand, reorder_point)
  WHERE quantity_on_hand <= reorder_point;

CREATE INDEX idx_demand_signals_product_id ON demand_signals(product_id);
CREATE INDEX idx_demand_signals_created_at ON demand_signals(created_at DESC);
CREATE INDEX idx_demand_signals_signal_type ON demand_signals(signal_type);

-- RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_signals ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view inventory
CREATE POLICY "All users can view inventory" ON inventory
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can manage inventory (insert/update/delete)
CREATE POLICY "Admins manage inventory" ON inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All authenticated users can view demand signals
CREATE POLICY "All users can view demand signals" ON demand_signals
  FOR SELECT USING (auth.role() = 'authenticated');

-- System/authenticated users can create demand signals
CREATE POLICY "Authenticated users create demand signals" ON demand_signals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE inventory IS 'Lightweight product inventory tracker — manually updated, enriched by demand signals';
COMMENT ON TABLE demand_signals IS 'Auto-generated from call processing — tracks product demand across rep conversations';

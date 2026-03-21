-- Promotions table: specials / discounts admins can flag for AI nudge integration
CREATE TABLE promotions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  product_id uuid REFERENCES offerings(id),
  discount_type text CHECK (discount_type IN ('percentage', 'fixed_amount', 'volume_pricing', 'bundle')),
  discount_value numeric,
  min_quantity integer,
  start_date date NOT NULL,
  end_date date NOT NULL,
  active boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view active promotions"
  ON promotions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage promotions"
  ON promotions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_promotions_product_id ON promotions(product_id);
CREATE INDEX idx_promotions_active_dates ON promotions(active, start_date, end_date)
  WHERE active = true;

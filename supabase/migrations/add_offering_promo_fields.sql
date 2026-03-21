-- Add promotion fields to offerings for the promo_available nudge type.
-- When a product has an active promo, the call processor generates a nudge
-- so reps can mention the special to customers who requested that product.

ALTER TABLE offerings
  ADD COLUMN IF NOT EXISTS promo_message text,
  ADD COLUMN IF NOT EXISTS promo_discount_percent numeric,
  ADD COLUMN IF NOT EXISTS promo_expires_at timestamptz;

COMMENT ON COLUMN offerings.promo_message IS 'Active promotion message (e.g., "15% off for orders over 10 cases")';
COMMENT ON COLUMN offerings.promo_discount_percent IS 'Current promotion discount percentage';
COMMENT ON COLUMN offerings.promo_expires_at IS 'When the current promotion expires';

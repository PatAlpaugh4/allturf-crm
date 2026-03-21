-- A9: Add richer extraction fields to call_log_extractions
-- These columns store structured data extracted by the LLM from rep dictations.

ALTER TABLE call_log_extractions
  ADD COLUMN IF NOT EXISTS extracted_contact_name text,
  ADD COLUMN IF NOT EXISTS extracted_company_name text,
  ADD COLUMN IF NOT EXISTS extracted_products_requested text[],
  ADD COLUMN IF NOT EXISTS extracted_quantities jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_commitments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_reorders jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS urgency_level text DEFAULT 'routine';

-- Index on urgency_level for filtering urgent items
CREATE INDEX IF NOT EXISTS idx_call_log_extractions_urgency
  ON call_log_extractions (urgency_level)
  WHERE urgency_level IN ('urgent', 'emergency');

COMMENT ON COLUMN call_log_extractions.extracted_contact_name IS 'Primary contact name extracted from transcript';
COMMENT ON COLUMN call_log_extractions.extracted_company_name IS 'Primary company/course name extracted from transcript';
COMMENT ON COLUMN call_log_extractions.extracted_products_requested IS 'Product names mentioned as requests';
COMMENT ON COLUMN call_log_extractions.extracted_quantities IS 'Product quantities: [{product, quantity, unit}]';
COMMENT ON COLUMN call_log_extractions.extracted_commitments IS 'Promises/agreements: [{description, deadline, owner}]';
COMMENT ON COLUMN call_log_extractions.extracted_reorders IS 'Repeat orders: [{product_name, quantity, unit, needed_by}]';
COMMENT ON COLUMN call_log_extractions.urgency_level IS 'Overall urgency: routine, soon, urgent, emergency';

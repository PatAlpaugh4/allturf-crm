-- Add source tracking to calendar_events for AI-generated events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source_call_log_id uuid REFERENCES call_logs(id);

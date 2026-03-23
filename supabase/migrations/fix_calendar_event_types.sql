-- Bug #1: Allow AI-generated event types (follow_up, commitment) plus other valid types
-- that were missing from the original CHECK constraint.
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN ('meeting', 'networking', 'vacation', 'site_visit', 'delivery', 'demo', 'follow_up', 'commitment'));

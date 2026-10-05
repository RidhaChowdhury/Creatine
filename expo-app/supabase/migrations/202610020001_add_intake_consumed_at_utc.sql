-- Add an explicit instant alongside legacy local-wall consumed_at values.
-- Existing rows remain NULL until the separately reviewed repair script identifies
-- records whose UTC instant can be established from logged_at.
alter table public.intake_log
   add column if not exists consumed_at_utc timestamptz null;

create index if not exists idx_intake_log_user_consumed_at_utc
   on public.intake_log (user_id, consumed_at_utc);

notify pgrst, 'reload schema';

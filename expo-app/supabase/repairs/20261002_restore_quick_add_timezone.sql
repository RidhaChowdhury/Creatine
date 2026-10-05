-- One-time repair for the 23 confirmed UTC wall-time writes from the first
-- Pitwall deployment. Original values and historical local-time rows stay intact.
-- Requires the additive consumed_at_utc migration first.
begin;
do $$
declare
  affected integer;
begin
  select count(*) into affected from public.intake_log
  where logged_at >= timestamptz '2026-10-02 03:27:00+00'
    and logged_at < timestamptz '2026-10-02 03:32:00+00'
    and consumable = 'water' and unit = 'oz'
    and abs(extract(epoch from ((consumed_at at time zone 'UTC') - logged_at))) < 120;
  if affected <> 23 then
    raise exception 'Timezone repair expected 23 confirmed entries, found %', affected;
  end if;
  update public.intake_log
  set consumed_at_utc = consumed_at at time zone 'UTC'
  where consumed_at_utc is null
    and logged_at >= timestamptz '2026-10-02 03:27:00+00'
    and logged_at < timestamptz '2026-10-02 03:32:00+00'
    and consumable = 'water' and unit = 'oz'
    and abs(extract(epoch from ((consumed_at at time zone 'UTC') - logged_at))) < 120;
end $$;
commit;

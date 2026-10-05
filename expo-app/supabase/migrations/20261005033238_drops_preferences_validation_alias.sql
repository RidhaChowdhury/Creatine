-- Real PostgreSQL rejects alias p because it conflicts with the PL/pgSQL variable.
create or replace function public.drops_validate_preferences() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prefs jsonb:=new.preferences_json; p jsonb; key text; scalar double precision;
begin
  if jsonb_typeof(prefs) is distinct from 'object' then raise exception 'Preferences must be an object'; end if;
  if prefs ? 'timezone' then
    if jsonb_typeof(prefs->'timezone') is distinct from 'string' or length(prefs->>'timezone')=0 then raise exception 'Invalid timezone'; end if;
    perform now() at time zone (prefs->>'timezone');
  end if;
  if prefs ? 'remindersEnabled' and jsonb_typeof(prefs->'remindersEnabled') is distinct from 'boolean' then raise exception 'Invalid reminders preference'; end if;
  if prefs ? 'bedtime' and (jsonb_typeof(prefs->'bedtime') is distinct from 'string' or prefs->>'bedtime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Invalid bedtime'; end if;
  if prefs ? 'caffeineHalfLifeHours' then
    if jsonb_typeof(prefs->'caffeineHalfLifeHours') is distinct from 'number' or not ((prefs->>'caffeineHalfLifeHours')::double precision between 1 and 24) then raise exception 'Invalid caffeine half-life'; end if;
  end if;
  if prefs ? 'priorUse' then
    p:=prefs->'priorUse';
    if jsonb_typeof(p) is distinct from 'object' or p->>'creatine' is null or p->>'creatine' not in ('unknown','not-using','using','established') or p->>'caffeine' is null or p->>'caffeine' not in ('unknown','not-using','using') then raise exception 'Invalid prior-use context'; end if;
    if p ? 'startDate' then perform (p->>'startDate')::date; end if;
    if p ? 'usualDoseGrams' and (jsonb_typeof(p->'usualDoseGrams') is distinct from 'number' or not ((p->>'usualDoseGrams')::double precision>0 and (p->>'usualDoseGrams')::double precision<'Infinity'::double precision)) then raise exception 'Invalid prior-use quantity'; end if;
    if p ? 'consistency' and (p->>'consistency' is null or p->>'consistency' not in ('occasional','most-days','daily')) then raise exception 'Invalid prior-use consistency'; end if;
  end if;
  if prefs ? 'waterPresets' then
    if jsonb_typeof(prefs->'waterPresets') is distinct from 'array' then raise exception 'Invalid water presets'; end if;
    if exists(select 1 from jsonb_array_elements(prefs->'waterPresets') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate water preset identifiers'; end if;
    for p in select value from jsonb_array_elements(prefs->'waterPresets') loop
      if jsonb_typeof(p->'id') is distinct from 'string' or length(btrim(p->>'id'))=0 or jsonb_typeof(p->'amount') is distinct from 'number' or not((p->>'amount')::double precision>0 and (p->>'amount')::double precision<'Infinity'::double precision) or p->>'unit' is null or p->>'unit' not in ('oz','ml','mL','L','cup') then raise exception 'Invalid water preset'; end if;
    end loop;
  end if;
  if prefs ? 'prominentPresetIds' then
    if jsonb_typeof(prefs->'prominentPresetIds') is distinct from 'array' or jsonb_array_length(prefs->'prominentPresetIds')>2 then raise exception 'Choose up to two prominent presets'; end if;
    if prefs ? 'waterPresets' and exists(select 1 from jsonb_array_elements_text(prefs->'prominentPresetIds') id where not exists(select 1 from jsonb_array_elements(prefs->'waterPresets') preset where preset->>'id'=id)) then raise exception 'Prominent presets must exist'; end if;
  end if;
  return new;
end $$;

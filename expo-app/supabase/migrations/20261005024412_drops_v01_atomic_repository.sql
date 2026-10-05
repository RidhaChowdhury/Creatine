-- Drops v0.1: additive metadata and transactional owner-scoped RPCs.
-- Legacy consumed_at values are NEVER backfilled or reinterpreted as UTC.
alter table public.intake_log add column if not exists note text not null default '';
alter table public.intake_log add column if not exists mutation_version integer not null default 1;
alter table public.tracker_entries add column if not exists consumed_at_utc timestamptz;
alter table public.tracker_entries add column if not exists note text not null default '';
alter table public.tracker_entries add column if not exists mutation_version integer not null default 1;
do $metric$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tracked_items' and column_name='metric_type') then
    alter table public.tracked_items add column metric_type text not null default 'other';
    update public.tracked_items set metric_type=builtin_key where builtin_key in ('creatine','fiber','caffeine');
  end if;
end $metric$;
alter table public.tracked_items add column if not exists archived boolean not null default false;
alter table public.tracked_items add column if not exists grams_per_unit double precision;
-- Archive is reversible. Prevent an accidental profile deletion from cascading history.
alter table public.tracker_entries drop constraint if exists tracker_entries_item_owner_fk;
alter table public.tracker_entries add constraint tracker_entries_item_owner_fk
foreign key(user_id,tracker_id) references public.tracked_items(user_id,id) on delete restrict;

create table if not exists public.drops_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tracker_id text not null,
  profile_json jsonb not null check (jsonb_typeof(profile_json)='object'),
  primary key(user_id,tracker_id)
);
create table if not exists public.drops_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences_json jsonb not null default '{}'::jsonb check(jsonb_typeof(preferences_json)='object')
);
create table if not exists public.drops_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id text not null check(length(btrim(operation_id))>0),
  request_json jsonb not null,
  receipt_json jsonb not null,
  raw_before jsonb,
  undone_by text,
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id)
);
create index if not exists idx_drops_operations_owner_created on public.drops_operations(user_id,created_at desc);

do $policies$
declare t text;
begin
  foreach t in array array['drops_profiles','drops_preferences','drops_operations'] loop
    execute format('alter table public.%I enable row level security',t);
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Drops owner access') then
      execute format('create policy "Drops owner access" on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
    end if;
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $policies$;

-- Same-owner profile references, including the virtual water tracker.
create or replace function public.drops_validate_profile_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
declare zone text; today date; previous_plan jsonb;
begin
  perform public.drops_validate_profile(new.profile_json);
  if new.profile_json->>'id' is distinct from new.tracker_id then raise exception 'Profile identifier mismatch'; end if;
  if new.tracker_id <> 'builtin:water' and not exists(select 1 from public.tracked_items where user_id=new.user_id and id=new.tracker_id) then
    raise exception 'Profile must reference an owned tracker' using errcode='23503';
  end if;
  if new.tracker_id<>'builtin:water' and not exists(select 1 from public.tracked_items where user_id=new.user_id and id=new.tracker_id and name=new.profile_json->>'name' and unit=new.profile_json->>'unit' and category=new.profile_json->>'category' and metric_type=new.profile_json->>'metricType' and archived=(new.profile_json->>'archived')::boolean) then raise exception 'Profile metadata must match its owned tracker'; end if;
  if tg_op='UPDATE' then
    select preferences_json->>'timezone' into zone from public.drops_preferences where user_id=new.user_id;
    today:=(now() at time zone coalesce(zone,'UTC'))::date;
    for previous_plan in select value from jsonb_array_elements(old.profile_json->'plans') where (value->>'effectiveFrom')::date<today loop
      if not exists(select 1 from jsonb_array_elements(new.profile_json->'plans') supplied where supplied=previous_plan) then raise exception 'Historical plans changed; refresh before saving'; end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists drops_profile_owner on public.drops_profiles;
create trigger drops_profile_owner before insert or update on public.drops_profiles for each row execute function public.drops_validate_profile_owner();

-- Unit dimensions are explicit. Count/custom units convert only to themselves.
create or replace function public.drops_unit_dimension(unit_value text) returns text
language sql immutable security invoker set search_path='' as $$
select case when unit_value in ('oz','ml','mL','L','cup','tsp','tbsp') then 'volume'
when unit_value in ('g','mg') then 'mass' else 'custom:'||unit_value end $$;

create or replace function public.drops_unit_factor(unit_value text) returns double precision
language sql immutable security invoker set search_path='' as $$
select case unit_value when 'oz' then 29.5735295625 when 'ml' then 1 when 'mL' then 1
when 'L' then 1000 when 'cup' then 240 when 'tsp' then 4.92892159375 when 'tbsp' then 14.78676478125
when 'g' then 1000 when 'mg' then 1 else 1 end::double precision $$;

-- Apply the same validation to RPC and direct REST writes. Missing JSON fields
-- fail explicitly; SQL NULL never turns an invalid payload into an accepted one.
create or replace function public.drops_validate_profile(profile jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare key text; p jsonb; d jsonb; weekday jsonb; scalar double precision;
begin
  if jsonb_typeof(profile) is distinct from 'object' then raise exception 'Profile must be an object'; end if;
  foreach key in array array['id','name','unit','category','metricType'] loop
    if jsonb_typeof(profile->key) is distinct from 'string' or length(btrim(profile->>key))=0 then raise exception 'Profile field % is required',key; end if;
  end loop;
  if jsonb_typeof(profile->'archived') is distinct from 'boolean' or jsonb_typeof(profile->'plans') is distinct from 'array' then raise exception 'Profile archive and plans are required'; end if;
  if profile->>'category' not in ('water','supplement','medication') or profile->>'metricType' not in ('water','creatine','fiber','caffeine','other') then raise exception 'Invalid profile type'; end if;
  if profile->>'id'='builtin:water' and (profile->>'category'<>'water' or profile->>'metricType'<>'water' or (profile->>'archived')::boolean or profile->>'unit' not in ('oz','ml','mL','L','cup')) then raise exception 'Water requires an active water profile and volume unit'; end if;
  if profile->>'id'<>'builtin:water' and (profile->>'category'='water' or profile->>'metricType'='water') then raise exception 'Water uses its built-in tracker'; end if;
  if profile->>'id'='builtin:creatine' and (profile->>'category'<>'supplement' or profile->>'metricType'<>'creatine' or profile->>'unit' not in ('g','mg')) then raise exception 'Invalid built-in creatine'; end if;
  foreach key in array array['savedDose','gramsPerUnit'] loop
    if profile ? key and profile->key<>'null'::jsonb then
      if jsonb_typeof(profile->key) is distinct from 'number' then raise exception 'Invalid %',key; end if;
      scalar:=(profile->>key)::double precision;
      if not(scalar>0 and scalar<'Infinity'::double precision) then raise exception 'Invalid %',key; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(profile->'plans') x group by x->>'effectiveFrom' having count(*)>1) then raise exception 'Only one plan applies from each civil day'; end if;
  for p in select value from jsonb_array_elements(profile->'plans') loop
    foreach key in array array['id','effectiveFrom','mode','unit'] loop
      if jsonb_typeof(p->key) is distinct from 'string' or length(btrim(p->>key))=0 then raise exception 'Plan field % is required',key; end if;
    end loop;
    if p->>'effectiveFrom' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid effective date'; end if;
    perform (p->>'effectiveFrom')::date;
    if p->>'mode' not in ('scheduled','as-needed') or jsonb_typeof(p->'days') is distinct from 'array' or jsonb_typeof(p->'doses') is distinct from 'array' then raise exception 'Invalid plan mode, days or doses'; end if;
    if public.drops_unit_dimension(p->>'unit')<>public.drops_unit_dimension(profile->>'unit') and p->>'effectiveFrom'>=to_char(current_date,'YYYY-MM-DD') then raise exception 'Incompatible current plan unit'; end if;
    for weekday in select value from jsonb_array_elements(p->'days') loop
      if jsonb_typeof(weekday) is distinct from 'number' then raise exception 'Invalid planned day'; end if;
      scalar:=(weekday#>>'{}')::double precision;
      if scalar not between 0 and 6 or scalar<>floor(scalar) then raise exception 'Invalid planned day'; end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(p->'days') x group by x having count(*)>1) then raise exception 'Duplicate planned days'; end if;
    if p->>'mode'='as-needed' and jsonb_array_length(p->'doses')>0 then raise exception 'As-needed plans have no doses'; end if;
    foreach key in array array['target','limit'] loop
      if p ? key and p->key<>'null'::jsonb then
        if jsonb_typeof(p->key) is distinct from 'number' then raise exception 'Invalid plan %',key; end if;
        scalar:=(p->>key)::double precision;
        if not(scalar>0 and scalar<'Infinity'::double precision) then raise exception 'Invalid plan %',key; end if;
      end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(p->'doses') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate dose identifiers'; end if;
    for d in select value from jsonb_array_elements(p->'doses') loop
      foreach key in array array['id','time','unit'] loop
        if jsonb_typeof(d->key) is distinct from 'string' or length(btrim(d->>key))=0 then raise exception 'Dose field % is required',key; end if;
      end loop;
      if d->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(d->'amount') is distinct from 'number' then raise exception 'Invalid scheduled dose'; end if;
      scalar:=(d->>'amount')::double precision;
      if not(scalar>0 and scalar<'Infinity'::double precision) or public.drops_unit_dimension(d->>'unit')<>public.drops_unit_dimension(p->>'unit') then raise exception 'Invalid scheduled dose quantity'; end if;
    end loop;
  end loop;
end $$;

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
    if prefs ? 'waterPresets' and exists(select 1 from jsonb_array_elements_text(prefs->'prominentPresetIds') id where not exists(select 1 from jsonb_array_elements(prefs->'waterPresets') p where p->>'id'=id)) then raise exception 'Prominent presets must exist'; end if;
  end if;
  return new;
end $$;
drop trigger if exists drops_preferences_valid on public.drops_preferences;
create trigger drops_preferences_valid before insert or update on public.drops_preferences for each row execute function public.drops_validate_preferences();

create or replace function public.drops_save_profile(profile jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); tracker text:=profile->>'id'; p jsonb; d jsonb; target_value double precision;
  existing_profile jsonb; zone text; today date; active_plan jsonb;
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  perform public.drops_validate_profile(profile);
  select preferences_json->>'timezone' into zone from public.drops_preferences where user_id=owner_id;
  today:=(now() at time zone coalesce(zone,'UTC'))::date;
  select profile_json into existing_profile from public.drops_profiles where user_id=owner_id and tracker_id=tracker;
  if existing_profile is not null then
    for p in select value from jsonb_array_elements(existing_profile->'plans') where (value->>'effectiveFrom')::date<today loop
      if not exists(select 1 from jsonb_array_elements(profile->'plans') supplied where supplied=p) then raise exception 'Historical plans changed; refresh before saving'; end if;
    end loop;
  end if;
  if tracker is null or length(btrim(profile->>'name'))=0 or length(btrim(profile->>'unit'))=0 or
    profile->>'metricType' not in ('water','creatine','fiber','caffeine','other') or profile->>'category' not in ('water','supplement','medication') then raise exception 'Invalid tracker profile'; end if;
  if profile->>'savedDose' is not null and not ((profile->>'savedDose')::double precision>0 and (profile->>'savedDose')::double precision<'Infinity'::double precision) then raise exception 'Invalid saved dose'; end if;
  if profile->>'gramsPerUnit' is not null and not ((profile->>'gramsPerUnit')::double precision>0 and (profile->>'gramsPerUnit')::double precision<'Infinity'::double precision) then raise exception 'Invalid explicit conversion'; end if;
  if tracker='builtin:water' and (profile->>'category'<>'water' or profile->>'metricType'<>'water' or (profile->>'archived')::boolean) then raise exception 'Water must remain active'; end if;
  if tracker='builtin:creatine' and (profile->>'category'<>'supplement' or profile->>'metricType'<>'creatine' or profile->>'unit' not in ('g','mg')) then raise exception 'Invalid built-in creatine'; end if;
  for p in select value from jsonb_array_elements(profile->'plans') loop
    if p->>'mode' not in ('scheduled','as-needed') or p->>'effectiveFrom' is null or p->>'unit' is null then raise exception 'Invalid plan'; end if;
    perform (p->>'effectiveFrom')::date;
    if public.drops_unit_dimension(p->>'unit')<>public.drops_unit_dimension(profile->>'unit') then raise exception 'Incompatible plan unit'; end if;
    if exists(select 1 from jsonb_array_elements_text(p->'days') x where x::int not between 0 and 6) then raise exception 'Invalid planned day'; end if;
    if p->>'mode'='as-needed' and jsonb_array_length(p->'doses')>0 then raise exception 'As-needed plans have no doses'; end if;
    if p->>'target' is not null and not ((p->>'target')::double precision>0 and (p->>'target')::double precision<'Infinity'::double precision) then raise exception 'Invalid target'; end if;
    if p->>'limit' is not null and not ((p->>'limit')::double precision>0 and (p->>'limit')::double precision<'Infinity'::double precision) then raise exception 'Invalid limit'; end if;
    for d in select value from jsonb_array_elements(p->'doses') loop
      if (d->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or not ((d->>'amount')::double precision>0 and (d->>'amount')::double precision<'Infinity'::double precision) or public.drops_unit_dimension(d->>'unit')<>public.drops_unit_dimension(p->>'unit') then raise exception 'Invalid scheduled dose'; end if;
    end loop;
  end loop;
  if tracker<>'builtin:water' then
    insert into public.tracked_items(user_id,id,name,unit,saved_dose,category,builtin_key,metric_type,archived,grams_per_unit)
    values(owner_id,tracker,profile->>'name',profile->>'unit',(profile->>'savedDose')::double precision,profile->>'category',case when tracker in ('builtin:creatine','builtin:fiber','builtin:caffeine') then substring(tracker from 9) else null end,profile->>'metricType',(profile->>'archived')::boolean,(profile->>'gramsPerUnit')::double precision)
    on conflict(user_id,id) do update set name=excluded.name,unit=excluded.unit,saved_dose=excluded.saved_dose,category=excluded.category,metric_type=excluded.metric_type,archived=excluded.archived,grams_per_unit=excluded.grams_per_unit;
  end if;
  insert into public.drops_profiles(user_id,tracker_id,profile_json) values(owner_id,tracker,profile)
  on conflict(user_id,tracker_id) do update set profile_json=excluded.profile_json;
  if (profile->>'archived')::boolean then update public.tracker_preferences set primary_tracker_id=null where user_id=owner_id and primary_tracker_id=tracker; end if;
  select value into active_plan from jsonb_array_elements(profile->'plans') where (value->>'effectiveFrom')::date<=today order by value->>'effectiveFrom' desc limit 1;
  if active_plan->>'target' is not null then
    if public.drops_unit_dimension(active_plan->>'unit')<>public.drops_unit_dimension(profile->>'unit') then raise exception 'Incompatible target unit'; end if;
    target_value:=(active_plan->>'target')::double precision*public.drops_unit_factor(active_plan->>'unit')/public.drops_unit_factor(profile->>'unit');
  end if;
  if tracker='builtin:water' then update public.user_settings set drink_unit=profile->>'unit',water_goal=coalesce(target_value,0) where user_id=owner_id;
  elsif tracker='builtin:creatine' then update public.user_settings set supplement_unit=profile->>'unit',creatine_goal=coalesce(target_value,0) where user_id=owner_id; end if;
end $$;

create or replace function public.drops_patch_preferences(changes jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); merged jsonb;
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if jsonb_typeof(changes)<>'object' then raise exception 'Preferences must be an object'; end if;
  select preferences_json into merged from public.drops_preferences where user_id=owner_id;
  merged:=coalesce(merged,'{}'::jsonb)||changes;
  if merged ? 'timezone' then perform now() at time zone (merged->>'timezone'); end if;
  if merged ? 'caffeineHalfLifeHours' and not ((merged->>'caffeineHalfLifeHours')::double precision between 1 and 24) then raise exception 'Invalid caffeine half-life'; end if;
  if merged ? 'bedtime' and (merged->>'bedtime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid bedtime'; end if;
  insert into public.drops_preferences(user_id,preferences_json) values(owner_id,merged) on conflict(user_id) do update set preferences_json=excluded.preferences_json;
end $$;

-- First configured load saves device IANA timezone once. Another device's saved
-- preferences always win; initialization never overwrites an existing row.
create or replace function public.drops_initialize_preferences(initial jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); saved jsonb;
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  insert into public.drops_preferences(user_id,preferences_json) values(owner_id,initial) on conflict(user_id) do nothing;
  select preferences_json into saved from public.drops_preferences where user_id=owner_id;
  return saved;
end $$;

create or replace function public.drops_set_primary(tracker text) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if tracker is not null and not exists(select 1 from public.tracked_items where user_id=owner_id and id=tracker and not archived) then raise exception 'Choose an active owned supplement or medication'; end if;
  insert into public.tracker_preferences(user_id,primary_tracker_id) values(owner_id,tracker) on conflict(user_id) do update set primary_tracker_id=excluded.primary_tracker_id;
end $$;

create or replace function public.drops_mutate_entry(mutation jsonb,request_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); operation text:=mutation->>'operationId'; before_entry jsonb:=nullif(mutation->'before','null'::jsonb); after_entry jsonb:=nullif(mutation->'after','null'::jsonb);
  prior_operation public.drops_operations%rowtype; undo_operation public.drops_operations%rowtype;
  current_row jsonb; original_row jsonb; tracker_unit text; zone text; actual_instant timestamptz; consumed_wall timestamp; expected_tracker text;
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if operation is null or length(btrim(operation))=0 then raise exception 'Operation ID required'; end if;
  if mutation->>'kind' is null or mutation->>'kind' not in ('add','edit','delete','restore') or
    (mutation->>'kind'='add' and (before_entry is not null or after_entry is null)) or
    (mutation->>'kind'='edit' and (before_entry is null or after_entry is null)) or
    (mutation->>'kind'='delete' and (before_entry is null or after_entry is not null)) or
    (mutation->>'kind'='restore' and (after_entry is null or request_payload->>'kind' is distinct from 'undo')) then raise exception 'Invalid mutation shape'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  select * into prior_operation from public.drops_operations where user_id=owner_id and operation_id=operation;
  if found then
    if prior_operation.request_json<>request_payload then raise exception 'Operation ID belongs to a different action'; end if;
    return prior_operation.receipt_json;
  end if;
  if request_payload->>'kind'='undo' then
    select * into undo_operation from public.drops_operations where user_id=owner_id and operation_id=request_payload->'receipt'->>'operationId';
    if not found or undo_operation.receipt_json<>request_payload->'receipt' or undo_operation.undone_by is not null then raise exception 'Undo receipt is stale or already used'; end if;
    if before_entry is distinct from nullif(undo_operation.receipt_json->'after','null'::jsonb) then raise exception 'Undo snapshot mismatch'; end if;
    if (after_entry-'version') is distinct from (nullif(undo_operation.receipt_json->'before','null'::jsonb)-'version') then raise exception 'Restore snapshot mismatch'; end if;
    original_row:=undo_operation.raw_before;
  end if;
  if before_entry is not null then
    if before_entry->>'storageKind'='intake' then
      select to_jsonb(t) into current_row from public.intake_log t where user_id=owner_id and id::text=before_entry->>'id' for update;
      expected_tracker:=case when current_row->>'consumable'='creatine' then 'builtin:creatine' else 'builtin:water' end;
    elsif before_entry->>'storageKind'='tracker' then
      select to_jsonb(t) into current_row from public.tracker_entries t where user_id=owner_id and id=before_entry->>'id' for update;
      expected_tracker:=current_row->>'tracker_id';
    else raise exception 'Invalid storage kind'; end if;
    if current_row is null or expected_tracker is distinct from before_entry->>'trackerId' or
      (current_row->>'mutation_version')::int is distinct from (before_entry->>'version')::int or
      (current_row->>'amount')::double precision is distinct from (before_entry->>'amount')::double precision or
      current_row->>'unit' is distinct from before_entry->>'unit' or current_row->>'note' is distinct from before_entry->>'note' then raise exception 'Entry changed; refresh before editing or Undo'; end if;
    if current_row->>'consumed_at_utc' is not null then
      if (current_row->>'consumed_at_utc')::timestamptz is distinct from (before_entry->>'consumedAtUtc')::timestamptz then raise exception 'Entry time changed'; end if;
    elsif before_entry->>'storageKind'='intake' then
      if (current_row->>'consumed_at')::timestamp is distinct from (before_entry->>'legacyLocal')::timestamp then raise exception 'Legacy time changed'; end if;
    else
      if (current_row->>'consumed_at')::timestamptz is distinct from (before_entry->>'consumedAt')::timestamptz then raise exception 'Entry time changed'; end if;
    end if;
  end if;
  if after_entry is not null then
    if jsonb_typeof(after_entry) is distinct from 'object' or jsonb_typeof(after_entry->'amount') is distinct from 'number' or jsonb_typeof(after_entry->'unit') is distinct from 'string' or jsonb_typeof(after_entry->'name') is distinct from 'string' or jsonb_typeof(after_entry->'note') is distinct from 'string' or jsonb_typeof(after_entry->'id') is distinct from 'string' or jsonb_typeof(after_entry->'trackerId') is distinct from 'string' then raise exception 'Invalid intake snapshot'; end if;
    if not ((after_entry->>'amount')::double precision>0 and (after_entry->>'amount')::double precision<'Infinity'::double precision) or length(btrim(after_entry->>'unit'))=0 or length(btrim(after_entry->>'id'))=0 then raise exception 'Invalid intake amount or unit'; end if;
    if after_entry->>'trackerId'='builtin:water' then
      select coalesce(profile_json->>'unit','oz') into tracker_unit from public.drops_profiles where user_id=owner_id and tracker_id='builtin:water';
      if tracker_unit is null then select drink_unit into tracker_unit from public.user_settings where user_id=owner_id; end if;
      tracker_unit:=coalesce(tracker_unit,'oz');
    elsif after_entry->>'trackerId'='builtin:creatine' then
      select unit into tracker_unit from public.tracked_items where user_id=owner_id and id='builtin:creatine';
      tracker_unit:=coalesce(tracker_unit,'g');
    else
      select unit into tracker_unit from public.tracked_items where user_id=owner_id and id=after_entry->>'trackerId';
      if tracker_unit is null then raise exception 'Tracker must belong to the signed-in owner' using errcode='23503'; end if;
    end if;
    if request_payload->>'kind'<>'undo' and public.drops_unit_dimension(after_entry->>'unit')<>public.drops_unit_dimension(tracker_unit) then raise exception 'Incompatible intake unit'; end if;
    if (after_entry->>'trackerId' in ('builtin:water','builtin:creatine')) is distinct from (after_entry->>'storageKind'='intake') then raise exception 'Tracker storage kind mismatch'; end if;
    if before_entry is not null and after_entry->>'id' is distinct from before_entry->>'id' then raise exception 'Entry identity must remain stable'; end if;
    if (after_entry->>'version')::int<>coalesce((before_entry->>'version')::int+1,case when request_payload->>'kind'='undo' then (request_payload->'receipt'->'before'->>'version')::int+1 else 1 end) then raise exception 'Invalid mutation version'; end if;
    actual_instant:=(after_entry->>'consumedAtUtc')::timestamptz;
    if actual_instant is null and request_payload->>'kind'<>'undo' then raise exception 'Explicit consumption instant required'; end if;
    if actual_instant>now() then raise exception 'Actual consumption cannot be in the future'; end if;
    select preferences_json->>'timezone' into zone from public.drops_preferences where user_id=owner_id;
    zone:=coalesce(zone,'UTC');
    consumed_wall:=coalesce((after_entry->>'legacyLocal')::timestamp,actual_instant at time zone zone);
  end if;
  if before_entry is not null then
    if before_entry->>'storageKind'='intake' then delete from public.intake_log where user_id=owner_id and id::text=before_entry->>'id';
    else delete from public.tracker_entries where user_id=owner_id and id=before_entry->>'id'; end if;
  end if;
  if after_entry is not null then
    if after_entry->>'storageKind'='intake' then
      insert into public.intake_log(user_id,id,amount,unit,consumable,consumed_at,consumed_at_utc,note,mutation_version,logged_at)
      values(owner_id,(after_entry->>'id')::uuid,(after_entry->>'amount')::double precision,after_entry->>'unit',coalesce(original_row->>'consumable',case when before_entry->>'trackerId'=after_entry->>'trackerId' then current_row->>'consumable' else null end,case when after_entry->>'trackerId'='builtin:creatine' then 'creatine' else 'water' end),coalesce((original_row->>'consumed_at')::timestamp,consumed_wall),actual_instant,coalesce(after_entry->>'note',''),(after_entry->>'version')::int,coalesce((original_row->>'logged_at')::timestamptz,(current_row->>'logged_at')::timestamptz,now()));
    else
      insert into public.tracker_entries(user_id,id,tracker_id,name,amount,unit,consumed_at,consumed_at_utc,note,mutation_version,created_at)
      values(owner_id,after_entry->>'id',after_entry->>'trackerId',after_entry->>'name',(after_entry->>'amount')::double precision,after_entry->>'unit',coalesce((original_row->>'consumed_at')::timestamptz,actual_instant),actual_instant,coalesce(after_entry->>'note',''),(after_entry->>'version')::int,coalesce((original_row->>'created_at')::timestamptz,(current_row->>'created_at')::timestamptz,now()));
    end if;
  end if;
  insert into public.drops_operations(user_id,operation_id,request_json,receipt_json,raw_before) values(owner_id,operation,request_payload,mutation,current_row);
  if request_payload->>'kind'='undo' then update public.drops_operations set undone_by=operation where user_id=owner_id and operation_id=undo_operation.operation_id; end if;
  return mutation;
end $$;

revoke execute on function public.drops_validate_profile_owner() from public;
revoke execute on function public.drops_validate_profile(jsonb) from public;
revoke execute on function public.drops_validate_preferences() from public;
revoke execute on function public.drops_unit_dimension(text) from public;
revoke execute on function public.drops_unit_factor(text) from public;
revoke execute on function public.drops_save_profile(jsonb) from public;
revoke execute on function public.drops_patch_preferences(jsonb) from public;
revoke execute on function public.drops_initialize_preferences(jsonb) from public;
revoke execute on function public.drops_set_primary(text) from public;
revoke execute on function public.drops_mutate_entry(jsonb,jsonb) from public;
grant execute on function public.drops_validate_profile_owner() to authenticated;
grant execute on function public.drops_validate_profile(jsonb) to authenticated;
grant execute on function public.drops_validate_preferences() to authenticated;
grant execute on function public.drops_unit_dimension(text) to authenticated;
grant execute on function public.drops_unit_factor(text) to authenticated;
grant execute on function public.drops_save_profile(jsonb) to authenticated;
grant execute on function public.drops_patch_preferences(jsonb) to authenticated;
grant execute on function public.drops_initialize_preferences(jsonb) to authenticated;
grant execute on function public.drops_set_primary(text) to authenticated;
grant execute on function public.drops_mutate_entry(jsonb,jsonb) to authenticated;

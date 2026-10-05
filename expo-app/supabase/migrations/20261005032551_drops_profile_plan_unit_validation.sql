-- Remove UTC-vs-owner-day ambiguity from direct JSON writes, without modifying
-- the applied v0.1 migration. RPC writes already validate all plan dimensions.
-- Historical source units remain intact; g/mg and compatible volume units share
-- a dimension. Unknown count/custom units only match themselves.
create or replace function public.drops_profile_plan_units_compatible(profile jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
  if jsonb_typeof(profile) is distinct from 'object' or jsonb_typeof(profile->'unit') is distinct from 'string'
    or jsonb_typeof(profile->'plans') is distinct from 'array' then return false; end if;
  return not exists(select 1 from jsonb_array_elements(profile->'plans') plan
    where jsonb_typeof(plan->'unit') is distinct from 'string'
      or public.drops_unit_dimension(plan->>'unit') is distinct from public.drops_unit_dimension(profile->>'unit'));
end $$;
revoke execute on function public.drops_profile_plan_units_compatible(jsonb) from public;
grant execute on function public.drops_profile_plan_units_compatible(jsonb) to authenticated;
do $constraint$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.drops_profiles'::regclass and conname='drops_profile_plan_units_compatible_ck') then
    alter table public.drops_profiles add constraint drops_profile_plan_units_compatible_ck
      check(public.drops_profile_plan_units_compatible(profile_json)) not valid;
  end if;
end $constraint$;

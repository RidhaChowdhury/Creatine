-- Additive user-owned storage for supplement and medication trackers.
-- Existing intake_log rows (including creatine) remain the source for legacy history.

create table if not exists public.tracked_items (
   id text not null,
   user_id uuid not null references auth.users(id) on delete cascade,
   name text not null check (length(btrim(name)) > 0),
   unit text not null check (length(btrim(unit)) > 0),
   saved_dose double precision null check (
      saved_dose is null or (saved_dose > 0 and saved_dose < 'Infinity'::double precision)
   ),
   category text not null check (category in ('supplement', 'medication')),
   builtin_key text null check (builtin_key is null or builtin_key in ('creatine', 'fiber', 'caffeine')),
   created_at timestamptz not null default now(),
   updated_at timestamptz not null default now(),
   primary key (user_id, id),
   constraint tracked_items_creatine_unit_category_ck check (
      builtin_key is distinct from 'creatine' or (category = 'supplement' and unit in ('g', 'mg'))
   ),
   unique (user_id, builtin_key)
);

create table if not exists public.tracker_entries (
   id text not null,
   user_id uuid not null references auth.users(id) on delete cascade,
   tracker_id text not null,
   name text not null check (length(btrim(name)) > 0),
   unit text not null check (length(btrim(unit)) > 0),
   amount double precision not null check (amount > 0 and amount < 'Infinity'::double precision),
   consumed_at timestamptz not null,
   created_at timestamptz not null default now(),
   primary key (user_id, id),
   constraint tracker_entries_item_owner_fk
      foreign key (user_id, tracker_id)
      references public.tracked_items(user_id, id) on delete cascade
);

create index if not exists idx_tracker_entries_owner_tracker_date
   on public.tracker_entries (user_id, tracker_id, consumed_at desc);

create table if not exists public.tracker_preferences (
   user_id uuid primary key references auth.users(id) on delete cascade,
   primary_tracker_id text null,
   updated_at timestamptz not null default now(),
   constraint tracker_preferences_primary_owner_fk
      foreign key (user_id, primary_tracker_id)
      references public.tracked_items(user_id, id) on delete cascade
);

alter table public.tracked_items enable row level security;
alter table public.tracker_entries enable row level security;
alter table public.tracker_preferences enable row level security;

do $tracker_policy$
begin
   if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'tracked_items'
         and policyname = 'Users manage their tracked items'
   ) then
      execute 'create policy "Users manage their tracked items" on public.tracked_items
         for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
   end if;
end
$tracker_policy$;

do $tracker_policy$
begin
   if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'tracker_entries'
         and policyname = 'Users manage their tracker entries'
   ) then
      execute 'create policy "Users manage their tracker entries" on public.tracker_entries
         for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
   end if;
end
$tracker_policy$;

do $tracker_policy$
begin
   if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'tracker_preferences'
         and policyname = 'Users manage their tracker preferences'
   ) then
      execute 'create policy "Users manage their tracker preferences" on public.tracker_preferences
         for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
   end if;
end
$tracker_policy$;

grant select, insert, update, delete on public.tracked_items to authenticated;
grant select, insert, update, delete on public.tracker_entries to authenticated;
grant select, insert, update, delete on public.tracker_preferences to authenticated;

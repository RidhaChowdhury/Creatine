-- Bootstrap the original cloud tables for a fresh Supabase project.
-- Existing deployments already have these tables and their policies. This migration
-- intentionally leaves any pre-existing table untouched; it only creates a table
-- (including owner RLS) when that table is absent.

do $bootstrap_intake$
begin
   if to_regclass('public.intake_log') is null then
      execute $sql$
         create table public.intake_log (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users(id) on delete cascade,
            amount double precision not null,
            unit text not null,
            consumable text not null,
            consumed_at timestamp without time zone not null,
            logged_at timestamp with time zone not null default now()
         )
      $sql$;
      execute 'create index idx_intake_log_user_consumable_date
         on public.intake_log (user_id, consumable, consumed_at)';
      execute 'alter table public.intake_log enable row level security';
      execute 'create policy "Users manage their intake log" on public.intake_log
         for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
      execute 'grant select, insert, update, delete on public.intake_log to authenticated';
   end if;
end
$bootstrap_intake$;

do $bootstrap_settings$
begin
   if to_regclass('public.user_settings') is null then
      execute $sql$
         create table public.user_settings (
            user_id uuid primary key references auth.users(id) on delete cascade,
            name text not null,
            height double precision not null,
            weight double precision not null,
            sex text not null,
            drink_unit text not null default 'oz',
            supplement_unit text not null default 'g',
            water_goal double precision not null default 0,
            creatine_goal double precision not null default 0,
            creatine_reminder_time text null
         )
      $sql$;
      execute 'alter table public.user_settings enable row level security';
      execute 'create policy "Users manage their user settings" on public.user_settings
         for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
      execute 'grant select, insert, update, delete on public.user_settings to authenticated';
   end if;
end
$bootstrap_settings$;

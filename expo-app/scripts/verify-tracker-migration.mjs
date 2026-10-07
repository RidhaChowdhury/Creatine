import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migrationDirectory = resolve('supabase/migrations');
const migrationFiles = (await readdir(migrationDirectory)).filter(name => name.endsWith('.sql')).sort();
const migrations = await Promise.all(migrationFiles.map(name => readFile(resolve(migrationDirectory, name), 'utf8')));
const db = new PGlite();
const existingProjectDb = new PGlite();

const userA = '10000000-0000-4000-8000-000000000001';
const userB = '20000000-0000-4000-8000-000000000002';

async function runAs(userId, callback) {
   await db.exec('RESET ROLE; SET ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
   try {
      return await callback();
   } finally {
      await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);");
   }
}

async function expectSqlState(label, expectedCode, action) {
   try {
      await action();
   } catch (error) {
      assert.equal(error.code, expectedCode, `${label} should fail with SQLSTATE ${expectedCode}`);
      return;
   }
   assert.fail(`${label} unexpectedly succeeded`);
}

try {
   await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users (id) VALUES ('${userA}'), ('${userB}');
      CREATE FUNCTION auth.uid() RETURNS uuid
         LANGUAGE sql STABLE
         AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      GRANT USAGE ON SCHEMA public TO authenticated;
   `);

   // Start from an empty public schema to verify the baseline creates a usable
   // fresh-project schema with UUID keys, legacy local-wall timestamps, and RLS.
   await db.exec(migrations[0]);
   const baselineTypes = await db.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND (
         (table_name='intake_log' AND column_name IN ('id','user_id','consumed_at','logged_at'))
         OR (table_name='user_settings' AND column_name='user_id')
      )
      ORDER BY table_name, column_name
   `);
   assert.deepEqual(baselineTypes.rows, [
      { table_name: 'intake_log', column_name: 'consumed_at', data_type: 'timestamp without time zone' },
      { table_name: 'intake_log', column_name: 'id', data_type: 'uuid' },
      { table_name: 'intake_log', column_name: 'logged_at', data_type: 'timestamp with time zone' },
      { table_name: 'intake_log', column_name: 'user_id', data_type: 'uuid' },
      { table_name: 'user_settings', column_name: 'user_id', data_type: 'uuid' }
   ]);

   await db.exec(`
      INSERT INTO public.intake_log (id,user_id,amount,unit,consumable,consumed_at) VALUES
         ('30000000-0000-4000-8000-000000000001', '${userA}', 12, 'oz', 'water', '2026-09-30 12:00:00'),
         ('30000000-0000-4000-8000-000000000002', '${userA}', 5, 'g', 'creatine', '2026-09-30 13:00:00');
      INSERT INTO public.user_settings (user_id,name,height,weight,sex)
         VALUES ('${userA}','Owner A',180,80,'unspecified'), ('${userB}','Owner B',170,70,'unspecified');
   `);

   const freshOwnerA = await runAs(userA, async () => {
      const intake = await db.query('SELECT id,consumable FROM public.intake_log ORDER BY id');
      const profiles = await db.query('SELECT user_id,name FROM public.user_settings');
      return { intake: intake.rows, profiles: profiles.rows };
   });
   assert.deepEqual(freshOwnerA.intake, [
      { id: '30000000-0000-4000-8000-000000000001', consumable: 'water' },
      { id: '30000000-0000-4000-8000-000000000002', consumable: 'creatine' }
   ]);
   assert.deepEqual(freshOwnerA.profiles, [{ user_id: userA, name: 'Owner A' }]);
   await runAs(userA, async () => {
      await expectSqlState('cross-owner intake insert', '42501', () => db.query(
         `INSERT INTO public.intake_log (user_id,amount,unit,consumable,consumed_at)
          VALUES ('${userB}',1,'oz','water','2026-09-30 14:00:00')`
      ));
      await expectSqlState('cross-owner profile insert', '42501', () => db.query(
         `INSERT INTO public.user_settings (user_id,name,height,weight,sex)
          VALUES ('${userB}','Forged',1,1,'unspecified')`
      ));
   });

   // Also model an already-running project: baseline must not alter its tables,
   // rows, or custom policies when it sees the original tables already exist.
   await existingProjectDb.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${userA}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
         AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE TABLE public.intake_log (
         id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
         amount double precision NOT NULL, unit text NOT NULL, consumable text NOT NULL,
         consumed_at timestamp without time zone NOT NULL, logged_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.user_settings (
         user_id uuid PRIMARY KEY REFERENCES auth.users(id), name text NOT NULL,
         height double precision NOT NULL, weight double precision NOT NULL, sex text NOT NULL,
         drink_unit text NOT NULL DEFAULT 'oz', supplement_unit text NOT NULL DEFAULT 'g',
         water_goal double precision NOT NULL DEFAULT 0, creatine_goal double precision NOT NULL DEFAULT 0,
         creatine_reminder_time text
      );
      ALTER TABLE public.intake_log ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Existing intake policy" ON public.intake_log FOR ALL TO authenticated
         USING (true) WITH CHECK (true);
      CREATE POLICY "Existing profile policy" ON public.user_settings FOR ALL TO authenticated
         USING (true) WITH CHECK (true);
      INSERT INTO public.intake_log (id,user_id,amount,unit,consumable,consumed_at)
         VALUES ('30000000-0000-4000-8000-000000000099','${userA}',9,'oz','water','2026-09-30 22:00:00');
      INSERT INTO public.user_settings (user_id,name,height,weight,sex)
         VALUES ('${userA}','Existing user',180,80,'unspecified');
   `);
   const existingRowsBefore = await existingProjectDb.query(`
      SELECT (SELECT count(*) FROM public.intake_log)::integer AS intake_count,
         (SELECT count(*) FROM public.user_settings)::integer AS settings_count,
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
            WHERE schemaname='public' AND tablename IN ('intake_log','user_settings')) AS policies,
         (SELECT string_agg(table_name || '.' || column_name || ':' || data_type, ',' ORDER BY table_name,column_name)
            FROM information_schema.columns WHERE table_schema='public'
               AND table_name IN ('intake_log','user_settings')) AS columns,
         (SELECT bool_and(relrowsecurity) FROM pg_class
            WHERE oid IN ('public.intake_log'::regclass,'public.user_settings'::regclass)) AS rls_enabled
   `);
   await existingProjectDb.exec(migrations[0]);
   const existingRowsAfter = await existingProjectDb.query(`
      SELECT (SELECT count(*) FROM public.intake_log)::integer AS intake_count,
         (SELECT count(*) FROM public.user_settings)::integer AS settings_count,
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
            WHERE schemaname='public' AND tablename IN ('intake_log','user_settings')) AS policies,
         (SELECT string_agg(table_name || '.' || column_name || ':' || data_type, ',' ORDER BY table_name,column_name)
            FROM information_schema.columns WHERE table_schema='public'
               AND table_name IN ('intake_log','user_settings')) AS columns,
         (SELECT bool_and(relrowsecurity) FROM pg_class
            WHERE oid IN ('public.intake_log'::regclass,'public.user_settings'::regclass)) AS rls_enabled
   `);
   assert.deepEqual(existingRowsAfter.rows, existingRowsBefore.rows,
      'baseline must preserve existing project rows and policies');

   const legacyBefore = await db.query(
      'SELECT id,user_id,amount,unit,consumable,consumed_at FROM public.intake_log ORDER BY id'
   );

   for (const migration of migrations) await db.exec(migration);
   for (const migration of migrations) await db.exec(migration); // A second application must be safe.

   const legacyAfter = await db.query(
      'SELECT id,user_id,amount,unit,consumable,consumed_at FROM public.intake_log ORDER BY id'
   );
   assert.deepEqual(legacyAfter.rows, legacyBefore.rows, 'legacy intake rows must remain unchanged');

   const legacyUtc = await db.query('SELECT consumed_at_utc FROM public.intake_log');
   assert(legacyUtc.rows.every(row => row.consumed_at_utc === null), 'legacy local timestamps must not be guessed');
   await db.exec(`
      INSERT INTO public.intake_log (id,user_id,amount,unit,consumable,consumed_at,logged_at)
      SELECT md5('repair-' || n)::uuid, '${userA}', 16, 'oz', 'water',
         timestamp '2026-10-02 03:30:00', timestamptz '2026-10-02 03:30:01+00'
      FROM generate_series(1,23) AS n;
   `);
   const repairBefore = await db.query('SELECT id,amount,consumed_at FROM public.intake_log ORDER BY id');
   const repair = await readFile(resolve('supabase/repairs/20261002_restore_quick_add_timezone.sql'), 'utf8');
   await db.exec(repair);
   await db.exec(repair);
   const repairAfter = await db.query('SELECT id,amount,consumed_at FROM public.intake_log ORDER BY id');
   assert.deepEqual(repairAfter.rows, repairBefore.rows, 'timezone repair must preserve original values and amounts');
   const repaired = await db.query(`SELECT count(*)::integer AS rows,
      min((consumed_at_utc AT TIME ZONE 'America/Chicago')::date)::text AS local_day
      FROM public.intake_log WHERE consumed_at_utc IS NOT NULL`);
   assert.deepEqual(repaired.rows, [{ rows: 23, local_day: '2026-10-01' }], 'evening UTC saves must belong to the correct local day');
   const oldRows = await db.query(`SELECT consumed_at_utc FROM public.intake_log
      WHERE id IN ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')`);
   assert(oldRows.rows.every(row => row.consumed_at_utc === null), 'the bounded repair must leave legacy history alone');

   await db.exec(`
      INSERT INTO public.tracked_items (id,user_id,name,unit,saved_dose,category,builtin_key) VALUES
         ('supp-a','${userA}','Electrolyte mix','scoops',1.25,'supplement',NULL),
         ('med-a','${userA}','Prescription tablet','tablets',NULL,'medication',NULL),
         ('supp-b','${userB}','Other account supplement','capsules',2,'supplement',NULL);
      INSERT INTO public.tracker_entries (id,user_id,tracker_id,name,unit,amount,consumed_at) VALUES
         ('entry-a','${userA}','supp-a','Electrolyte mix','scoops',1.25,'2026-09-30T14:00:00Z'),
         ('entry-b','${userB}','supp-b','Other account supplement','capsules',2,'2026-09-30T14:00:00Z');
      INSERT INTO public.tracker_preferences (user_id,primary_tracker_id) VALUES
         ('${userA}','med-a'), ('${userB}','supp-b');
   `);

   const visibleA = await runAs(userA, async () => {
      const trackers = await db.query('SELECT id FROM public.tracked_items ORDER BY id');
      const entries = await db.query('SELECT id FROM public.tracker_entries ORDER BY id');
      const preferences = await db.query('SELECT user_id,primary_tracker_id FROM public.tracker_preferences');
      return { trackers: trackers.rows, entries: entries.rows, preferences: preferences.rows };
   });
   assert.deepEqual(visibleA.trackers, [{ id: 'med-a' }, { id: 'supp-a' }]);
   assert.deepEqual(visibleA.entries, [{ id: 'entry-a' }]);
   assert.deepEqual(visibleA.preferences, [{ user_id: userA, primary_tracker_id: 'med-a' }]);

   const visibleB = await runAs(userB, async () => {
      const trackers = await db.query('SELECT id FROM public.tracked_items ORDER BY id');
      const entries = await db.query('SELECT id FROM public.tracker_entries ORDER BY id');
      const preferences = await db.query('SELECT user_id,primary_tracker_id FROM public.tracker_preferences');
      return { trackers: trackers.rows, entries: entries.rows, preferences: preferences.rows };
   });
   assert.deepEqual(visibleB.trackers, [{ id: 'supp-b' }]);
   assert.deepEqual(visibleB.entries, [{ id: 'entry-b' }]);
   assert.deepEqual(visibleB.preferences, [{ user_id: userB, primary_tracker_id: 'supp-b' }]);

   await runAs(userA, async () => {
      await expectSqlState('cross-owner tracker insert', '42501', () => db.query(
         `INSERT INTO public.tracked_items (id,user_id,name,unit,category)
          VALUES ('forged','${userB}','Forged','dose','medication')`
      ));
      await expectSqlState('entry linked to another owner tracker', '23503', () => db.query(
         `INSERT INTO public.tracker_entries (id,user_id,tracker_id,name,unit,amount,consumed_at)
          VALUES ('foreign-link','${userA}','supp-b','Forged entry','capsules',1,'2026-09-30T15:00:00Z')`
      ));
      await expectSqlState('preference linked to another owner tracker', '23503', () => db.query(
         `UPDATE public.tracker_preferences SET primary_tracker_id = 'supp-b' WHERE user_id = '${userA}'`
      ));

      const medication = await db.query(
         `INSERT INTO public.tracked_items (id,user_id,name,unit,saved_dose,category)
          VALUES ('med-null','${userA}','Medication without a saved dose','tablets',NULL,'medication')
          RETURNING saved_dose,category`
      );
      assert.deepEqual(medication.rows, [{ saved_dose: null, category: 'medication' }]);

      const creatine = await db.query(
         `INSERT INTO public.tracked_items (id,user_id,name,unit,saved_dose,category,builtin_key)
          VALUES ('builtin:creatine','${userA}','Creatine','mg',5000,'supplement','creatine')
          RETURNING unit,category,saved_dose`
      );
      assert.deepEqual(creatine.rows, [{ unit: 'mg', category: 'supplement', saved_dose: 5000 }]);
      await expectSqlState('creatine unit outside supported mass units', '23514', () => db.query(
         `INSERT INTO public.tracked_items (id,user_id,name,unit,saved_dose,category,builtin_key)
          VALUES ('bad-creatine-unit','${userA}','Creatine','scoops',1,'supplement','creatine')`
      ));
      await expectSqlState('creatine moved to medication category', '23514', () => db.query(
         `INSERT INTO public.tracked_items (id,user_id,name,unit,saved_dose,category,builtin_key)
          VALUES ('bad-creatine-category','${userA}','Creatine','g',5,'medication','creatine')`
      ));

      for (const [label, value] of [['NaN', `'NaN'::double precision`], ['infinity', `'Infinity'::double precision`], ['negative', '-1']]) {
         await expectSqlState(`saved dose ${label}`, '23514', () => db.query(
            `INSERT INTO public.tracked_items (id,user_id,name,unit,saved_dose,category)
             VALUES ('dose-${label}','${userA}','Invalid dose','tablets',${value},'medication')`
         ));
         await expectSqlState(`entry amount ${label}`, '23514', () => db.query(
            `INSERT INTO public.tracker_entries (id,user_id,tracker_id,name,unit,amount,consumed_at)
             VALUES ('amount-${label}','${userA}','supp-a','Invalid amount','scoops',${value},'2026-09-30T15:00:00Z')`
         ));
      }
   });

   console.log('Migrations verified: fresh legacy schema, intake/profile/tracker RLS, owner-linked foreign keys, idempotent DDL, dose constraints, preserved existing-project schema/policies/rows, and bounded timezone repair.');
} finally {
   await db.close();
   await existingProjectDb.close();
}

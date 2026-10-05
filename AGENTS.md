# Repository guidance

- This repository's Expo app is in `expo-app/`. Run app scripts and install dependencies from that directory. Use Node.js 22, `npm ci`, and the checked-in lockfile.
- Keep UI changes on the app's Tamagui design system. Water visuals use Skia; keep web-compatible Skia assets and initialization working when changing the app entry or Metro configuration. Do not reintroduce NativeWind or Gluestack providers.
- Keep Supabase credentials in local environment files and out of commits. Use `dev:local`, `dev:test`, or disposable test fixtures for manual and automated checks. Never create, mutate, or delete test data in the production project or with a production account.
- Add database changes as new, additive migrations under `expo-app/supabase/migrations`; do not rewrite migrations already applied to shared projects. Review owner RLS and foreign-key behavior, and run `npm run verify` from `expo-app/` after data or migration changes.
- The legacy cloud `intake_log.consumed_at` column is a timezone-free local wall time. Do not parse it as UTC or rewrite old values. New cloud writes preserve that field and record an explicit instant in `consumed_at_utc`; use the shared date helpers when grouping or displaying mixed legacy and new rows.
- Before finishing app changes, run the narrow relevant tests, then `npm run verify` and `npm run build:web` when practical. `npm run build:native` checks JavaScript bundling only; it is not a substitute for testing on iOS or Android devices.

# Data and release

## App structure

Expo Router owns the routes and platform entry points. The shared screen,
trackers, editors, and settings use Tamagui components; Skia renders the
animated water scene. Redux Toolkit holds tracker state and coordinates saved
actions. Web uses local Expo SQLite when started in local mode; cloud mode uses
Supabase Auth and the user's existing records.

Water and the built-in Creatine tracker retain the existing `intake_log` data
path so existing history remains available. Other supplement and medication
trackers use `tracked_items`, `tracker_entries`, and `tracker_preferences`.
Entries keep a name/unit snapshot, and saved doses may be empty. Creatine starts
with the requested 5 g preset; other items do not receive inferred doses.

For old `intake_log` rows, `consumed_at` is a timezone-free local wall time.
New cloud writes also store the exact instant in `consumed_at_utc`; old rows are
not assigned a timezone by guessing.

## Supabase setup and migrations

The current production project reference is `xmkdzdqouxqmayoawztr`. Treat it as
production: do not run destructive tests or write test fixtures there.

For a new Supabase project, apply the checked-in migrations in filename order
using the Supabase migration workflow. Apply these three files in order:

1. `202609300001_bootstrap_legacy_cloud_schema.sql` — baseline schema
2. `202610010001_add_trackers.sql` — supplement and medication tracker tables
3. `202610020001_add_intake_consumed_at_utc.sql` — explicit UTC timestamps

`npm run verify:db` exercises the migration set against a local PGlite fixture,
including owner isolation, reruns, and preservation of legacy intake rows; it
does not apply migrations to a remote project.

The SQL under `supabase/repairs/` is a one-time correction for a specific earlier
timezone incident. It is separate from schema setup and must not be run on a new
project. Review any repair script and its exact target rows before considering
it for an existing deployment.

## Release checklist

The app display name is Drops. Native identifiers now match the existing
installed apps: iOS `com.samlau25.expo-app` and Android `com.samlau25.expoapp`.
The Expo slug `monohydrated`, URL scheme `myapp`, and EAS project linkage are
preserved.

`npm run native:sync` runs Expo prebuild without dependency installation. It
completed for Android on Windows; Windows skips iOS generation. The iOS scaffold
and `ios/Podfile.lock` still reflect Expo 53 / React Native 0.79 and must be
refreshed with CocoaPods on macOS before an iOS device build. No physical-device
build or test has been completed. Original native scaffolds are retained in the
ignored `qa/native-scaffold-backup/` folder.

### Before review

- [ ] Run `npm run doctor` and resolve local setup or asset errors.
- [ ] Run `npm run verify`.
- [ ] Run `npm run build:web`, then check the result with `npm run preview`.
- [ ] Confirm cloud work uses the intended environment; test accounts and
  fixture writes belong only in the separate test project.
- [ ] Check keyboard/screen-reader behavior, reduced motion, and narrow and
  desktop layouts.

### Before a device release

- [ ] Build and install on physical iOS and Android devices.
- [ ] Check safe areas, Skia/worklet behavior, haptics, audio, permissions,
  notifications, and accessibility on device.
- [ ] Verify the production Supabase schema and authentication with a
  non-destructive production check.
- [ ] Verify native metadata and EAS configuration before a release; do not
  change the preserved identifiers or project linkage as part of rebranding.
- [ ] Refresh the iOS scaffold and run CocoaPods on macOS before building iOS.
- [ ] Review and resolve or explicitly accept the remaining dependency audit
  advisories before release.

The separate Supabase test project and physical-device checks are still pending.
Until they are complete, cloud integration and native behavior are not verified
by local tests. A web or native Expo export is a bundle check, not a device build
or a release artifact by itself.

The current `npm audit` report has 21 advisories: 5 high, 15 moderate, and 1
low, with no critical advisories. Remaining upstream findings include
`image-size`, `node-forge`, and the Expo toolchain. These require release review;
do not use a force downgrade to silence them.

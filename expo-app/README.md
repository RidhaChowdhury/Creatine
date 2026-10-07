# Drops

Expo app for water intake and supplement/medication tracking. The interface uses
Tamagui, with Skia rendering the water scene. The app runs on web, iOS, and
Android; browser export does not create an installable device build.

## Start developing

Use Node.js 22 or 24 (the pinned version is 22.23.3) and install the lockfile
dependencies:

```bash
npm ci
```

For cloud-backed development, configure `.env.local` from `.env.example`, then
run `npm run dev`. For isolated browser development without cloud credentials,
run `npm run dev:local`. To use the separate test backend, configure
`.env.test.local` and run `npm run dev:test`; that command rejects the production
Supabase project. See [Development](docs/development.md) for environment
details, diagnostics, and commands.

## Project guide

- [Development](docs/development.md) — local setup, environment modes, and checks
- [Data and release](docs/data-and-release.md) — storage, migrations, and release checklist

Before sharing a change, run `npm run verify`. `npm run doctor` checks the cloud
environment by default; pass `-- --local` for offline local setup checks, or
`-- --backend` for read-only backend health/schema probes. See the release
checklist for outstanding test-project and physical-device checks.

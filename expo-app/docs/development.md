# Development

## Requirements

- Node.js 22 or 24 (`.nvmrc` pins 22.23.3; CI uses Node 22)
- npm
- For native runs: an iOS/Android simulator or a configured physical device

Install from the checked-in lockfile with `npm ci`. The postinstall hook prepares
the Skia CanvasKit web asset. If dependencies or Metro configuration change,
restart the Expo process so Metro reloads them.

The current app uses Expo 54.0.37, React Native 0.81.5, React 19.1.0, and
Tamagui 2.7.7. Keep Expo's native package versions aligned when changing SDK
patches.

## Choose a data environment

| Command | Port | Data source | Use |
| --- | ---: | --- | --- |
| `npm run dev` | 8081 | Supabase settings from `.env.local` | Cloud-backed development |
| `npm run dev:local` | 8082 | Browser-local SQLite; Supabase variables are removed | Safe UI iteration and disposable fixtures |
| `npm run dev:test` | 8083 | Supabase settings from `.env.test.local` | Integration checks against the separate test project |

Copy `.env.example` to `.env.local` and set the Supabase URL and public publishable
key to use the cloud-backed command. A legacy anon key is accepted, but never
put a service-role key in an Expo public environment variable. Shell Supabase
variables take precedence over `.env.local` in cloud mode. Restart Expo after
changing environment files.

Copy `.env.test.example` to `.env.test.local` and enter credentials for the
separate Drops Test project. Test mode loads this file and refuses the production
Supabase project, including when cloud credentials are inherited from the shell.
The test project still needs to be provisioned and checked before using this
mode. Do not use production accounts or production data for destructive tests or
fixture writes.

`npm run dev:local` deliberately strips cloud configuration and uses isolated
browser storage. Its local SQLite data is not uploaded. Clear the browser's site
data when you need a fresh local account.

## Useful commands

- `npm run doctor` checks Node, installed packages, CanvasKit, and the cloud
  environment configuration. Pass `-- --local` or `-- --test` to select another
  mode. Add `-- --backend` to make read-only health and schema probes; schema
  probes request zero rows. For example: `npm run doctor -- --test --backend`.
- `npm run verify` runs TypeScript, Jest regression tests, and the local PGlite
  migration/RLS checks, plus launcher environment guard tests.
- `npm run build:web` exports the web app to `dist-pitwall/`.
- `npm run build:native` exports iOS/Android bundles to `dist-native/`. It
  verifies bundling; it does not create an installable device build.
- `npm run native:sync` runs `expo prebuild --no-install` to sync generated
  native project files with Expo config. It does not install CocoaPods or build
  an app.
- `npm run preview` serves the web export at `http://127.0.0.1:4173` by default
  (override with `PORT`). Backend configuration is embedded at build time.

The web app uses Skia CanvasKit and Expo SQLite's web support. A deployed web
host must serve `Cross-Origin-Embedder-Policy: require-corp` and
`Cross-Origin-Opener-Policy: same-origin` for SQLite's shared-memory setup.

## Quick check

For a local browser pass, use `npm run dev:local` and check at 320×568,
390×844, and desktop widths. Try water add/undo, tracker create/edit, repeated
logging and undo, history, and settings. Check long tracker names and converted
values. This is a UI smoke test; use the separate test backend for cloud-backed
verification.

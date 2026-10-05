# Creatine

The Expo application lives in [`expo-app/`](expo-app/). See the [app README](expo-app/README.md) for architecture, Supabase setup, migrations, testing guidance, and platform notes.

## Start developing

Use Node.js 22 and run commands from `expo-app/`:

```sh
cd expo-app
npm ci
npm run dev
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Expo for development |
| `npm run dev:local` | Start with isolated local data and no cloud configuration |
| `npm run dev:test` | Start the disposable test environment |
| `npm run doctor` | Check the Expo project and dependencies |
| `npm run verify` | Run type checking, tests, and database migration checks |
| `npm run build:web` | Export the production web bundle |
| `npm run build:native` | Export iOS and Android JavaScript bundles |

CI runs verification and the web export. The native bundle export is a separate Metro bundling gate; it does not build or validate an installable app or replace device testing.

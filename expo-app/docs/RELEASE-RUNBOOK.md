# Drops release operations — prepared, with open gates

Run commands from `expo-app/` using Node22.23.3, the checked-in lockfile and EAS CLI24.10.0. This runbook prepares operations; it does not authorize production changes, create a deployed URL, or certify native/device acceptance. Use [IMPLEMENTATION-REPORT.md](IMPLEMENTATION-REPORT.md) for criterion-level outcomes and append actual operation IDs/results there.

On this Windows workstation, prepend the existing runtime before commands:

```powershell
$env:PATH = 'C:/Users/ridha/AppData/Local/drops-tools/node-v22.23.3-win-x64;' + $env:PATH
```

The existing cached EAS entry is `C:/Users/ridha/AppData/Local/npm-cache/_npx/c509d4de5ecf1e34/node_modules/eas-cli/bin/run`. In commands below, `eas` means the pinned CLI; on this workstation substitute `node <that-path>` if it is not installed on PATH. Confirm versions before operations. Do not silently upgrade SDKs or tooling to bypass failures.

## Current checkpoint and prerequisites

| Area | Latest reported state | Next gate |
| --- | --- | --- |
| Verification | Lead reported18 Jest suites/113 tests and both database verifiers passed. After delegated evidence changes, `npm run test:setup` independently passes18 Node checks | Final integrated rerun after latest source changes; record commands/timestamps. No new full-suite pass is inferred from the narrow/script reruns. |
| Local export | Atomic export wrapper passed a new local web build while preview8082 remained available | Final visual review remains open; export success is not visual acceptance. |
| Android | EAS build `b1e6cbfc-ccc7-4d0a-bf1a-3f5b6b44da68` FINISHED. APK: `https://expo.dev/artifacts/eas/pvaIb9GHAQB2unxwcSdg2ZzEZq5IsqhGQZOT0rpyxLs.apk` | It was based on dirty snapshot1356031 before latest canvas/unit UI fixes. Use a compatible update or new final build and record the exact tested source/runtime before release. No installed result exists here. |
| iOS simulator | Build `6bf2e1b4-da2e-4a4d-a236-7a6dd8aff12d` created; status not yet observed at this checkpoint | Retrieve actual result and simulator smoke evidence. |
| iOS physical | Lead reported expired signing certificate/provisioning profile | Renew/validate signing assets and produce/install compatible binary. Physical iPad is not registered/tested. |
| Hosted web | No immutable deployed URL/result recorded at this checkpoint | Deploy preview, verify exact returned URL, run real isolated cloud browser gate, retain rollback IDs. |
| EAS auto triggers | Existing project query returned `githubRepository:null` | Connect Expo GitHub App/repository to this EAS project. Merely pushing workflow files does not activate EAS push/PR triggers. |
| Native automation | EAS Maestro jobs rejected for paid-plan entitlement; GitHub manual Android alternative prepared and fixture secrets configured by lead | Emulator workflow remains unrun. Use already-authorized GitHub runner alternative; no paid upgrade. |

## Environment and secret boundaries

`npm run dev:local` strips all Supabase public URL/key variables and uses isolated SQLite on8082. `npm run dev:test` loads `.env.test.local` only, uses8083 and refuses the production project. Normal `dev`/`start` uses connected cloud configuration and8081; do not use it for disposable QA. `.env.test.local` requires a dedicated test project/public client key; service-role/secret keys are rejected by client guards. `EXPO_NO_DOTENV=1` prevents Expo reloading unintended files.

Drops Test is `snabmkbeoshxxxhtwkyi`; production is `xmkdzdqouxqmayoawztr`. Connector/browser fixture scripts allow only Drops Test and disposable QA identities. Preview guards prohibit the known production API origin, but are not a substitute for verifying environment assignments, custom domains and executed requests. Build public keys/URLs become client assets; keep every admin key, private fixture password, signing key and token out of `EXPO_PUBLIC_*`, source, uploaded artifacts and CLI argument logs.

Root `.easignore` excludes environments, signing files, artifacts and generated `expo-app/ios`/`android`; the cloud build uses CNG. `.fingerprintignore` excludes generated native directories too. Preserve original native projects in Git; do not package the stale scaffold to bypass CNG. EAS environment selection must agree for fingerprint, native build, update and web export. Current TestFlight profile uses preview backend with isolated `release-candidate` OTA channel; preview uses `preview`, production uses `production`.

## Local and dedicated-test verification

Run the relevant narrow tests first. The integrated commands are:

```text
npm ci
npm run doctor -- --local
npm run verify
npm run build:web
npm run build:native
npm run test:e2e:export
```

`build:native` exports JavaScript for iOS/Android; it does not create an installable binary. `test:e2e:export` verifies the isolated SQLite export on4173 and excludes `@visual`. Run visual checks separately against the appropriate exported/local server, using the existing approved Windows baselines:

```powershell
$env:DROPS_E2E_URL = 'http://127.0.0.1:4173'
npm run test:visual
Remove-Item Env:DROPS_E2E_URL
```

The preview server must already be serving `dist-pitwall` on4173 for that standalone visual command. Review actual zero/partial/full frames; do not update snapshots or loosen tolerances solely to make a failing result pass. Browser viewport rotation does not establish native iPad multitasking or accessibility.

For real cloud checks, prepare fresh disposable accounts using the reviewed process in [DROPS-CLOUD-QA.md](DROPS-CLOUD-QA.md). Credentials remain in a private temporary file outside the repository. Then:

```text
npm run build:web:test
npm run test:cloud
```

`test:cloud` needs the documented private provisioning/fixture input; it is not an anonymous smoke command. For an immutable test deployment, set `DROPS_QA_BROWSER_URL` to the returned HTTPS `.expo.app` URL and `DROPS_QA_CREDENTIALS_FILE` to the private fixture file, then run `npm run test:e2e:cloud`. That flow authenticates and exercises real save/correction/Undo/reload/sign-out/account isolation. Clean up exact fixture accounts/sessions/files afterward and record cleanup. Never substitute production accounts.

## Additive migration operations

All six checked-in files are ordered in `supabase/migrations/`. Existing legacy/bootstrap files must not be replayed into an established project just because they are present locally. Compare the actual remote ledger and schema first. The new atomic repository, plan-unit validation and preference-alias correction are additive files; preserve previously applied file contents and legacy local-wall-time semantics. New writes retain the legacy column and explicit UTC companion.

The checkout currently has no `supabase/config.toml`, and Supabase CLI was not found on PATH during this preparation. Do not run a guessed link/push against whichever project a workstation last used. The operator may apply reviewed pending files through the existing Supabase MCP workflow with the explicit approved project reference, or prepare/review the CLI configuration first. Inspect the remote migration list before either method and retain filename/hash/target/project evidence.

For an already configured, verified CLI workspace, discover flags via installed `--help`, then use this sequence against the explicitly linked Drops Test project:

```text
supabase --version
supabase migration list --help
supabase db push --help
supabase migration list --linked
supabase db push --linked --dry-run
```

Review the dry-run pending set and backups before the separately authorized `supabase db push --linked`. Do not use `--include-all`, seeds, remote reset or migration-history repair as a shortcut for a mismatch. Confirm grants/RLS/RPC signatures and execute real authenticated owner-isolation/rollback fixtures after applying. Production application requires separate reviewed target/backup/compatibility approval; the QA scripts must still refuse production. Edge `delete-account` deployment/configuration is a separate operation; retain its owner/recent-auth deletion evidence.

An application rollback does not roll back schema or restore user mutations. Keep additive columns/functions required by old supported clients. Resolve schema defects with a reviewed forward corrective migration; do not drop tables/columns or reset production to imitate application rollback. Recent PostgreSQL minor-upgrade notices include extension/operator compatibility changes; examine the target's actual version/extensions before restore/branching. No such server upgrade is requested here. [Supabase migration commands](https://supabase.com/docs/reference/cli/supabase-db-push), [current PostgreSQL notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

## Immutable web preview and rollback

From the reviewed source commit, export with dedicated test variables. `build:web:preview` expects preview EAS variables already present; local `build:web:test` reads `.env.test.local`. An explicit directory avoids confusing local SQLite output with cloud output:

```text
node scripts/export-app.mjs web test dist-cloud
eas deploy --export-dir dist-cloud --environment preview --json
```

Capture the returned deployment ID and immutable URL; do not create/reassign production aliases during preview. Set `DROPS_DEPLOY_URL` and `DROPS_DEPLOY_ID` from that exact result, then:

```text
npm run deploy:check
npm run release:manifest
```

`deploy:check` now requires an immutable-shaped `subdomain--deploymentId.expo.app` origin; it rejects credentials, query/fragment, arbitrary hosts and external redirects. Set the exact returned ID to bind the hostname suffix. It checks six HTML routes, isolation/nosniff headers, referenced scripts, bundled fonts and real WASM bytes, and saves hashes/safe fields in `artifacts/deployment-verification.json`. Host shape alone cannot prove that a custom alias is immutable; use the EAS-returned deployment ID and retain the CLI result. The probe remains HTTP/asset evidence, so run the real cloud browser gate and actual signup/recovery callback checks on this URL too.

Before promotion, record the previous known-good deployment ID and its schema/backend/source compatibility. To roll back an authorized alias, reassign it to that retained immutable deployment, then re-run HTTP and authenticated acceptance. Existing deployments stay available; avoid deleting the known-good deployment while clients or rollback procedures need it. Production alias operation, only when separately authorized:

```text
eas deploy:alias --prod --id <previous-known-good-production-deployment-id> --json
```

An alias switch changes served assets, not backend data. Record operation IDs/time, old/new alias targets and actual rollback verification. [Expo immutable deployment/alias operations](https://docs.expo.dev/eas/hosting/deployments-and-aliases/).

## Native build/update and compatible rollback

Current manual build entry points, when the operation is authorized:

```text
eas build --platform android --profile preview
eas build --platform ios --profile simulator
eas build --platform ios --profile preview
```

The preview workflow computes a fingerprint, searches compatible internal binaries, builds missing platforms and only publishes when both platform IDs exist. Fixing iOS signing is required to complete that workflow even if an Android build already exists. Match the runtime recorded by the actual binary to the fingerprint/update; do not invent equality from configuration alone. Re-test the final JavaScript update against the exact built native modules. Native module/plugin/config changes require a new binary; OTA cannot replace native code or change the binary's embedded channel. [Runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/).

Before each native publish retain the previous known-good update group, per-platform build IDs/fingerprints, embedded update version, channel/branch mapping and supported schema. A compatible OTA rollback republishes a known-good update to the affected channel, or rolls back to the binary's embedded update for the exact runtime. Confirm the chosen old update still works with the additive schema, and verify an installed app after receiving it:

```text
eas update:republish --group <known-good-group-id> --destination-channel <affected-channel> --platform all --message "Reviewed rollback" --json
eas update:roll-back-to-embedded --channel <affected-channel> --runtime-version <exact-runtime> --platform all --message "Reviewed embedded rollback" --json
```

Choose one appropriate operation; these are alternatives, not a sequence. Account for an active rollout before publishing and record resulting IDs. If the fault is native or there is no compatible old runtime/update, build a corrected replacement binary with preserved identifiers and an incremented build version, distribute it through the approved channel and test its installation/upgrade. A store rollback generally needs a replacement binary; do not promise immediate removal of already installed builds. [Expo rollback behavior](https://docs.expo.dev/eas-update/rollbacks/).

iOS signing uses team `TZ49JD65M9` and bundle ID `com.samlau25.expo-app`. Examine the actual expired certificate/profile error and owner-authorized credentials; renew the certificate/profile, ensure registered devices are included, and rerun the intended profile. Do not replace identifiers or credentials belonging to another project. Register the chosen physical iPad and regenerate ad-hoc provisioning before installation. Simulator smoke requires neither physical UDID nor ad-hoc provisioning, but cannot verify notification delivery, physical haptics or actual iPad window/pointer/keyboard/VoiceOver behavior. Keep those individual device/OS/build gates open until performed.

## Automation activation and costs

EAS auto triggers require the Expo GitHub App installed/authorized for `RidhaChowdhury/Creatine`, the existing Expo project linked to that repository, workflow files at the pushed reference, correct project/root directory discovery and preview EAS variables. Confirm project identity, GitHub connection and trigger configuration through a real observed run. Current `githubRepository:null` means this activation is incomplete. Validate workflow schema with pinned EAS CLI before dispatch; preserve the known paid Maestro rejection rather than upgrading the plan.

Web workflow triggers PRs to main and pushes to main/codex branch; it validates a local SQLite export then separately deploys a cloud preview and probes it. Those are distinct bundles/gates. PR and push refs can duplicate work. Native main workflow can incur two binary builds when fingerprints have no match. EAS native concurrency cancellation is supported only for the same branch; shared-channel manual/cross-branch serialization is not established. A future GitHub global-concurrency orchestration would need an explicitly provisioned Expo token and reviewed script; no token or orchestration is prepared here. TestFlight's approval is after build, so it gates submission rather than build cost. Monitor existing account limits before initiating repeated runs.

GitHub Android alternative is manual only. Read-only checks show the public repository's Actions enabled/all actions permitted. Push the reviewed root `.github/workflows/android-smoke.yml` so GitHub can discover it, supply the existing APK URL and dispatch on the chosen reviewed ref. Lead has configured `DROPS_NATIVE_QA_EMAIL`/`DROPS_NATIVE_QA_PASSWORD` secrets with one fresh test owner; preserve the fresh-state precondition and cleanup after the run. Emulator execution has not occurred. Never run a local emulator while the user is gaming. The hosted runner uploads only allowlisted post-login images and a safe fixed-field summary; raw Maestro reports/logs/failed-login screenshots are discarded. See [NATIVE-SMOKE.md](NATIVE-SMOKE.md). The optional EAS native-smoke workflow remains paid-plan-blocked and unrun.

## Manual production promotion

The newly prepared `.eas/workflows/production-web.yml` passed EAS schema validation per lead; it has not been executed. It is manual-dispatch only: validation uses isolated local SQLite/browser fixtures even though the job selects production environment; candidate deployment independently exports with production backend variables and `prod:false`; HTTP/asset probes plus manifest evidence precede a required approval; promotion reassigns the production alias to exactly the returned candidate deployment ID. No automated test fixtures run against the real production backend. It does not apply migrations or submit native store builds. Record the previous production deployment before dispatch because the workflow does not discover a rollback target automatically.

Complete final visuals, remote cloud/auth, dependency review, compatible native/device tests, migration/backups and rollback evidence before the production decision. Test-backend preview assets must never be promoted to a production alias/channel. Export a production candidate from the same reviewed source using production public backend variables; verify its intended target without disposable production fixtures. For an authorized production web operation:

```text
eas env:exec production "node scripts/export-app.mjs web production dist-production"
eas deploy --export-dir dist-production --environment production --json
```

Retain that separate immutable production candidate ID. After concrete candidate review and explicit production promotion authorization, use `eas deploy:alias --prod --id <reviewed-production-candidate-id> --json`. Native production uses the `production` build profile/channel/environment; review fingerprints, signing, distribution/account deletion policy and store submission separately. TestFlight's manual workflow is a preview-backend candidate, not automatic production release. No production promotion or submission has been executed by preparing this document.

## Required retained evidence and remaining limits

`release-manifest.json` now includes source commit/dirty state, Node and selected environment label, lock/config/export-manifest SHA256, per-platform IDs/fingerprints, deployment/update IDs and optional previous rollback IDs. Its environment hash is a hash of the selected label, not a secret-containing dump or proof of effective backend configuration. Export metadata may contain dirty source; a release operator must require reviewed/clean source and compare the export commit to the candidate. Prepackaged EAS exports may not supply a local export manifest; null/absent evidence remains unknown.

Migration status defaults to unknown. Only after comparing the actual remote ledger may the operator supply `DROPS_APPLIED_MIGRATIONS` as a JSON filename array and `DROPS_MIGRATIONS_VALIDATED_AT` as its verification timestamp. This is operator-attested evidence, not an automatic database query. Keep ledger/project evidence separately. Optional rollback inputs are `DROPS_PREVIOUS_DEPLOYMENT_ID`, `DROPS_PREVIOUS_UPDATE_ID`, `DROPS_PREVIOUS_IOS_BUILD_ID`, `DROPS_PREVIOUS_ANDROID_BUILD_ID`, `DROPS_PREVIOUS_RUNTIME`, `DROPS_ROLLBACK_CHANNEL`, and `DROPS_ROLLBACK_RESULT` (`unrun`, `passed`, `failed`). Set passed only after execution/acceptance, and preserve independent outcome evidence.

Retain immutable URL/ID, APK/binary hash/source/runtime, channel/branch mapping, prior known-good IDs, applied ledger hashes, safe HTTP probe JSON, cloud/browser test results, native device/OS/build details, screenshots and actual rollback results. Current workflows pass build/deploy metadata but do not populate previous-known-good rollback inputs or query the remote migration ledger. Setting IDs in a manifest does not execute rollback or prove compatibility. Record these open requirements rather than treating a generated JSON file as release approval.

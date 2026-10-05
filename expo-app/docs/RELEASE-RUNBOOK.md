# Drops release operations — prepared, with open gates

Run commands from `expo-app/` using Node22.23.3, the checked-in lockfile and EAS CLI 24.10.0. This runbook prepares operations; it does not authorize production changes, create a deployed URL, or certify native/device acceptance. Use [IMPLEMENTATION-REPORT.md](IMPLEMENTATION-REPORT.md) for criterion-level outcomes and append actual operation IDs/results there.

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
| Android | Replacement build `6cb79077-c6fe-41e3-8d17-4b0ee7c438aa` FINISHED at 2026-10-05T04:45:00.464Z; API 35 hosted smoke run 37264973906 passed actual APK login/write/History/relaunch | Compare final JS/source and preview-environment fingerprint before OTA. Physical-device/notification acceptance remains unrun; older build b1e6cbfc is historical compile evidence. |
| iOS simulator | Replacement `90587a7f-6ecf-46fa-8ff0-b7ac29b7400d` FINISHED at 2026-10-05T04:52:56.341Z after one bounded remote-upload retry; direct expo-asset fixed Doctor 18/18 | No simulator execution. Build fingerprint is 7c626037e3f0667c14085f23cf191205a2ab8988; build:view runtimeVersion is null, so verify embedded runtime rather than equating metadata fields. |
| iOS physical | Lead reported expired signing certificate/provisioning profile | Renew/validate signing assets and produce/install compatible binary. Physical iPad is not registered/tested. |
| Hosted web | No immutable deployed URL/result recorded at this checkpoint | Deploy preview, verify exact returned URL, run real isolated cloud browser gate, retain rollback IDs. |
| EAS auto triggers | Existing project query returned `githubRepository:null`; native auto triggering is now delegated to prepared GitHub dispatcher | Native dispatcher needs repository EXPO_TOKEN and a pushed/discoverable workflow. Direct EAS web push/PR triggers still require Expo GitHub connection. No dispatcher execution is claimed. |
| Native automation | EAS Maestro remains paid-plan-blocked. GitHub hosted Android smoke passed; same-repository codex/drops-v01 PR trigger and manual entry exist | New fixture pre-reset/finally-cleanup passed guard tests and two real owner resets; updated hosted lifecycle rerun remains pending. No local emulator or paid upgrade. |

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

Read-only channel inspection found `preview` mapped to branch `preview`, channel ID `01a10a18-8ba5-77a6-afee-b1ff95c00413` and branch ID `01a10a18-8af9-741e-baf3-4be4b76ac2c6`, with no existing update groups. Therefore no known-good OTA group is currently available for republish rollback. The simulator profile shares preview channel/environment, but it does not satisfy the workflow's physical iOS preview profile/signing gate. TestFlight stays on `release-candidate` with preview backend; production stays on `production` with production backend.

Prepared read-only preflight, using the same reviewed clean checkout and EAS preview variables as the binary (commands below have not been executed by this preparation):

```text
eas channel:view preview --json
eas build:view 6cb79077-c6fe-41e3-8d17-4b0ee7c438aa --json
eas build:view 90587a7f-6ecf-46fa-8ff0-b7ac29b7400d --json
eas fingerprint:generate --build-profile preview --platform android --json --non-interactive
eas fingerprint:generate --build-profile simulator --platform ios --json --non-interactive
```

Compare the Android fingerprint to 137fab6f653ec9e66961875d1f86aad51da08277 and simulator fingerprint to 7c626037e3f0667c14085f23cf191205a2ab8988. The Android safe build record also records that runtime; the simulator record has runtimeVersion null. Check actual embedded update configuration/binary before any runtime-specific iOS rollback. Do not consume a local `.env.test.local` export as OTA evidence, or pass `--skip-bundler` on an old/dist-local bundle. Preview guards must validate the intended Drops Test endpoint before publishing; current native update hook does so.

When separately authorized, an Android-only preview update can avoid the still-blocked physical iOS preview build. Coordinate it with the existing native dispatcher lock/operator single-run policy because direct CLI publishing bypasses GitHub serialization. Pinned CLI 24.10.0 supports the explicit fresh-export command:

```text
eas update --channel preview --environment preview --platform android --input-dir dist-preview-ota --emit-metadata --message "Reviewed Drops preview Android update" --json --non-interactive
```

Retain returned update group ID, per-update platform/runtime/fingerprint, metadata and asset hashes, exact source SHA, channel mapping and successful installed update/relaunch evidence. No OTA publication or update-installation acceptance is claimed here. Initially prepare embedded rollback for the independently verified Android runtime:

```text
eas update:roll-back-to-embedded --channel preview --runtime-version 137fab6f653ec9e66961875d1f86aad51da08277 --platform android --message "Reviewed Android embedded rollback" --json --non-interactive
```

That command is a remote mutation to execute only after rollback authorization and confirmed embedded runtime/schema compatibility. Do not use the iOS fingerprint as an unverified runtime argument. Once a verified known-good OTA group exists, use the republish alternative below with its actual retained group ID. Do not force-end an active rollout until its state and intended rollback are reviewed. After either rollback, exercise installed reload, owner data retention and auth; alias/update metadata alone is not rollback execution evidence.

Before each native publish retain the previous known-good update group, per-platform build IDs/fingerprints, embedded update version, channel/branch mapping and supported schema. A compatible OTA rollback republishes a known-good update to the affected channel, or rolls back to the binary's embedded update for the exact runtime. Confirm the chosen old update still works with the additive schema, and verify an installed app after receiving it:

```text
eas update:republish --group <known-good-group-id> --destination-channel <affected-channel> --platform all --message "Reviewed rollback" --json
eas update:roll-back-to-embedded --channel <affected-channel> --runtime-version <exact-runtime> --platform all --message "Reviewed embedded rollback" --json
```

Choose one appropriate operation; these are alternatives, not a sequence. Account for an active rollout before publishing and record resulting IDs. If the fault is native or there is no compatible old runtime/update, build a corrected replacement binary with preserved identifiers and an incremented build version, distribute it through the approved channel and test its installation/upgrade. A store rollback generally needs a replacement binary; do not promise immediate removal of already installed builds. [Expo rollback behavior](https://docs.expo.dev/eas-update/rollbacks/).

iOS signing uses team `TZ49JD65M9` and bundle ID `com.samlau25.expo-app`. Examine the actual expired certificate/profile error and owner-authorized credentials; renew the certificate/profile, ensure registered devices are included, and rerun the intended profile. Do not replace identifiers or credentials belonging to another project. Register the chosen physical iPad and regenerate ad-hoc provisioning before installation. Simulator smoke requires neither physical UDID nor ad-hoc provisioning, but cannot verify notification delivery, physical haptics or actual iPad window/pointer/keyboard/VoiceOver behavior. Keep those individual device/OS/build gates open until performed.

## Automation activation and costs

Direct EAS web auto triggers require the Expo GitHub App installed/authorized for `RidhaChowdhury/Creatine`, the existing Expo project linked to that repository, workflow files at the pushed reference, correct project/root directory discovery and preview EAS variables. Confirm project identity, GitHub connection and trigger configuration through a real observed run. Current `githubRepository:null` means this activation is incomplete. Validate workflow schema with pinned EAS CLI before dispatch; preserve the known paid Maestro rejection rather than upgrading the plan.

Web workflow triggers relevant app-path PRs to main and relevant app-path pushes to main; docs-only changes and codex branch pushes do not trigger repeated heavy QA. It validates a local SQLite export then separately deploys a cloud preview and probes it. Those are distinct bundles/gates. GitHub CI and Android PR smoke also filter relevant app paths. Native preview can incur two binary builds when fingerprints have no match. TestFlight's approval is after build, so it gates submission rather than build cost. Monitor existing account limits before initiating repeated runs.

Root `.github/workflows/native-preview-dispatch.yml` now owns automatic native main pushes and manual native dispatch. Its fixed concurrency group `drops-native-preview`, `cancel-in-progress:false` and EAS CLI `--wait` serialize normal GitHub dispatch runs across refs until remote completion. It uses Node22.23.3, locked dependencies and pinned CLI 24.10.0. EAS native-preview no longer has a push trigger, preventing a duplicate automatic publisher. Configure an owner-authorized repository `EXPO_TOKEN` secret before activation; the prepared job fails clearly if absent and never prints it. No token was created/configured or dispatcher executed by this preparation. It uploads the checked-out local project via CLI, so it does not rely on the currently missing Expo GitHub connection; `--ref` is intentionally omitted. Root archive exclusions still apply.

Operationally, initiate native preview through this GitHub workflow rather than directly through EAS CLI/dashboard: direct EAS manual runs bypass the GitHub lock. GitHub concurrency normally retains one active and one pending run; newer queued runs can replace older pending runs. If the GitHub dispatcher times out, is canceled or loses connectivity, its remote EAS run may continue after the lock releases. Check and settle that remote run before another dispatch; this is not a distributed lock over all EAS operations. Global serialization is prepared source behavior and not yet proven by execution. [EAS dispatch/wait flags](https://docs.expo.dev/eas/cli/), [Expo CI tokens](https://docs.expo.dev/accounts/programmatic-access/), [GitHub concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency).

GitHub Android smoke permits manual input and same-repository PRs only from `codex/drops-v01`, with nonempty public `DROPS_PREVIEW_APK_URL`; manual input takes precedence. Fixture secrets remain emulator-step-only. Run 37264973906 passed on hosted API 35; safe evidence retains three named post-login images and a summary. The reusable fixture now authenticates only to Drops Test, verifies server getUser and disposable marker, resets eight exact-owner app tables before flow and in finally, verifies empty and preserves the Auth account. Failed cleanup fails the run; updated hosted reset lifecycle is still awaiting rerun. Never run a local emulator while the user is gaming. Raw Maestro reports/logs/failed-login screenshots are discarded. See [NATIVE-SMOKE.md](NATIVE-SMOKE.md). Optional EAS Maestro remains paid-plan-blocked and unrun.

## Manual production promotion

Use the manual GitHub `production-web-dispatch.yml` entry point. Its fixed `drops-production-web` concurrency group and `cancel-in-progress:false` hold the normal dispatch lock across refs while EAS waits for final approval and alias promotion. No automatic production trigger is added. Direct EAS manual dispatch bypasses this lock: operators must ensure a single active production run. A GitHub timeout/cancellation can leave its remote EAS run alive; settle that run before dispatching another candidate. Approval should verify the intended candidate/source and current alias immediately before promotion. EAS does not provide a global custom concurrency lock; this source preparation has not been executed. [EAS concurrency limitations](https://docs.expo.dev/eas/workflows/syntax/).

The candidate's `after_install_node_modules` hook runs `guard-production.mjs` before export. It rejects missing/test/local/arbitrary backend origins, non-public keys, dotenv loading and disposable QA configuration, and accepts only the reviewed production project `xmkdzdqouxqmayoawztr`. It uploads a safe project-reference/timestamp artifact; the subsequent verification job independently checks its environment and includes allowlisted guard metadata/hash in the release manifest. This guards environment selection without production fixture writes. It does not prove deployed bundle identity or execute authenticated production acceptance. [Supported deployment hooks](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/).

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

# Dependency and release review — 2026-10-04

This is an independent source review of the saved `artifacts/dependency-audit.json`, lockfile, release configuration, scripts, and provider. No dependency installation, upgrade, remote workflow, native build, or installed-device test was performed for this review. Audit findings remain open; this document does not certify shipping readiness.

## Audit interpretation

The artifact reports 39 vulnerable package nodes: 23 high, 16 moderate, zero critical. These are inherited dependency findings, not 39 distinct vulnerable implementations. Five leaf packages account for six advisories. Versions below are the installed lockfile versions, not proposed SDK versions.

| Package | Installed | Advisory patch | Action and exposure to establish |
| --- | --- | --- | --- |
| braces | 3.0.3 | None listed for GHSA-vfj7-8cjw-p6xm | Nested brace input can exhaust the stack. Trace build/glob input reachability and monitor upstream. An audit suggestion to replace React Native with 0.87.1 is an SDK migration, not a validated patch. |
| decode-uri-component | 0.2.2 | 0.5.0 | Malformed percent input can cause excessive processing. Prioritize investigating route/query parsing reachability. A scoped override is a candidate only after consumer compatibility and malformed-input tests; Expo Router 58 is a separate major migration. |
| image-size | 1.2.1 | 2.0.3 for both advisories | Malformed PNM/ICNS image parsing can block the Node event loop. Prioritize asset/build pipeline mitigation. The patch requires a package major upgrade from the installed 1.x API; inspect Metro/Expo consumers before overriding. Do not accept untrusted image assets in builds meanwhile. |
| node-forge | 1.4.0 | None listed for GHSA-86w9-cpqp-85rv | RSA PKCS#1 v1.5 verification can accept invalid signature encodings. Trace the Expo code-signing and CLI consumers and trust boundaries; presence alone does not demonstrate reachable app exploitation. Track upstream remediation. |
| uuid | 7.0.3 | 11.1.1, 12.0.1, 13.0.1 | Advisory concerns caller-provided buffers in v3/v5/v6. App entry IDs use expo-crypto randomUUID; no direct implicated app call was identified. Inspect tooling callers before an override across several majors. |

Primary advisory references: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [image-size PNM](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [image-size ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

Do not run `npm audit fix --force` on this artifact. Its proposals include Expo 44.0.6 and expo-updates 0.11.7, downgrades incompatible with the selected Expo 54 / React Native 0.81.5 baseline. Retain the lockfile and SDK-compatible package matrix; evaluate targeted fixes in a separate reviewable change with exports, route decoding, native build and relevant signing checks. Re-audit after any accepted change and retain unresolved findings explicitly.

## Release review findings

Integration follow-up below records source changes and lead-reported checks after the initial read-only review. It does not retroactively claim those checks were executed during that review. Advisory remediation remains unresolved.

1. Provider account/mounted guards are fixed in integration commit `cb5b71c`, per lead. Stale reminder reconciliation failures and account replacement now invalidate the old account's work. Retain isolation-race coverage; installed-device account switching remains a separate check.
2. Local browser harness identity is fixed: preview emits a per-process random `X-Drops-Preview-Run` nonce, runner requires the exact nonce and forces `dist-pitwall`. Lead's negative check with an existing 4173 server exited `EADDRINUSE` before launching the browser. The positive final-export check subsequently ran `npm run test:e2e:export` under Node 22.23.3: all 15 functional tests passed in 1.3 minutes, exit code 0. The wrapper started its own preview and cleaned it up after the run; the separate user preview on 8082 remained running and returned HTTP 200. These later execution results were not performed during the initial read-only dependency review.
3. Default browser runner excludes `@visual`; its explicit `--visual` mode can run that suite. The local exported bundle passed 15 functional browser tests and six reviewed Windows visual baselines in a separate comparison run without updating snapshots. Strict pixel checks verify zero/partial/full water, readable WATER text and submerged numeral masking, while three identical painted frames reject transient layout captures. The headless harness explicitly uses ANGLE SwiftShader to avoid hardware-compositor tile artifacts; it does not weaken pixel or comparison thresholds. Actual in-app browser 8/8 oz rendering also passed with one Performance panel and no duplicate black rectangle. No active black-rendering defect remains. Default hosted nonvisual checks still provide no visual acceptance; these Windows results do not establish hosted, Linux or installed-native visual behavior.
4. Router header configuration covers route responses; static assets require separate hosted verification. Updated deployment probes validate six HTML routes, same-origin redirects, nosniff/COOP/COEP, referenced script assets, fonts and real WASM bytes, then retain safe JSON hashes. Data lane's complete verify passed 116 Jest tests and 22 Node setup checks, together with TypeScript, migration and repository checks. After later guard additions, the setup suite separately passed 26 checks. These are distinct observed runs. The probes still do not prove cloud login, account isolation, callback redirects, persistence, installed native launch or actual rollback. Keep those as explicit gates. [Expo router headers](https://docs.expo.dev/router/web/server-headers/), [hosting responses](https://docs.expo.dev/eas/hosting/reference/responses-and-headers/).
5. The local validation export strips cloud variables by design. The deploy job exports independently with preview environment variables. Passing local E2E validates the isolated SQLite bundle, not the deployed cloud bundle; post-deploy HTTP probes alone cannot close that gap. [Expo environment usage](https://docs.expo.dev/eas/environment-variables/usage/).
6. TestFlight OTA isolation is fixed: its profile now uses `release-candidate`, while native preview uses `preview`. Both select the dedicated preview backend environment intentionally; release-candidate is not a production backend/store release. Actual channel/runtime delivery remains unverified by this review.
7. PR and main push triggers can both execute web work for the same revision; cancellation groups by Git ref do not deduplicate distinct refs. Native hash lookup avoids builds when a compatible internal binary exists, but cannot eliminate custom validation/deploy work. TestFlight approval is after the build, so approval does not gate its build cost. Actual credits/credentials and successful cloud execution remain external gates.

Focused source integration is recorded in commit `39fe3b1`; browser coverage and reviewed visual baselines are recorded in commit `b10d360`. Local browser evidence used bundle `33f58cae86833979f0f7e1dc36bf1da9.js` at `http://127.0.0.1:4173/`. See [implementation evidence](IMPLEMENTATION-REPORT.md) for acceptance scope and screenshot paths. Hosted and native result updates remain lead-owned and pending in this review.

Later final-export verification used hydration-fixed bundle `c4268f7e8f83d4e85c9dadd3d39eca86.js` under Node 22.23.3. The positive wrapper passed all 18 functional browser checks in 1.7 minutes, then its explicit `--visual` mode passed six existing visual comparisons in 23.2 seconds without updating baselines. Three added cases exercise 1024×1366 portrait, 1366×1024 landscape and 507×980 narrow windows, retaining incomplete form fields, History filters and selected chart points across all three sizes. Two test selector mismatches were corrected without application changes. Each run used one headless worker and cleaned up its own 4173 preview; user preview 8082 retained PID 14160 and HTTP 200. These checks provide browser evidence, not installed iPad evidence.

## Phone preview worker compatibility — October 6, 2026

The hosted phone smoke test reproduced a startup failure in Playwright WebKit:
Expo 54.0.37 immediately revoked the blob URL used to bootstrap an isolated
SQLite worker. A minimal native worker probe succeeded when that URL remained
valid and failed when it was revoked immediately. `scripts/patch-expo-worker.mjs`
now retains only that bootstrap URL until the worker's first message, error, or
termination, and cleans up on constructor failure. Postinstall applies the
idempotent, exact-version/source-checked patch; unexpected upstream code stops
with a review instruction. It preserves Expo's isolation headers, fetch/import
base URL handling, and direct-worker path. Review and retire this workaround
when upgrading Expo; do not silently expand its supported version range.

Playwright's WebKit port also lacks SharedArrayBuffer in this environment,
despite a secure, isolated document. The phone QA report records this capability
as unsupported separately while still requiring real SQLite write/reload,
rendering, edit/Undo, and navigation checks. It never injects a replacement
SharedArrayBuffer or mock storage. [Upstream Playwright issue](https://github.com/microsoft/playwright/issues/28513).
Physical Safari verification remains a separate gate.

## Configuration that is coherent, with remaining evidence gates

Root `.easignore` is the authoritative archive exclusion; the app-local duplicate has been removed. It excludes generated iOS/Android projects so cloud builds use CNG. `.fingerprintignore` excludes the same native directories; installed fingerprint path matching converts trailing `/**` into a directory match, so this also excludes bare-directory fingerprint sources. Original native projects remain in Git without entering cloud archives. Verify the actual cloud binary's recorded runtime hash against the workflow fingerprint and its subsequent OTA update before claiming reuse works. [Expo fingerprint reference](https://docs.expo.dev/versions/latest/sdk/fingerprint/).

Fingerprint jobs and preview build profiles select the preview environment, consistent with Expo's requirement that those environments match. `after` permits conditional native build jobs to be skipped while existing build IDs feed publish; success of these workflows has not been observed in this review. [Workflow syntax](https://docs.expo.dev/eas/workflows/syntax/).

`supportsTablet`, resizable-window configuration and iPad orientations express intended support. They do not establish rotation, keyboard/pointer, accessibility, narrow split view, background notifications, or cold/warm auth behavior on physical devices. Native JavaScript export is a bundling check only. Do not label it an installed iOS/Android acceptance test.

# Bounded CI infrastructure retries

Use `node scripts/retry-infrastructure.mjs -- npm ci` or `node scripts/retry-infrastructure.mjs -- npx playwright install --with-deps chromium` in CI install steps. Read-only package metadata is also supported, for example `node scripts/retry-infrastructure.mjs -- npm view expo version`.

The helper streams original command logs and preserves the final exit code. It makes at most three attempts with 1-second and 3-second delays, and retries only explicit ECONNRESET, ETIMEDOUT, EAI_AGAIN or HTTP 502/503/504 failures. Authentication, configuration, dependency-resolution, permission and deterministic test/type/schema errors take precedence and stop immediately. A signaled process is never retried.

The allowlist excludes tests, typechecks, builds, deployments, migrations, publishing and fixture mutations. Do not broaden it to remote writes. Arguments must be literal and contain no credentials; use protected CI environment variables for installation authentication. The helper never prints arguments or dumps the environment. Original command output is streamed, so callers must themselves avoid printing secrets.

Run focused checks with `node --test scripts/__tests__/retry-infrastructure.test.mjs`. Workflow integration remains a separate change.

## Observed EAS artifact-path failure

Web run `01a10a55-52c4-7ac6-965e-8557fc5f3ad8`, validation job `01a10a55-53a7-73e0-bbd0-4722a8d9d5e9`, passed all 15 local exported-browser tests at `2026-10-05T04:36:50.039Z`. Its subsequent Upload artifact step failed at `04:36:50.127Z`: path `artifacts` matched no files and tar reported `no paths specified to add to archive`. Deployment was skipped. This deterministic path error is not eligible for infrastructure retry.

The checkout log shows shell steps changing to the app subdirectory, while upload matching uses the archive root. EAS artifact paths are now `expo-app/artifacts` (or the explicit production guard file beneath it) in web-preview, native-preview and production-web. All three revised workflow files passed EAS CLI 24.10.0 schema validation. Corrected upload execution remains pending a clean source checkpoint and rerun; passing schema does not prove an uploaded artifact exists. The sanitized summary is retained in `artifacts/workflow-validation-failure-01a10a55.json`; raw logs, signed URLs and environment values are not retained.

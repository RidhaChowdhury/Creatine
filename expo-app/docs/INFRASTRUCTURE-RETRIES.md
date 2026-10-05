# Bounded CI infrastructure retries

Use `node scripts/retry-infrastructure.mjs -- npm ci` or `node scripts/retry-infrastructure.mjs -- npx playwright install --with-deps chromium` in CI install steps. Read-only package metadata is also supported, for example `node scripts/retry-infrastructure.mjs -- npm view expo version`.

The helper streams original command logs and preserves the final exit code. It makes at most three attempts with 1-second and 3-second delays, and retries only explicit ECONNRESET, ETIMEDOUT, EAI_AGAIN or HTTP 502/503/504 failures. Authentication, configuration, dependency-resolution, permission and deterministic test/type/schema errors take precedence and stop immediately. A signaled process is never retried.

The allowlist excludes tests, typechecks, builds, deployments, migrations, publishing and fixture mutations. Do not broaden it to remote writes. Arguments must be literal and contain no credentials; use protected CI environment variables for installation authentication. The helper never prints arguments or dumps the environment. Original command output is streamed, so callers must themselves avoid printing secrets.

Run focused checks with `node --test scripts/__tests__/retry-infrastructure.test.mjs`. Workflow integration remains a separate change.

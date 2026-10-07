import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvironment, validateBackend, productionProjectRef } from '../project-env.mjs';

const production = { EXPO_PUBLIC_SUPABASE_URL: `https://${productionProjectRef}.supabase.co`, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
const isolated = { EXPO_PUBLIC_SUPABASE_URL: 'https://separate-test.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
test('local launch removes every cloud variable even when inherited', () => {
  const result = buildEnvironment('local', production, { ...production, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'secret', KEEP: 'yes' });
  assert.equal(result.EXPO_PUBLIC_SUPABASE_URL, undefined);
  assert.equal(result.EXPO_PUBLIC_SUPABASE_ANON_KEY, undefined);
  assert.equal(result.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, undefined);
  assert.equal(result.EXPO_NO_DOTENV, '1');
  assert.equal(result.KEEP, 'yes');
});
test('test launch replaces inherited production config with explicit test config', () => {
  const result = buildEnvironment('test', isolated, { ...production, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'production-legacy-key' }, production.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(result.EXPO_PUBLIC_SUPABASE_URL, isolated.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(result.EXPO_PUBLIC_SUPABASE_ANON_KEY, undefined);
});
test('test launch rejects both the known live project and custom production URL', () => {
  assert.throws(() => buildEnvironment('test', production, {}), /refuses the production/);
  assert.throws(() => buildEnvironment('test', isolated, {}, isolated.EXPO_PUBLIC_SUPABASE_URL), /refuses the production/);
});
test('secret and service-role keys are rejected before launching', () => {
  assert.throws(() => validateBackend({ ...isolated, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' }, 'cloud'), /never a secret/);
  const key = `eyJfixture.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.fixture`;
  assert.throws(() => validateBackend({ ...isolated, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }, 'cloud'), /never a service-role/);
});
test('cloud launch respects explicitly configured shell variables', () => {
  const result = buildEnvironment('cloud', isolated, production);
  assert.equal(result.EXPO_PUBLIC_SUPABASE_URL, production.EXPO_PUBLIC_SUPABASE_URL);
});
test('incomplete config and credential-bearing URLs fail with actionable messages', () => {
  assert.throws(() => buildEnvironment('cloud', {}, {}), /dev:local/);
  assert.throws(() => validateBackend({ ...isolated, EXPO_PUBLIC_SUPABASE_URL: 'https://name:password@example.com' }, 'cloud'), /without credentials/);
});

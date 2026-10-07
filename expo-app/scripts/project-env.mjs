import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const productionProjectRef = 'xmkdzdqouxqmayoawztr';
const publicVariables = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

function readEnvironment(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

export function validateBackend(environment, mode, productionUrl) {
  const url = environment.EXPO_PUBLIC_SUPABASE_URL;
  const key = environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || environment.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Set a Supabase URL and public client key, or use npm run dev:local.');
  if (/your-project|your-test-project/.test(url) || /your-key/.test(key)) throw new Error('Replace the example Supabase values with your project configuration.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('The Supabase project URL is invalid.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) throw new Error('Use HTTPS for a remote Supabase project.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error('Use the project API base URL without credentials, paths, or query parameters.');
  if (key.startsWith('sb_secret_')) throw new Error('Use a public publishable or anon key, never a secret key.');
  if (key.startsWith('eyJ')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { throw new Error('The legacy client key is invalid.'); }
    if (role !== 'anon') throw new Error('Use the anon client key, never a service-role key.');
  } else if (!key.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable or legacy anon key.');
  if (mode === 'test' && (parsed.hostname === `${productionProjectRef}.supabase.co` ||
      (productionUrl && parsed.origin === new URL(productionUrl).origin))) {
    throw new Error('The test launcher refuses the production Supabase project. Use a separate Drops Test project.');
  }
  return { url: parsed.origin, key };
}

export function buildEnvironment(mode, fileEnvironment = {}, inherited = process.env, productionUrl) {
  if (!['cloud', 'local', 'test'].includes(mode)) throw new Error(`Unknown backend mode: ${mode}`);
  const environment = { ...inherited, EXPO_NO_DOTENV: '1' };
  if (mode === 'local' || mode === 'test') for (const name of publicVariables) delete environment[name];
  if (mode !== 'local') {
    Object.assign(environment, fileEnvironment);
    // Shell configuration takes precedence for the normal connected app.
    if (mode === 'cloud') for (const name of publicVariables) if (inherited[name] !== undefined) environment[name] = inherited[name];
    validateBackend(environment, mode, productionUrl);
  }
  environment.EXPO_NO_DOTENV = '1';
  return environment;
}

export function loadEnvironment(mode, inherited = process.env) {
  const cloudFiles = { ...readEnvironment(join(projectRoot, '.env')), ...readEnvironment(join(projectRoot, '.env.local')) };
  if (mode === 'test') {
    const testPath = join(projectRoot, '.env.test.local');
    if (!existsSync(testPath)) throw new Error('Create .env.test.local from .env.test.example using a separate Supabase test project.');
    return buildEnvironment(mode, readEnvironment(testPath), inherited,
      inherited.EXPO_PUBLIC_SUPABASE_URL || cloudFiles.EXPO_PUBLIC_SUPABASE_URL);
  }
  return buildEnvironment(mode, cloudFiles, inherited);
}

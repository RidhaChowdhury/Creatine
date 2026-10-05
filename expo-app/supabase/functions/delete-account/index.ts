import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'Use POST.');
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, 'Sign in again to delete your account.');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Live Auth verification rejects deleted/invalid users; never trust request user IDs.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply(401, 'Sign in again to delete your account.');
  let body: { confirmation?: string };
  try { body = await request.json(); } catch { return reply(400, 'Confirm deletion explicitly.'); }
  if (body?.confirmation !== 'DELETE') return reply(400, 'Confirm deletion explicitly.');
  try {
    // The JWT was verified above. Require this session's recent password challenge,
    // rather than a user timestamp that another signed-in device could update.
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    const now = Date.now() / 1000;
    const recentPassword = claims.amr?.some((entry: { method: string; timestamp: number }) =>
      entry.method === 'password' && Number.isFinite(entry.timestamp) && now - entry.timestamp >= -30 && now - entry.timestamp <= 300);
    if (!recentPassword) return reply(403, 'Confirm your current password again before deleting.');
    const revoke = await admin.auth.admin.signOut(token, 'global');
    if (revoke.error) return reply(503, 'Session revocation failed. Retry after signing in.');
    const deletion = await admin.auth.admin.deleteUser(data.user.id);
    if (deletion.error) return reply(503, 'Account deletion failed. Sign in and retry.');
    return reply(200, 'Account deleted.');
  } catch { return reply(400, 'A fresh password sign-in is required.'); }
});

// Owner-authenticated maintenance of the reusable disposable native QA fixture.
// No admin credential, configurable host, auth-user deletion or production call.
export const nativeTestOrigin='https://snabmkbeoshxxxhtwkyi.supabase.co';
const publicKey='sb_publishable_NdtsrdMH-YacQ2XXHElAbg_15pwK_ao';
export const nativeFixtureTables=Object.freeze(['drops_operations','tracker_entries','intake_log','drops_profiles','tracker_preferences','tracked_items','drops_preferences','user_settings']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function resetNativeFixture({email,password,expectedId,fetchImpl=fetch}={}) {
  let stage='guard',token,failure;
  const request=async (route,options={})=>{
    const response=await fetchImpl(`${nativeTestOrigin}${route}`,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:publicKey,...(token?{Authorization:`Bearer ${token}`}:{}) ,'Content-Type':'application/json',...options.headers}});
    if(!response.ok)throw new Error('Request rejected');
    return response;
  };
  try {
    if(typeof email!=='string'||!/^drops-qa-[a-f0-9-]+@example\.invalid$/.test(email)||typeof password!=='string'||!password||(expectedId&&!uuid.test(expectedId)))throw new Error('Fixture guard rejected');
    stage='authenticate';
    const login=await (await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})})).json();
    token=login.access_token;
    if(typeof token!=='string'||!token)throw new Error('Missing session');
    stage='verify-owner';
    const user=await (await request('/auth/v1/user')).json();
    // Metadata is only an additional fixture guard. Auth verification and RLS
    // establish ownership; user-editable metadata never grants authorization.
    if(!uuid.test(user.id??'')||user.email!==email||user.role!=='authenticated'||user.aud!=='authenticated'||user.user_metadata?.test_fixture!=='drops-isolated-qa'||(expectedId&&user.id!==expectedId))throw new Error('Fixture identity rejected');
    const owner=user.id; // Never derive the mutation filter from config or login response.
    for(const table of nativeFixtureTables) {
      const filter=`user_id=eq.${encodeURIComponent(owner)}`;
      stage='delete-owner-data';
      await request(`/rest/v1/${table}?${filter}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
      stage='verify-empty';
      const rows=await (await request(`/rest/v1/${table}?select=user_id&${filter}&limit=1`)).json();
      if(!Array.isArray(rows)||rows.length)throw new Error('Fixture not empty');
    }
  } catch { failure=new Error(`Native fixture reset failed (${stage}). Private details suppressed.`); }
  finally {
    if(token)try {await request('/auth/v1/logout?scope=local',{method:'POST'});}catch{failure??=new Error('Native fixture reset failed (session-cleanup). Private details suppressed.');}
  }
  if(failure)throw failure;
  return {status:'passed',projectRef:'snabmkbeoshxxxhtwkyi',tablesVerifiedEmpty:nativeFixtureTables.length};
}

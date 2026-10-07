import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardProductionBackend} from '../guard-production.mjs';
import {productionProjectRef} from '../project-env.mjs';
const environment={EXPO_NO_DOTENV:'1',EXPO_PUBLIC_SUPABASE_URL:`https://${productionProjectRef}.supabase.co`,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_placeholder'};
test('production export accepts only reviewed production origin and returns safe metadata',()=>{
  const result=guardProductionBackend(environment);
  assert.equal(result.projectRef,productionProjectRef);assert.equal(result.status,'passed');
  assert(!JSON.stringify(result).includes(environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
});
test('production export refuses missing, local, test, credentials, path and secret-key configurations',()=>{
  for(const patch of [{EXPO_NO_DOTENV:'0'},{EXPO_PUBLIC_SUPABASE_URL:''},{EXPO_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'},{EXPO_PUBLIC_SUPABASE_URL:'https://snabmkbeoshxxxhtwkyi.supabase.co'},{EXPO_PUBLIC_SUPABASE_URL:`https://user:password@${productionProjectRef}.supabase.co`},{EXPO_PUBLIC_SUPABASE_URL:`https://${productionProjectRef}.supabase.co/rest/v1`},{EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_placeholder'}])
    assert.throws(()=>guardProductionBackend({...environment,...patch}));
});
test('production export refuses fixture credentials even with correct backend',()=>{
  for(const name of ['DROPS_TEST_SERVICE_ROLE_KEY','DROPS_QA_CREDENTIALS_FILE','DROPS_QA_BROWSER_URL'])
    assert.throws(()=>guardProductionBackend({...environment,[name]:'private-placeholder'}),/forbids/);
});

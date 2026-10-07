import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBackend, productionProjectRef } from './project-env.mjs';

export function guardProductionBackend(env=process.env) {
  if (env.EXPO_NO_DOTENV !== '1') throw new Error('Production export must disable dotenv loading.');
  if (['DROPS_TEST_SERVICE_ROLE_KEY','DROPS_QA_CREDENTIALS_FILE','DROPS_QA_BROWSER_URL'].some(name=>env[name]))
    throw new Error('Production export forbids disposable QA credentials and fixture configuration.');
  const backend=validateBackend(env,'cloud');
  if (backend.url !== `https://${productionProjectRef}.supabase.co`)
    throw new Error('Production export requires the reviewed production Supabase project.');
  return {status:'passed',projectRef:productionProjectRef,origin:backend.url,asOf:new Date().toISOString(),scope:'validated export environment; no backend writes'};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const evidence=guardProductionBackend();
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/production-backend-verification.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(`Production backend guard passed for project ${evidence.projectRef}; no fixture writes.`);
}

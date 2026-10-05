import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const migrations=await readdir('supabase/migrations');
const manifest={createdAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),node:process.version,environment:process.env.EAS_BUILD_PROFILE||process.env.DROPS_ENV||'local',buildId:process.env.EAS_BUILD_ID||null,updateId:process.env.DROPS_UPDATE_ID||null,deploymentUrl:process.env.DROPS_DEPLOY_URL||null,runtimeFingerprint:process.env.DROPS_RUNTIME_FINGERPRINT||null,migrations:await Promise.all(migrations.map(async name=>({name,sha256:createHash('sha256').update(await readFile(`supabase/migrations/${name}`)).digest('hex')})))};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Wrote artifacts/release-manifest.json (no credentials).');

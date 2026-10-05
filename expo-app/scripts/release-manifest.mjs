import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const hash = value => createHash('sha256').update(value).digest('hex');
function identifier(value) { if (!value) return null; if (!/^[A-Za-z0-9_.-]{1,128}$/.test(value)) throw new Error('Invalid release evidence identifier.'); return value; }
async function hashFile(root, name) { try { return hash(await readFile(path.join(root,name))); } catch (e) { if (e.code==='ENOENT') return null; throw e; } }
export async function createReleaseManifest({root=process.cwd(),env=process.env,git}={}) {
  const source=git ?? {commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()};
  if (!/^[a-f0-9]{40,64}$/.test(source.commit)) throw new Error('Invalid release commit');
  const environment=identifier(env.EAS_BUILD_PROFILE||env.DROPS_ENV||'local');
  const names=(await readdir(path.join(root,'supabase/migrations'))).filter(name=>/^\d+_[A-Za-z0-9_-]+\.sql$/.test(name)).sort();
  let applied=null,validatedAt=null;
  if (env.DROPS_APPLIED_MIGRATIONS) {
    applied=JSON.parse(env.DROPS_APPLIED_MIGRATIONS); validatedAt=env.DROPS_MIGRATIONS_VALIDATED_AT;
    if (!Array.isArray(applied)||applied.some(name=>!names.includes(name))||!validatedAt||!Number.isFinite(Date.parse(validatedAt))) throw new Error('Applied migrations require a validated ledger timestamp and matching local filenames.');
  }
  const exports=[];
  try {
    for (const name of (await readdir(path.join(root,'artifacts/export-manifests'))).filter(name=>/^[A-Za-z0-9_-]+\.json$/.test(name)).sort()) {
      const bytes=await readFile(path.join(root,'artifacts/export-manifests',name));const metadata=JSON.parse(bytes);
      exports.push({name,sha256:hash(bytes),commit:/^[a-f0-9]{40,64}$/.test(metadata.commit??'')?metadata.commit:null,dirty:metadata.dirty===true,platform:identifier(metadata.platform),mode:identifier(metadata.mode),createdAt:Number.isFinite(Date.parse(metadata.createdAt))?metadata.createdAt:null});
    }
  } catch(e) { if(e.code!=='ENOENT') throw e; }
  const rollbackResult=env.DROPS_ROLLBACK_RESULT||'unrun';if(!['unrun','passed','failed'].includes(rollbackResult)) throw new Error('Rollback result must be unrun, passed or failed.');
  const validationResult=env.DROPS_VALIDATION_RESULT||'unrun';if(!['unrun','passed','failed'].includes(validationResult)) throw new Error('Validation result must be unrun, passed or failed.');
  let httpVerification=null;
  try {
    const bytes=await readFile(path.join(root,'artifacts/deployment-verification.json'));
    const probe=JSON.parse(bytes);
    httpVerification={sha256:hash(bytes),status:['passed','failed'].includes(probe.status)?probe.status:'unknown',asOf:Number.isFinite(Date.parse(probe.asOf))?probe.asOf:null,deploymentId:identifier(probe.deploymentId),matchesDeployment:Boolean(env.DROPS_DEPLOY_ID&&probe.deploymentId===env.DROPS_DEPLOY_ID)};
  } catch(e) { if(e.code!=='ENOENT') throw e; }
  let backendVerification=null;
  try {
    const bytes=await readFile(path.join(root,'artifacts/production-backend-verification.json'));
    const proof=JSON.parse(bytes);
    backendVerification={sha256:hash(bytes),status:proof.status==='passed'?'passed':'unknown',projectRef:identifier(proof.projectRef),asOf:Number.isFinite(Date.parse(proof.asOf))?proof.asOf:null,scope:'validated environment; no database writes or deployed-bundle identity proof'};
  } catch(e) { if(e.code!=='ENOENT') throw e; }
  const deploymentUrl=env.DROPS_DEPLOY_URL?new URL(env.DROPS_DEPLOY_URL):null;
  if(deploymentUrl&&(deploymentUrl.protocol!=='https:'||deploymentUrl.username||deploymentUrl.password||deploymentUrl.search||deploymentUrl.hash||deploymentUrl.pathname!=='/'))throw new Error('Manifest deployment URL must be a clean HTTPS origin.');
  return {createdAt:new Date().toISOString(),commit:source.commit,commitSha256:hash(source.commit),dirty:source.dirty,node:process.version,environment,environmentSha256:hash(environment),lockfileSha256:await hashFile(root,'package-lock.json'),appConfigSha256:await hashFile(root,'app.json'),easConfigSha256:await hashFile(root,'eas.json'),exportManifests:exports,
    buildId:identifier(env.EAS_BUILD_ID),iosBuildId:identifier(env.DROPS_IOS_BUILD_ID),androidBuildId:identifier(env.DROPS_ANDROID_BUILD_ID),updateId:identifier(env.DROPS_UPDATE_ID),deploymentId:identifier(env.DROPS_DEPLOY_ID),deploymentUrl:deploymentUrl?.href??null,runtimeFingerprint:identifier(env.DROPS_RUNTIME_FINGERPRINT),iosFingerprint:identifier(env.DROPS_IOS_FINGERPRINT),androidFingerprint:identifier(env.DROPS_ANDROID_FINGERPRINT),
    verification:{validation:validationResult,http:httpVerification,backend:backendVerification,limitations:['Validation covers only the executed gates; installed-device and authenticated-cloud evidence remain separate artifacts.']},
    rollback:{result:rollbackResult,previousDeploymentId:identifier(env.DROPS_PREVIOUS_DEPLOYMENT_ID),previousUpdateId:identifier(env.DROPS_PREVIOUS_UPDATE_ID),previousIosBuildId:identifier(env.DROPS_PREVIOUS_IOS_BUILD_ID),previousAndroidBuildId:identifier(env.DROPS_PREVIOUS_ANDROID_BUILD_ID),previousRuntime:identifier(env.DROPS_PREVIOUS_RUNTIME),channel:identifier(env.DROPS_ROLLBACK_CHANNEL)},
    migrationLedger:{source:applied?'operator-verified-input':'unknown',validatedAt:validatedAt??null},migrations:await Promise.all(names.map(async name=>({name,sha256:await hashFile(root,`supabase/migrations/${name}`),applied:applied?applied.includes(name):'unknown'})))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const manifest=await createReleaseManifest();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Wrote artifacts/release-manifest.json (allowlisted metadata, no credentials).');
}

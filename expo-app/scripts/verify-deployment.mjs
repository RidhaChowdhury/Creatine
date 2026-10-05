import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const routes=['/','/history','/supps','/metrics','/settings','/reset-password'];
class ProbeError extends Error { constructor(code) {super(code);this.code=code;} }
export function guardDeploymentUrl(value,env={}) {
  if(env.DROPS_DEPLOY_ID&&!/^[a-z0-9]{6,64}$/i.test(env.DROPS_DEPLOY_ID))throw new ProbeError('invalid-deployment-id');
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new ProbeError('unclean-deployment-origin');
  if(['localhost','127.0.0.1'].includes(url.hostname)) {
    if(env.DROPS_ALLOW_LOOPBACK_VERIFICATION!=='1'||!['http:','https:'].includes(url.protocol)||!['4173','4174'].includes(url.port))throw new ProbeError('explicit-loopback-opt-in-required');
  } else {
    const match=/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?--([a-z0-9]{6,64})\.expo\.app$/i.exec(url.hostname);
    if(url.protocol!=='https:'||url.port||!match)throw new ProbeError('immutable-expo-deployment-required');
    if(env.DROPS_DEPLOY_ID&&match[1]!==env.DROPS_DEPLOY_ID)throw new ProbeError('deployment-id-mismatch');
  }
  return url;
}
export async function verifyDeployment({target,env=process.env,fetchImpl=fetch}={}) {
  const base=guardDeploymentUrl(target,env),checks=[],scripts=new Set(),fonts=new Set();
  const evidence={asOf:new Date().toISOString(),target:base.href,deploymentId:env.DROPS_DEPLOY_ID??null,status:'failed',checks,limitations:['HTTP/asset probes do not establish login, account isolation, persistence, native behavior or rollback execution']};
  async function probe(input,kind) {
    let url=new URL(input,base),response;
    if(url.origin!==base.origin||url.username||url.password||url.search||url.hash)throw new ProbeError('cross-origin-or-unclean-asset');
    for(let redirect=0;redirect<=3;redirect++) {
      response=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
      if(response.status>=300&&response.status<400) {
        const location=response.headers.get('location');if(!location)throw new ProbeError('redirect-without-location');
        const next=new URL(location,url);if(next.origin!==base.origin||next.search||next.hash||next.username||next.password)throw new ProbeError('cross-origin-redirect');
        url=next;if(redirect===3)throw new ProbeError('too-many-redirects');continue;
      }break;
    }
    if(!response.ok)throw new ProbeError(`http-${kind}-failed`);
    if(response.headers.get('x-content-type-options')!=='nosniff')throw new ProbeError(`nosniff-${kind}-missing`);
    const contentType=(response.headers.get('content-type')??'').split(';')[0].trim(),bytes=Buffer.from(await response.arrayBuffer());
    if(kind==='html') {
      if(!contentType.includes('text/html')||!/<html\b/i.test(bytes.toString()))throw new ProbeError('html-body-or-mime-invalid');
      if(response.headers.get('cross-origin-opener-policy')!=='same-origin'||response.headers.get('cross-origin-embedder-policy')!=='require-corp')throw new ProbeError('html-isolation-headers-missing');
    }
    if(kind==='script'&&!/(?:javascript|ecmascript)/i.test(contentType))throw new ProbeError('script-mime-invalid');
    if(kind==='wasm'&&(!contentType.includes('application/wasm')||bytes.subarray(0,4).toString('hex')!=='0061736d'))throw new ProbeError('wasm-body-or-mime-invalid');
    if(kind==='font'&&!['00010000','4f54544f','774f4646','774f4632'].includes(bytes.subarray(0,4).toString('hex')))throw new ProbeError('font-body-invalid');
    checks.push({kind,requestedPath:new URL(input,base).pathname,path:url.pathname,status:response.status,contentType,sha256:createHash('sha256').update(bytes).digest('hex'),nosniff:true});return bytes;
  }
  try {
    for(const route of routes) {const body=(await probe(route,'html')).toString();for(const match of body.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi))scripts.add(match[1]);}
    if(!scripts.size||scripts.size>20)throw new ProbeError('script-reference-count-invalid');
    for(const script of scripts) {const body=(await probe(script,'script')).toString();for(const match of body.matchAll(/["']((?:\/|\.\/)?assets\/[^"'\s]+\.(?:ttf|otf|woff2?))["']/gi))fonts.add(match[1]);}
    if(!fonts.size||fonts.size>30)throw new ProbeError('font-reference-count-invalid');
    for(const font of fonts)await probe(font,'font');await probe('/canvaskit.wasm','wasm');evidence.status='passed';
  } catch(e) {evidence.failureCode=e instanceof ProbeError?e.code:'network-or-unexpected-failure';}
  return evidence;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let evidence;try {evidence=await verifyDeployment({target:process.argv[2]||process.env.DROPS_DEPLOY_URL});}catch(e) {evidence={asOf:new Date().toISOString(),status:'failed',failureCode:e instanceof ProbeError?e.code:'invalid-target',checks:[]};}
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/deployment-verification.json',JSON.stringify(evidence,null,2)+'\n');console.log(`Deployment HTTP/asset verification ${evidence.status}. See safe JSON evidence.`);if(evidence.status!=='passed')process.exitCode=1;
}

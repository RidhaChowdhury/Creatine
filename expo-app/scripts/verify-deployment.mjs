const target=process.argv[2]||process.env.DROPS_DEPLOY_URL;
if(!target)throw new Error('Supply the immutable deployment URL.');
const base=new URL(target);
if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw new Error('Remote deployment must use HTTPS.');
for(const path of ['/','/history','/metrics','/reset-password','/canvaskit.wasm']){
 const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
 if(!path.endsWith('.wasm')) { for(const [key,value]of [['cross-origin-opener-policy','same-origin'],['cross-origin-embedder-policy','require-corp']])if(r.headers.get(key)!==value)throw new Error(`${path}: missing ${key}: ${value}`); }
 else if(!r.headers.get('content-type')?.includes('application/wasm'))throw new Error('CanvasKit must be served as application/wasm.');
 console.log(`PASS ${path}`);
}

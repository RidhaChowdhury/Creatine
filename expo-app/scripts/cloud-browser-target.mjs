// Dependency-free guard so CI validates dispatch input before secrets/installations.
export function guardCloudBrowserUrl(value,{allowPreview=true}={}){
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Use a clean immutable test deployment origin.');
  const match=/^drops-ridha--([a-z0-9]{6,64})\.expo\.app$/i.exec(url.hostname);
  const alias=match&&/^(production|prod|preview|staging|development|latest|main)$/i.test(match[1]);
  const deployed=url.protocol==='https:'&&!url.port&&match&&!alias;
  const preview=allowPreview&&url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port==='4174';
  if(!deployed&&!preview)throw new Error('Cloud browser QA requires an immutable drops-ridha--deploymentId.expo.app test origin; other hosting projects, aliases and production origins are refused. Local QA may use 127.0.0.1:4174.');
  return url.href;
}
export function assertCloudBrowserRequest(value,{deploymentUrl,resourceType='other'}={}){
  const deployment=new URL(guardCloudBrowserUrl(deploymentUrl)),url=new URL(value);
  const apiOrigin='https://snabmkbeoshxxxhtwkyi.supabase.co';
  if(url.username||url.password)throw new Error('Credential-bearing network destination refused.');
  if(['http:','https:'].includes(url.protocol)&&(url.origin===deployment.origin||url.origin===apiOrigin))return url;
  if(url.protocol==='wss:'&&url.origin==='wss://snabmkbeoshxxxhtwkyi.supabase.co')return url;
  if(url.protocol==='data:'&&['image','font','media'].includes(resourceType))return url;
  // Blob workers/assets must have been created by this exact deployment origin.
  if(url.protocol==='blob:'&&url.origin===deployment.origin&&['script','worker','other','image','font','media'].includes(resourceType))return url;
  throw new Error('Browser network destination is outside the deployment and Drops Test API allowlist.');
}

// Node-only CI gate. Admin credentials never enter Expo builds or browser inputs.
import { mkdtemp,writeFile,unlink,rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guardCloudQa,testConfiguration,provisionQaAccounts,runCloudQa,resetQaAccountState,runAccountDeletionQa } from './cloud-qa.mjs';
import { guardCloudBrowserUrl,runCloudBrowserQa } from './cloud-browser-qa.mjs';

export async function runCloudCiQa({url,key,privateKey,browserUrl,verifyDeletion=true}){
  guardCloudQa(url,[],0);guardCloudBrowserUrl(browserUrl);
  if(!privateKey)throw new Error('Cloud QA needs DROPS_TEST_SERVICE_ROLE_KEY as a private CI environment secret for Drops Test only. Configure it in the protected QA job; never use EXPO_PUBLIC_ or a source file.');
  const fixture=await provisionQaAccounts({url,privateKey});
  let directory,credentialsFile;
  const sanitize=value=>fixture.users.reduce((text,user)=>[user.id,user.email,user.password].reduce((out,secret)=>out.split(secret).join('[redacted]'),text),String(value).split(privateKey).join('[redacted admin key]')).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted token]');
  try{
    const rpc=await runCloudQa({url,key,users:fixture.users});
    await resetQaAccountState({url,key,users:fixture.users});
    directory=await mkdtemp(join(tmpdir(),'drops-cloud-ci-'));
    credentialsFile=join(directory,'accounts.json');
    // Browser receives identities only. It never receives the admin key.
    await writeFile(credentialsFile,JSON.stringify(fixture.users.map(({id,email,password})=>({id,email,password}))),{mode:0o600});
    const browser=await runCloudBrowserQa({url:browserUrl,credentialsFile,configuration:{url,key}});
    let deletion;
    if(verifyDeletion){await resetQaAccountState({url,key,users:fixture.users});deletion=await runAccountDeletionQa({url,key,users:fixture.users});}
    return {project:rpc.project,asOf:new Date().toISOString(),rpc:rpc.passed,browser:browser.passed,deletion:deletion?.passed};
  }catch(error){throw new Error(sanitize(error.message));}
  finally{
    try{await fixture.cleanup();}
    finally{if(credentialsFile)await unlink(credentialsFile);if(directory)await rmdir(directory);}
  }
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(!process.env.DROPS_TEST_SERVICE_ROLE_KEY)throw new Error('Configure DROPS_TEST_SERVICE_ROLE_KEY as a private, protected test-only CI secret before running cloud QA. This credential is an operational prerequisite; do not commit it or prefix it EXPO_PUBLIC_.');
    if(!process.env.DROPS_QA_BROWSER_URL)throw new Error('Set DROPS_QA_BROWSER_URL to the immutable Drops Test .expo.app deployment URL.');
    const configuration=process.env.EXPO_PUBLIC_SUPABASE_URL ? {url:process.env.EXPO_PUBLIC_SUPABASE_URL,key:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}:await testConfiguration();
    const result=await runCloudCiQa({...configuration,privateKey:process.env.DROPS_TEST_SERVICE_ROLE_KEY,browserUrl:process.env.DROPS_QA_BROWSER_URL});
    console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

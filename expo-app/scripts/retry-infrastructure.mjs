// Bounded retries for dependency installation and read-only package metadata only.
import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const maximumAttempts=3;
const backoffMs=[1000,3000];
export function isTemporaryInfrastructureFailure(output){
  const text=String(output).replace(/\u001b\[[0-9;]*m/g,'');
  // Deterministic failures take precedence even if logs also mention a network error.
  if(/\b(?:E401|E403|ERESOLVE|EINTEGRITY|ENOENT|EACCES|EPERM|ERR_MODULE_NOT_FOUND)\b|\b(?:unauthorized|unauthenticated|forbidden|invalid (?:api ?key|jwt|token)|permission denied|syntaxerror|typeerror|check_violation)\b|\bHTTP(?:\/\d(?:\.\d)?)?\s+(?:401|403|404)\b|\berror TS\d+\b|\b(?:tests?|test suites?):[^\n]*\bfailed\b|^\s*FAIL\s|(?:missing|required|invalid) (?:required )?(?:environment|configuration|credentials)|(?:schema|migration|typecheck|assertion) (?:error|failed|failure)/im.test(text))return false;
  return /\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|E502|E503|E504)\b|\bHTTP(?:\/\d(?:\.\d)?)?\s+(?:(?:error|status)\s*[:=]?\s*)?(?:502|503|504)\b|\b(?:status(?: code)?|response code|server returned code|requested URL returned error)\s*[:=]?\s*(?:502|503|504)\b/i.test(text);
}
export function assertInfrastructureCommand(command,args){
  const executable=basename(command).toLowerCase().replace(/\.(?:cmd|exe)$/,'');
  const approved=(executable==='npm'&&args[0]==='ci')||
    (executable==='npm'&&args[0]==='view')||
    (executable==='npx'&&args[0]==='playwright'&&args[1]==='install');
  if(!approved)throw new Error('Retry helper accepts only npm ci, npm view, or npx playwright install. Never wrap tests, deployments, migrations, publishing or fixture writes.');
  if([command,...args].some(value=>/[\r\n&|<>^%!"`]/.test(value)||/sb_secret_|eyJ[A-Za-z0-9_-]+\.|https?:\/\/[^/\s]+@|(?:api[_-]?key|password|token|secret|authorization)(?:=|:)|^--(?:key|token|password|secret|auth)/i.test(value)))throw new Error('Pass only literal, non-secret command arguments; authentication belongs in the CI environment.');
}
function execute(command,args){
  return new Promise(resolve=>{
    let output='';
    const child=spawn(command,args,{shell:process.platform==='win32',stdio:['inherit','pipe','pipe']});
    const collect=(stream,chunk)=>{stream.write(chunk);output=(output+chunk.toString()).slice(-65536);};
    child.stdout.on('data',chunk=>collect(process.stdout,chunk));
    child.stderr.on('data',chunk=>collect(process.stderr,chunk));
    child.on('error',error=>{process.stderr.write(`Infrastructure command could not start (${error.code??'unknown'}).\n`);resolve({code:1,output:error.code??'',signal:null});});
    child.on('close',(code,signal)=>resolve({code:code??1,output,signal}));
  });
}
export async function runInfrastructureCommand(command,args,{attempt=execute,sleep=delay,notify=message=>process.stderr.write(message+'\n')}={}){
  assertInfrastructureCommand(command,args);
  for(let number=1;number<=maximumAttempts;number++){
    const result=await attempt(command,args);
    if(result.code===0||result.signal||number===maximumAttempts||!isTemporaryInfrastructureFailure(result.output))return {...result,attempts:number};
    const wait=backoffMs[number-1];
    // Do not echo arguments or the environment, which can contain CI credentials.
    notify(`Temporary infrastructure failure; retry ${number+1}/${maximumAttempts} after ${wait}ms.`);
    await sleep(wait);
  }
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const input=process.argv.slice(2);if(input[0]==='--')input.shift();
    if(!input.length)throw new Error('Usage: node scripts/retry-infrastructure.mjs -- npm ci');
    const result=await runInfrastructureCommand(input[0],input.slice(1));process.exitCode=result.code;
  }catch(error){console.error(error.message);process.exitCode=1;}
}

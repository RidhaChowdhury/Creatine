import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { mkdir, readdir, copyFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve, relative, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadEnvironment, buildEnvironment, projectRoot } from './project-env.mjs';
const [platform='web', mode='local', output=platform==='web'?'dist-pitwall':'dist-native'] = process.argv.slice(2);
if(!['web','native'].includes(platform))throw new Error('Export platform must be web or native.');
if(mode==='phone-preview' && platform!=='web')throw new Error('The account-free phone preview is a web-only export.');
const env = mode==='phone-preview'
  ? { ...loadEnvironment('local'), EXPO_PUBLIC_DROPS_PHONE_PREVIEW: '1' }
  : mode==='preview' ? buildEnvironment('test',process.env,process.env) : mode==='production' ? buildEnvironment('cloud',process.env,process.env) : loadEnvironment(mode);
const require=createRequire(import.meta.url);
const destination = resolve(projectRoot, output);
if (!destination.startsWith(projectRoot + sep)) throw new Error('Exports must stay inside the app workspace.');
const staging = join(projectRoot, 'artifacts', 'exports', randomUUID());
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], {encoding:'utf8'}).trim());
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'export',
  ...(platform === 'native' ? ['--platform','ios','--platform','android'] : ['--platform','web']),
  '--max-workers','1','--output-dir',staging], {cwd:projectRoot,env,stdio:'inherit'});
const [code] = await once(child, 'exit');
if (code !== 0) process.exitCode = code ?? 1;
else {
  const files = await readdir(staging, {recursive:true,withFileTypes:true});
  // Install hashed assets first, then replace HTML atomically. Keep old hashed
  // files available for tabs that are still open on the preceding preview.
  files.sort((a,b) => Number(a.name.endsWith('.html')) - Number(b.name.endsWith('.html')));
  for (const file of files) {
    if (!file.isFile()) continue;
    const source = join(file.parentPath, file.name);
    const target = join(destination, relative(staging, source));
    await mkdir(dirname(target), {recursive:true});
    const pending = `${target}.pending`;
    await copyFile(source, pending); await rename(pending, target);
  }
  await mkdir(join(projectRoot, 'artifacts', 'export-manifests'), {recursive:true});
  await writeFile(join(projectRoot,'artifacts','export-manifests',`${output.replace(/[^a-z0-9-]/gi,'_')}.json`),
    JSON.stringify({commit,dirty,platform,mode,output,createdAt:new Date().toISOString()},null,2));
  console.log(`Published complete export to ${output}; existing preview remained available during compilation.`);
}

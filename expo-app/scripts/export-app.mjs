import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadEnvironment, buildEnvironment, projectRoot } from './project-env.mjs';
const [platform='web', mode='local', output=platform==='web'?'dist-pitwall':'dist-native'] = process.argv.slice(2);
if(!['web','native'].includes(platform))throw new Error('Export platform must be web or native.');
const env = mode==='preview' ? buildEnvironment('test',process.env,process.env) : mode==='production' ? buildEnvironment('cloud',process.env,process.env) : loadEnvironment(mode);
const require=createRequire(import.meta.url);
const child=spawn(process.execPath,[require.resolve('expo/bin/cli'),'export',...(platform==='native'?['--platform','ios','--platform','android']:['--platform','web']),'--max-workers','1','--output-dir',output],{cwd:projectRoot,env,stdio:'inherit'});
child.on('exit',code=>process.exitCode=code??1);

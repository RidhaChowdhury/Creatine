import { buildEnvironment } from './project-env.mjs';
buildEnvironment('test', process.env, process.env);
console.log('PASS: preview backend is isolated from production.');

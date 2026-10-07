import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Expo 54.0.37 revokes the isolated worker's bootstrap blob before WebKit loads it.
// Keep this compatibility patch pinned; review upstream before updating Expo.
export const supportedExpoVersion = '54.0.37';

export function createBlobWorker(content, options, WorkerConstructor, urlApi, BlobConstructor) {
  const blobUrl = urlApi.createObjectURL(new BlobConstructor([content], { type: 'text/javascript' }));
  let worker;
  try {
    worker = new WorkerConstructor(blobUrl, options);
  } catch (error) {
    urlApi.revokeObjectURL(blobUrl);
    throw error;
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    urlApi.revokeObjectURL(blobUrl);
    worker.removeEventListener('message', release);
    worker.removeEventListener('error', release);
  };
  worker.addEventListener('message', release);
  worker.addEventListener('error', release);
  const terminate = worker.terminate;
  worker.terminate = function (...args) {
    try { return terminate.apply(this, args); }
    finally { release(); }
  };
  return worker;
}

const original = `    try {
      const content = makeWorkerContent(workerUrl);
      workerUrl = URL.createObjectURL(new Blob([content], { type: 'text/javascript' }));
      return new Worker(workerUrl, workerOpts);
    } finally {
      URL.revokeObjectURL(workerUrl);
    }`;
const replacement = `    // Drops: retain the Expo 54 bootstrap blob until WebKit has loaded it.
    const content = makeWorkerContent(workerUrl);
    return (${createBlobWorker.toString().replace(/\r\n/g, '\n')})(content, workerOpts, Worker, URL, Blob);`;

export function patchWorkerSource(source, version) {
  if (version !== supportedExpoVersion) {
    throw new Error(`Drops worker patch supports Expo ${supportedExpoVersion}; found ${version}. Review upstream worker lifecycle before updating this patch.`);
  }
  const normalized = source.replace(/\r\n/g, '\n');
  if (normalized.split(replacement).length === 2 && !normalized.includes(original)) return source;
  if (normalized.split(original).length !== 2) {
    throw new Error('Drops worker patch: unexpected Expo asyncRequireModule.ts source. Review upstream worker lifecycle; no files changed.');
  }
  const patched = normalized.replace(original, replacement);
  return source.includes('\r\n') ? patched.replace(/\n/g, '\r\n') : patched;
}

export async function patchInstalledExpo() {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve('expo/package.json');
  const { version } = JSON.parse(await readFile(packagePath, 'utf8'));
  // Check compatibility before reading a source path that a newer Expo may move.
  if (version !== supportedExpoVersion) patchWorkerSource('', version);
  const sourcePath = join(dirname(packagePath), 'src', 'async-require', 'asyncRequireModule.ts');
  const source = await readFile(sourcePath, 'utf8');
  const patched = patchWorkerSource(source, version);
  if (patched !== source) await writeFile(sourcePath, patched);
  console.log(`Drops: Expo ${version} worker blob lifecycle patch ${patched === source ? 'already applied' : 'applied'}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await patchInstalledExpo();
}

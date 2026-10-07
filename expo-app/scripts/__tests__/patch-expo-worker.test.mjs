import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createBlobWorker, patchWorkerSource, supportedExpoVersion } from '../patch-expo-worker.mjs';

function fixture({ failConstruct = false, failTerminate = false } = {}) {
  const revoked = [], created = [], options = { name: 'sqlite-worker' };
  class MockWorker extends EventTarget {
    constructor(url, receivedOptions) {
      super();
      if (failConstruct) throw new Error('constructor failed');
      this.url = url; this.options = receivedOptions; this.terminations = 0;
    }
    terminate() {
      this.terminations++;
      if (failTerminate) throw new Error('terminate failed');
      return 'terminated';
    }
  }
  const urlApi = { createObjectURL(blob) { created.push(blob); return 'blob:sqlite-test'; }, revokeObjectURL(url) { revoked.push(url); } };
  return { revoked, created, options, construct: () => createBlobWorker('importScripts("sqlite.js")', options, MockWorker, urlApi, Blob) };
}

test('bootstrap URL stays valid during construction and until the first message', async () => {
  const f = fixture(), worker = f.construct();
  assert.equal(worker.url, 'blob:sqlite-test'); assert.equal(worker.options, f.options);
  assert.deepEqual(f.revoked, []);
  assert.equal(f.created[0].type, 'text/javascript');
  assert.equal(await f.created[0].text(), 'importScripts("sqlite.js")');
  worker.dispatchEvent(new Event('message'));
  assert.deepEqual(f.revoked, ['blob:sqlite-test']);
  worker.dispatchEvent(new Event('error'));
  assert.equal(worker.terminate(), 'terminated');
  assert.equal(worker.terminations, 1); assert.equal(f.revoked.length, 1);
});

test('first error releases bootstrap exactly once', () => {
  const f = fixture(), worker = f.construct();
  worker.dispatchEvent(new Event('error')); worker.dispatchEvent(new Event('message')); worker.terminate();
  assert.deepEqual(f.revoked, ['blob:sqlite-test']);
});

test('termination releases a worker that has never sent an event, including termination failure', () => {
  for (const failTerminate of [false, true]) {
    const f = fixture({ failTerminate }), worker = f.construct();
    if (failTerminate) assert.throws(() => worker.terminate(), /terminate failed/);
    else worker.terminate();
    assert.equal(worker.terminations, 1); assert.deepEqual(f.revoked, ['blob:sqlite-test']);
  }
});

test('constructor failure releases the newly created blob and preserves error', () => {
  const f = fixture({ failConstruct: true });
  assert.throws(f.construct, /constructor failed/);
  assert.deepEqual(f.revoked, ['blob:sqlite-test']);
});

test('installed pinned source patches idempotently and preserves direct worker and bootstrap imports', async () => {
  const require = createRequire(import.meta.url);
  const source = await readFile(require.resolve('expo/src/async-require/asyncRequireModule.ts'), 'utf8');
  const patched = patchWorkerSource(source, supportedExpoVersion);
  assert.equal(patchWorkerSource(patched, supportedExpoVersion), patched);
  assert.match(patched.replace(/\r\n/g, '\n'), /\} else \{\n    return new Worker\(workerUrl, workerOpts\);\n  \}/);
  assert.match(patched, /makeWorkerContent\(workerUrl\)/);
  assert.throws(() => patchWorkerSource(source, '55.0.0'), /Review upstream/);
  assert.throws(() => patchWorkerSource('unexpected upstream source', supportedExpoVersion), /no files changed/);
});

test('fresh upstream block patches into working isolated lifecycle while direct workers bypass blobs', () => {
  const original = `(function(workerUrl, workerOpts) {
  if (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
    try {
      const content = makeWorkerContent(workerUrl);
      workerUrl = URL.createObjectURL(new Blob([content], { type: 'text/javascript' }));
      return new Worker(workerUrl, workerOpts);
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
  } else {
    return new Worker(workerUrl, workerOpts);
  }
})`;
  const patched = patchWorkerSource(original, supportedExpoVersion);
  assert.notEqual(patched, original);
  assert.equal(patchWorkerSource(patched, supportedExpoVersion), patched);
  const windowsSource = original.replace(/\n/g, '\r\n');
  const windowsPatched = patchWorkerSource(windowsSource, supportedExpoVersion);
  assert.equal(windowsPatched.replace(/\r\n/g, '\n'), patched);
  assert.equal(patchWorkerSource(windowsPatched, supportedExpoVersion), windowsPatched);
  assert.equal(windowsPatched.replace(/\r\n/g, '').includes('\n'), false);
  for (const isolated of [true, false]) {
    const revoked = [], created = [], options = { name: 'sqlite' };
    class Worker extends EventTarget {
      constructor(url, opts) { super(); this.url = url; this.options = opts; }
      terminate() {}
    }
    const construct = runInNewContext(patched, { crossOriginIsolated: isolated, Worker, Blob,
      makeWorkerContent: url => `importScripts(${JSON.stringify(url)})`,
      URL: { createObjectURL(blob) { created.push(blob); return 'blob:fresh'; }, revokeObjectURL(url) { revoked.push(url); } },
    });
    const worker = construct('https://preview.expo.app/sqlite.js', options);
    assert.equal(worker.options, options);
    assert.deepEqual(revoked, []);
    assert.equal(worker.url, isolated ? 'blob:fresh' : 'https://preview.expo.app/sqlite.js');
    assert.equal(created.length, isolated ? 1 : 0);
    worker.dispatchEvent(new Event('message')); worker.terminate();
    assert.deepEqual(revoked, isolated ? ['blob:fresh'] : []);
  }
});

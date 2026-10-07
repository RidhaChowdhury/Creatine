import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { guardPhonePreview, guardPhoneRequest, assessPhoneCapabilities, guardQaProfileCleanup, trackPendingPhoneRequests } from '../phone-preview-qa.mjs';
const origin = 'https://drops-ridha--abc12345.expo.app/';
test('phone QA accepts only an explicit Drops immutable HTTPS origin', () => {
  assert.equal(guardPhonePreview(origin).origin, origin.slice(0, -1));
  for (const value of ['http://localhost:8082/', 'http://192.168.1.22:8082/', 'https://unrelated--abc12345.expo.app/', 'https://drops-ridha.expo.app/', 'https://drops-ridha--production.expo.app/', origin + 'history', origin + '?secret=x', 'https://user:pass@drops-ridha--abc12345.expo.app/', 'https://drops-ridha--abc12345.expo.app:8443/']) assert.throws(() => guardPhonePreview(value));
});
test('phone QA outbound guard refuses Supabase, sockets and cross-origin assets', () => {
  for (const value of [origin + 'canvaskit.wasm', 'blob:' + origin + 'worker']) assert.equal(guardPhoneRequest(value, origin, 'script'), true);
  assert.equal(guardPhoneRequest('data:image/png;base64,AAAA', origin, 'image'), true);
  for (const value of ['https://snabmkbeoshxxxhtwkyi.supabase.co/auth/v1/token', 'https://xmkdzdqouxqmayoawztr.supabase.co/', 'https://attacker.example/asset.js', 'wss://drops-ridha--abc12345.expo.app/socket', 'blob:https://attacker.example/worker', 'data:text/javascript,alert(1)', 'http://localhost:8082/']) assert.throws(() => guardPhoneRequest(value, origin, 'script'));
});
test('storage/isolation stay required and only WebKit SAB absence is reported separately', () => {
  const good = { secureContext: true, isolated: true, opfs: true, sharedArrayBuffer: true };
  assert.equal(assessPhoneCapabilities('chromium', good).status, 'passed');
  const noSAB = { ...good, sharedArrayBuffer: false };
  assert.throws(() => assessPhoneCapabilities('chromium', noSAB));
  assert.equal(assessPhoneCapabilities('webkit', noSAB).status, 'unsupported');
  for (const key of ['secureContext', 'isolated', 'opfs']) assert.throws(() => assessPhoneCapabilities('webkit', { ...noSAB, [key]: false }));
});
test('profile cleanup permits only the freshly created WebKit directory inside owned artifacts', () => {
  const root = path.resolve('artifacts/phone-preview/profiles'), fresh = path.join(root, 'webkit-Ab12Cd');
  assert.equal(guardQaProfileCleanup(fresh, root, fresh), fresh);
  for (const bad of [root, path.join(root, '..', 'webkit-Ab12Cd'), path.join(root + '-other', 'webkit-Ab12Cd'), path.join(root, 'unrelated-Ab12Cd'), path.join(root, 'webkit-Zz99Aa')]) assert.throws(() => guardQaProfileCleanup(bad, root, fresh));
});

test('asset readiness tracks concurrent requests until each finishes or fails', () => {
  const page = new EventEmitter(), count = trackPendingPhoneRequests(page);
  const fontA = {}, fontB = {}, wasm = {};
  page.emit('request', fontA); page.emit('request', fontB); page.emit('request', wasm);
  assert.equal(count(), 3);
  page.emit('requestfinished', fontA); page.emit('requestfinished', fontA);
  assert.equal(count(), 2, 'duplicate completion must not hide another outstanding font');
  page.emit('requestfailed', wasm);
  assert.equal(count(), 1);
  page.emit('requestfinished', fontB);
  assert.equal(count(), 0);
});

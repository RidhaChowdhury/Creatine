import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardPhonePreview, guardPhoneRequest, assessPhoneCapabilities } from '../phone-preview-qa.mjs';
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

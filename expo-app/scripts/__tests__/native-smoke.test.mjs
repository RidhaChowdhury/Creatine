import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateApkUrl, isSafeScreenshot, readSafeCheckpoints } from '../native-smoke.mjs';
test('APK input accepts only exact Expo EAS HTTPS APK paths', () => {
  assert.equal(validateApkUrl('https://expo.dev/artifacts/eas/Build_1-Abc.apk'), 'https://expo.dev/artifacts/eas/Build_1-Abc.apk');
  for (const bad of ['http://expo.dev/artifacts/eas/a.apk', 'https://expo.dev.evil/artifacts/eas/a.apk', 'https://expo.dev@evil/artifacts/eas/a.apk', 'https://expo.dev/artifacts/eas/../a.apk', 'https://expo.dev/artifacts/eas/a.apk?token=x', 'https://expo.dev/artifacts/eas/a.apk#x', 'https://expo.dev/artifacts/eas/a.apk\n', 'https://expo.dev/artifacts/eas/a.apk;echo bad', 'https://expo.dev:443/artifacts/eas/a.apk', 'https://expo.dev/artifacts/eas/a.zip']) assert.throws(() => validateApkUrl(bad));
});
test('artifact filter rejects raw reports and automatic/login screenshots', () => {
  assert.equal(isSafeScreenshot('/temporary/raw-results/evidence/history-after-relaunch.png'), true);
  for (const file of ['commands.json','maestro.log','report.xml','login.png','failure.png','screenshot-1.png','history-after-relaunch.png.txt']) assert.equal(isSafeScreenshot(file), false);
});
test('checkpoint diagnostics retain only executed fixed labels, never private log content', () => {
  const raw = 'private email/password/token\ncommand evalScript DROPS_QA_CHECKPOINT::home-ready\nJsConsole: DROPS_QA_CHECKPOINT::login-visible\nJsConsole: DROPS_QA_CHECKPOINT::name-entered secret\nJsConsole: DROPS_QA_CHECKPOINT::name-entered\nJsConsole: DROPS_QA_CHECKPOINT::password-secret\nJsConsole: DROPS_QA_CHECKPOINT::home-ready-malicious\n';
  assert.deepEqual(readSafeCheckpoints(raw), ['login-visible', 'name-entered']);
  assert.deepEqual(readSafeCheckpoints('secret token'), []);
});

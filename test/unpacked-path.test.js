const test = require('node:test');
const assert = require('node:assert');
const { unpackedScriptPath } = require('../src/main/hooks-installer');

test('rewrites a packaged Windows asar path to the unpacked location', () => {
  const p = 'C:\\Users\\me\\AppData\\Local\\Programs\\Claude Notch\\resources\\app.asar\\hooks\\notify.js';
  assert.equal(
    unpackedScriptPath(p),
    'C:\\Users\\me\\AppData\\Local\\Programs\\Claude Notch\\resources\\app.asar.unpacked\\hooks\\notify.js',
  );
});

test('rewrites a packaged POSIX asar path', () => {
  const p = '/opt/Claude Notch/resources/app.asar/hooks/notify.js';
  assert.equal(unpackedScriptPath(p), '/opt/Claude Notch/resources/app.asar.unpacked/hooks/notify.js');
});

test('leaves a source (non-asar) path unchanged', () => {
  const p = 'C:\\Users\\me\\Desktop\\claude-notch\\hooks\\notify.js';
  assert.equal(unpackedScriptPath(p), p);
});

test('only rewrites app.asar followed by a separator', () => {
  const p = '/home/me/app.asarchive/hooks/notify.js';
  assert.equal(unpackedScriptPath(p), p);
});

// test/settings-store.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_SETTINGS, mergeWithDefaults, loadSettings, saveSettings, deepMerge } = require('../src/main/settings-store');

test('DEFAULT_SETTINGS has expected sections and port', () => {
  assert.equal(DEFAULT_SETTINGS.connection.port, 4317);
  assert.equal(DEFAULT_SETTINGS.general.language, 'ja');
  assert.equal(DEFAULT_SETTINGS.notifications.durationMs, 2500);
  assert.equal(DEFAULT_SETTINGS.appearance.preset, 'top-center');
});

test('mergeWithDefaults overlays partial and keeps defaults', () => {
  const merged = mergeWithDefaults({ connection: { port: 5000 } });
  assert.equal(merged.connection.port, 5000);
  assert.equal(merged.general.theme, 'system'); // untouched default
});

test('loadSettings returns defaults clone when file missing', () => {
  const p = path.join(os.tmpdir(), `cn-missing-${Date.now()}.json`);
  const s = loadSettings(p);
  assert.equal(s.connection.port, 4317);
});

test('saveSettings then loadSettings round-trips', () => {
  const p = path.join(os.tmpdir(), `cn-rt-${Date.now()}.json`);
  const s = mergeWithDefaults({ appearance: { preset: 'left-center' } });
  saveSettings(p, s);
  const loaded = loadSettings(p);
  assert.equal(loaded.appearance.preset, 'left-center');
  fs.unlinkSync(p);
});

test('loadSettings returns defaults on corrupt JSON', () => {
  const p = path.join(os.tmpdir(), `cn-bad-${Date.now()}.json`);
  fs.writeFileSync(p, '{ not json');
  const s = loadSettings(p);
  assert.equal(s.connection.port, 4317);
  fs.unlinkSync(p);
});

test('deepMerge preserves sibling keys (settings:set fix)', () => {
  const current = mergeWithDefaults({ notifications: { events: { Stop: false } } });
  const next = mergeWithDefaults(deepMerge(current, { notifications: { durationMs: 4000 } }));
  assert.equal(next.notifications.durationMs, 4000);   // applied
  assert.equal(next.notifications.events.Stop, false); // sibling preserved, NOT reset to default true
});

const test = require('node:test');
const assert = require('node:assert');
const { HOOK_EVENTS, buildHookCommand, buildHooksFragment, isInstalled, mergeHooks } = require('../src/main/hooks-installer');

const SCRIPT = 'C:\\app\\hooks\\notify.js';

test('buildHookCommand quotes path and includes port', () => {
  assert.equal(buildHookCommand(SCRIPT, 4317), `node "${SCRIPT}" --port 4317`);
});

test('fragment covers all events; tool events carry matcher', () => {
  const f = buildHooksFragment(SCRIPT, 4317);
  for (const ev of HOOK_EVENTS) assert.ok(Array.isArray(f[ev]));
  assert.equal(f.PreToolUse[0].matcher, '');
  assert.equal('matcher' in f.Stop[0], false);
});

test('isInstalled false on empty, true after merge', () => {
  assert.equal(isInstalled({}, SCRIPT), false);
  const merged = mergeHooks({}, SCRIPT, 4317);
  assert.equal(isInstalled(merged, SCRIPT), true);
});

test('mergeHooks preserves foreign hooks and dedupes our own', () => {
  const existing = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo other' }] }] } };
  const once = mergeHooks(existing, SCRIPT, 4317);
  const twice = mergeHooks(once, SCRIPT, 5000);
  // foreign hook still present
  assert.ok(twice.hooks.Stop.some((g) => g.hooks.some((h) => h.command === 'echo other')));
  // only one of OUR commands remains, with the new port
  const ours = twice.hooks.Stop.flatMap((g) => g.hooks).filter((h) => h.command.includes(SCRIPT));
  assert.equal(ours.length, 1);
  assert.ok(ours[0].command.includes('--port 5000'));
});

test('mergeHooks does not mutate input', () => {
  const input = { hooks: {} };
  mergeHooks(input, SCRIPT, 4317);
  assert.deepEqual(input, { hooks: {} });
});

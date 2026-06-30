const test = require('node:test');
const assert = require('node:assert');
const { removeHooks, mergeHooks } = require('../src/main/hooks-installer');

const FOREIGN = { hooks: [{ type: 'command', command: 'powershell toast' }] };
const ours = (cmd) => ({ hooks: [{ type: 'command', command: cmd }] });

function sample() {
  return {
    model: 'x',
    hooks: {
      Stop: [FOREIGN, ours('node "C:\\app\\resources\\app.asar\\hooks\\notify.js" --port 4317')],
      Notification: [ours('node "C:\\src\\hooks\\notify.js" --port 4317')],
      PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: 'node "X\\hooks\\notify.js" --port 4317' }] }],
      Foreign: [FOREIGN],
    },
  };
}

test('removeHooks strips our entries from every event, keeps foreign', () => {
  const r = removeHooks(sample());
  assert.deepEqual(r.hooks.Stop, [FOREIGN]);          // foreign kept, ours removed
  assert.equal('Notification' in r.hooks, false);     // only ours -> key dropped
  assert.equal('PreToolUse' in r.hooks, false);       // only ours -> key dropped
  assert.deepEqual(r.hooks.Foreign, [FOREIGN]);       // unrelated event untouched
  assert.equal(r.model, 'x');                          // unrelated config preserved
});

test('removeHooks catches both asar and source path variants', () => {
  const r = removeHooks(sample());
  const remaining = JSON.stringify(r);
  assert.equal(/notify\.js/.test(remaining), false);  // no notify.js command anywhere
});

test('removeHooks drops the hooks object entirely when only ours existed', () => {
  const onlyOurs = { hooks: { Stop: [ours('node "/a/hooks/notify.js" --port 4317')] } };
  const r = removeHooks(onlyOurs);
  assert.equal('hooks' in r, false);
});

test('removeHooks does not mutate its input', () => {
  const input = sample();
  const before = JSON.stringify(input);
  removeHooks(input);
  assert.equal(JSON.stringify(input), before);
});

test('removeHooks is a no-op on settings with no hooks', () => {
  assert.deepEqual(removeHooks({ model: 'x' }), { model: 'x' });
});

test('reinstalling from a new path replaces the stale (broken) entry', () => {
  const OLD = 'C:\\Program Files\\Claude Notch\\resources\\app.asar\\hooks\\notify.js';
  const NEW = 'C:\\Program Files\\Claude Notch\\resources\\app.asar.unpacked\\hooks\\notify.js';
  let s = mergeHooks({}, OLD, 4317);
  s = mergeHooks(s, NEW, 4317);
  const stopOurs = s.hooks.Stop.flatMap((g) => g.hooks).filter((h) => /notify\.js/.test(h.command));
  assert.equal(stopOurs.length, 1, 'exactly one of our commands remains');
  assert.ok(stopOurs[0].command.includes('app.asar.unpacked'), 'the surviving entry is the new path');
});

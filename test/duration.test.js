const test = require('node:test');
const assert = require('node:assert');
const { durationFor, eventEnabled } = require('../src/main/notify-policy');
const { mergeWithDefaults } = require('../src/main/settings-store');

test('durationFor uses per-event override then default', () => {
  const s = mergeWithDefaults({});
  assert.equal(durationFor(s, 'Notification'), 4000);
  assert.equal(durationFor(s, 'Stop'), 2500);
  assert.equal(durationFor(s, 'SubagentStop'), 2500); // falls back to default
});

test('eventEnabled maps tool/subagent toggles', () => {
  const s = mergeWithDefaults({ notifications: { events: { toolUse: false, subagent: true, Stop: true, Notification: false } } });
  assert.equal(eventEnabled(s, 'PreToolUse'), false);
  assert.equal(eventEnabled(s, 'SubagentStop'), true);
  assert.equal(eventEnabled(s, 'Notification'), false);
  assert.equal(eventEnabled(s, 'Stop'), true);
});

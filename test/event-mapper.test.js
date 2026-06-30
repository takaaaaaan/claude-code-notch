const test = require('node:test');
const assert = require('node:assert');
const { normalizeEvent, mapToDisplay, VALID_EVENTS } = require('../src/main/event-mapper');

test('normalizeEvent rejects non-objects and unknown events', () => {
  assert.equal(normalizeEvent(null), null);
  assert.equal(normalizeEvent('x'), null);
  assert.equal(normalizeEvent({ event: 'Nope' }), null);
});

test('normalizeEvent fills defaults for missing fields', () => {
  const ev = normalizeEvent({ event: 'Stop' });
  assert.deepEqual(ev, { event: 'Stop', sessionId: '', project: '', message: '', tool: null, ts: 0 });
});

test('normalizeEvent passes through valid fields', () => {
  const ev = normalizeEvent({ event: 'PreToolUse', sessionId: 's1', project: 'app', tool: 'Bash', message: 'm', ts: 5 });
  assert.equal(ev.tool, 'Bash');
  assert.equal(ev.project, 'app');
});

test('VALID_EVENTS has all five', () => {
  assert.deepEqual(VALID_EVENTS, ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop']);
});

test('mapToDisplay Stop -> done card', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Stop', project: 'app' }));
  assert.equal(d.kind, 'card');
  assert.equal(d.variant, 'done');
  assert.equal(d.project, 'app');
});

test('mapToDisplay Notification -> wait card with custom message', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Notification', message: 'permission?' }));
  assert.equal(d.variant, 'wait');
  assert.equal(d.sub, 'permission?');
});

test('mapToDisplay tool/subagent -> character states', () => {
  assert.equal(mapToDisplay(normalizeEvent({ event: 'PreToolUse' })).state, 'working');
  assert.equal(mapToDisplay(normalizeEvent({ event: 'PostToolUse' })).state, 'idle');
  assert.equal(mapToDisplay(normalizeEvent({ event: 'SubagentStop' })).state, 'sub');
});

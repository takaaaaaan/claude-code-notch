const test = require('node:test');
const assert = require('node:assert');
const { buildPayload, parsePort } = require('../hooks/payload');

test('parsePort reads --port, defaults to 4317', () => {
  assert.equal(parsePort(['node', 'x', '--port', '5000']), 5000);
  assert.equal(parsePort(['node', 'x']), 4317);
});

test('buildPayload derives project from cwd (Windows path)', () => {
  const p = buildPayload({ hook_event_name: 'Stop', session_id: 's1', cwd: 'C:\\Users\\me\\my-app\\' });
  assert.equal(p.event, 'Stop');
  assert.equal(p.sessionId, 's1');
  assert.equal(p.project, 'my-app');
});

test('buildPayload derives project from posix cwd', () => {
  const p = buildPayload({ hook_event_name: 'Notification', cwd: '/home/me/proj' });
  assert.equal(p.project, 'proj');
});

test('buildPayload carries tool_name and message', () => {
  const p = buildPayload({ hook_event_name: 'PreToolUse', tool_name: 'Bash', message: 'hi' });
  assert.equal(p.tool, 'Bash');
  assert.equal(p.message, 'hi');
});

test('buildPayload handles empty input', () => {
  const p = buildPayload({});
  assert.equal(p.project, '');
  assert.equal(p.tool, null);
});

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createEventServer } = require('../src/main/event-server');

function post(port, path, body, headers = {}) {
  return new Promise((resolve) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers } },
      (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.write(data); req.end();
  });
}

test('valid event reaches onEvent and returns 204', async () => {
  const received = [];
  const srv = createEventServer({ port: 0, onEvent: (e) => received.push(e) });
  const port = await srv.start();
  const code = await post(port, '/event', { event: 'Stop', project: 'app' });
  assert.equal(code, 204);
  assert.equal(received.length, 1);
  assert.equal(received[0].event, 'Stop');
  assert.ok(received[0].ts > 0);
  await srv.stop();
});

test('invalid body returns 400', async () => {
  const srv = createEventServer({ port: 0, onEvent: () => {} });
  const port = await srv.start();
  assert.equal(await post(port, '/event', { event: 'Nope' }), 400);
  assert.equal(await post(port, '/event', 'not json'), 400);
  await srv.stop();
});

test('token enforced when set', async () => {
  const srv = createEventServer({ port: 0, token: 'secret', onEvent: () => {} });
  const port = await srv.start();
  assert.equal(await post(port, '/event', { event: 'Stop' }), 401);
  assert.equal(await post(port, '/event', { event: 'Stop' }, { 'x-notch-token': 'secret' }), 204);
  await srv.stop();
});

test('unknown route returns 404', async () => {
  const srv = createEventServer({ port: 0, onEvent: () => {} });
  const port = await srv.start();
  assert.equal(await post(port, '/other', {}), 404);
  await srv.stop();
});

test('defaults to port 4317 when port omitted', async () => {
  // maxFallback: 0 so a busy 4317 rejects with EADDRINUSE instead of silently
  // binding 4318; finally-stop so the server can never leak and hang the runner.
  const srv = createEventServer({ onEvent: () => {}, maxFallback: 0 });
  try {
    const port = await srv.start();
    assert.equal(port, 4317);
  } catch (e) {
    // 4317 already in use on this machine — acceptable; the default was still attempted
    assert.equal(e.code, 'EADDRINUSE');
  } finally {
    await srv.stop();
  }
});

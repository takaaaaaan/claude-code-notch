const http = require('node:http');
const { normalizeEvent } = require('./event-mapper');

function createEventServer({ port, token = '', onEvent, maxFallback = 10 }) {
  let server = null;
  let activePort = null;

  function handler(req, res) {
    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404); res.end(); return;
    }
    if (token && req.headers['x-notch-token'] !== token) {
      res.writeHead(401); res.end(); return;
    }
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch { /* ignore */ }
      const ev = normalizeEvent(parsed);
      if (!ev) { res.writeHead(400); res.end(); return; }
      ev.ts = Date.now();
      try { onEvent(ev); } catch { /* never crash on handler error */ }
      res.writeHead(204); res.end();
    });
  }

  function start() {
    return new Promise((resolve, reject) => {
      let attempt = 0;
      const tryListen = (p) => {
        server = http.createServer(handler);
        server.once('error', (e) => {
          if (e.code === 'EADDRINUSE' && attempt < maxFallback) {
            attempt += 1;
            tryListen(p + 1);
          } else {
            reject(e);
          }
        });
        server.listen(p, '127.0.0.1', () => {
          activePort = server.address().port;
          resolve(activePort);
        });
      };
      tryListen(port);
    });
  }

  function stop() {
    return new Promise((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
  }

  return { start, stop, get port() { return activePort; } };
}

module.exports = { createEventServer };

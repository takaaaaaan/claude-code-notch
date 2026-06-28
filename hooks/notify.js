#!/usr/bin/env node
const http = require('node:http');
const { parsePort, buildPayload } = require('./payload');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) { resolve('{}'); return; }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data || '{}'));
    setTimeout(() => resolve(data || '{}'), 400); // never hang
  });
}

async function main() {
  const port = parsePort(process.argv);
  let input = {};
  try { input = JSON.parse(await readStdin()); } catch { input = {}; }
  const data = JSON.stringify(buildPayload(input));
  const req = http.request(
    { host: '127.0.0.1', port, path: '/event', method: 'POST', timeout: 500,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } },
    () => process.exit(0),
  );
  req.on('error', () => process.exit(0));
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.write(data);
  req.end();
}

main();

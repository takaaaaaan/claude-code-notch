# Claude Notch for Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Electron overlay that receives Claude Code Hook events over a localhost HTTP server and shows them as a notch-style island (cards for important events, character changes for light events), with a settings window.

**Architecture:** Electron with one Main process and two renderer windows (notch + settings). Main runs a localhost HTTP server that validates/normalizes incoming events and forwards them to the notch renderer via IPC. All decision logic (event normalization/mapping, window position math, hover-zone math, settings persistence, hooks install) lives in pure Node modules unit-tested with `node:test`; the Electron-specific glue is thin and verified by running the app.

**Tech Stack:** Electron, Node.js 22 (built-in `http`, `fs`, `node:test`), HTML/CSS/JS (no UI framework), electron-builder for packaging.

## Global Constraints

- Platform: **Windows only** (win32). Do not add Mac/Linux code paths.
- Runtime deps: **Electron only**. No web framework, no HTTP library — use Node built-in `http`.
- Test runner: **`node:test`** (built into Node 22), run with `node --test`. No Jest/Vitest.
- Server binds **`127.0.0.1` only** (never `0.0.0.0`).
- Default port: **4317**. On `EADDRINUSE`, fall back to next port (up to +10).
- v1 is **display-only** — the notch never sends actions back to Claude Code.
- UI default language: **Japanese** (`ja`); theme default **system**.
- Event names are exactly: `Stop`, `Notification`, `PreToolUse`, `PostToolUse`, `SubagentStop`.
- Default notification duration: **2500 ms** (`Notification` event overrides to 4000 ms).
- Frequent commits: one commit per task minimum.

---

### Task 1: Project scaffold + settings store

**Files:**
- Create: `package.json`
- Create: `src/main/settings-store.js`
- Create: `.gitignore`
- Test: `test/settings-store.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULT_SETTINGS` — frozen object (shape below).
  - `mergeWithDefaults(partial) -> settings` — deep-merges `partial` over defaults; unknown keys dropped at top level sections.
  - `loadSettings(filePath) -> settings` — reads JSON; on missing/corrupt file returns a clone of defaults.
  - `saveSettings(filePath, settings) -> void` — writes pretty JSON synchronously.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "claude-notch",
  "version": "0.1.0",
  "description": "Claude Code notch-style overlay for Windows",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test",
    "dist": "electron-builder --win"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  }
}
```

- [ ] **Step 3: Write the failing test**

```js
// test/settings-store.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_SETTINGS, mergeWithDefaults, loadSettings, saveSettings } = require('../src/main/settings-store');

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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node --test test/settings-store.test.js`
Expected: FAIL — `Cannot find module '../src/main/settings-store'`.

- [ ] **Step 5: Implement `src/main/settings-store.js`**

```js
const fs = require('node:fs');

const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  general: { autostart: false, language: 'ja', theme: 'system' },
  connection: { port: 4317, token: '' },
  notifications: {
    durationMs: 2500,
    events: { Stop: true, Notification: true, toolUse: true, subagent: true },
    perEventDurationMs: { Stop: 2500, Notification: 4000 },
    sound: false,
    cardInfo: { project: true, elapsed: false, tool: true },
    dnd: false,
  },
  appearance: {
    hoverReveal: true,
    sensitivity: 4,
    preset: 'top-center',
    offsetX: 0,
    offsetY: 0,
    size: 'medium',
    displayId: null,
    animations: true,
  },
  character: { enabled: true, set: 'default' },
});

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, over) {
  const out = clone(base);
  if (!isPlainObject(over)) return out;
  for (const key of Object.keys(over)) {
    if (isPlainObject(out[key]) && isPlainObject(over[key])) {
      out[key] = deepMerge(out[key], over[key]);
    } else if (over[key] !== undefined) {
      out[key] = over[key];
    }
  }
  return out;
}

function mergeWithDefaults(partial) {
  return deepMerge(DEFAULT_SETTINGS, partial || {});
}

function loadSettings(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

function saveSettings(filePath, settings) {
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

module.exports = { DEFAULT_SETTINGS, mergeWithDefaults, loadSettings, saveSettings };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/settings-store.test.js`
Expected: PASS — 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore src/main/settings-store.js test/settings-store.test.js
git commit -m "feat: project scaffold and settings store"
```

---

### Task 2: Event normalization and display mapping

**Files:**
- Create: `src/main/event-mapper.js`
- Test: `test/event-mapper.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `VALID_EVENTS` — array of the 5 event name strings.
  - `normalizeEvent(body) -> NormalizedEvent | null` where
    `NormalizedEvent = { event, sessionId, project, message, tool, ts }`.
    Returns `null` if `body` is not an object or `body.event` is not in `VALID_EVENTS`.
  - `mapToDisplay(event) -> DisplayCommand` where
    `DisplayCommand = { kind:'card', variant:'done'|'wait', badge, title, sub, project }`
    or `{ kind:'character', state:'working'|'idle'|'sub' }`.

- [ ] **Step 1: Write the failing test**

```js
// test/event-mapper.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/event-mapper.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/event-mapper.js`**

```js
const VALID_EVENTS = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];

function str(v) {
  return typeof v === 'string' ? v : '';
}

function normalizeEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!VALID_EVENTS.includes(body.event)) return null;
  return {
    event: body.event,
    sessionId: str(body.sessionId),
    project: str(body.project),
    message: str(body.message),
    tool: typeof body.tool === 'string' ? body.tool : null,
    ts: Number.isFinite(body.ts) ? body.ts : 0,
  };
}

function mapToDisplay(event) {
  switch (event.event) {
    case 'Stop':
      return { kind: 'card', variant: 'done', badge: '完了',
        title: 'タスク完了', sub: event.message || '応答が完了しました', project: event.project };
    case 'Notification':
      return { kind: 'card', variant: 'wait', badge: '許可待ち',
        title: 'あなたの応答が必要', sub: event.message || '応答を待っています', project: event.project };
    case 'PreToolUse':
      return { kind: 'character', state: 'working' };
    case 'PostToolUse':
      return { kind: 'character', state: 'idle' };
    case 'SubagentStop':
      return { kind: 'character', state: 'sub' };
    default:
      return { kind: 'character', state: 'idle' };
  }
}

module.exports = { VALID_EVENTS, normalizeEvent, mapToDisplay };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/event-mapper.test.js`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/event-mapper.js test/event-mapper.test.js
git commit -m "feat: event normalization and display mapping"
```

---

### Task 3: Local event HTTP server

**Files:**
- Create: `src/main/event-server.js`
- Test: `test/event-server.test.js`

**Interfaces:**
- Consumes: `normalizeEvent` from `event-mapper`.
- Produces:
  - `createEventServer({ port, token, onEvent, maxFallback }) -> { start(): Promise<number>, stop(): Promise<void>, port }`.
    - `start()` resolves with the actual bound port (after any fallback).
    - On valid POST `/event`, calls `onEvent(normalizedEvent)` with `ts` stamped to `Date.now()`, responds 204.
    - Invalid body → 400. Wrong/missing token (when `token` set) → 401. Other routes/methods → 404.

- [ ] **Step 1: Write the failing test**

```js
// test/event-server.test.js
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
```

> Note: `port: 0` lets the OS pick a free ephemeral port for tests. The fallback path is exercised manually in Task 8.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/event-server.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/event-server.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/event-server.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/event-server.js test/event-server.test.js
git commit -m "feat: localhost event HTTP server"
```

---

### Task 4: Window position math

**Files:**
- Create: `src/main/position.js`
- Test: `test/position.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SIZES` — `{ small, medium, large }`, each `{ main, cross }` (px).
  - `computeBounds(appearance, display) -> { x, y, width, height }` where
    `appearance = { preset, offsetX, offsetY, size }` and
    `display = { workArea: { x, y, width, height } }`.
    Presets: `top-center`, `top-left`, `top-right`, `left-center`, `right-center`.

- [ ] **Step 1: Write the failing test**

```js
// test/position.test.js
const test = require('node:test');
const assert = require('node:assert');
const { computeBounds, SIZES } = require('../src/main/position');

const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };

test('top-center medium is centered horizontally at top', () => {
  const b = computeBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.width, SIZES.medium.main);
  assert.equal(b.height, SIZES.medium.cross);
  assert.equal(b.y, 0);
  assert.equal(b.x, Math.round((1920 - SIZES.medium.main) / 2));
});

test('top-center honors offsetX', () => {
  const b = computeBounds({ preset: 'top-center', size: 'medium', offsetX: 50, offsetY: 0 }, display);
  assert.equal(b.x, Math.round((1920 - SIZES.medium.main) / 2) + 50);
});

test('top-right sits at right edge', () => {
  const b = computeBounds({ preset: 'top-right', size: 'small', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.x, 1920 - SIZES.small.main);
});

test('left-center is a vertical pill on the left edge', () => {
  const b = computeBounds({ preset: 'left-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.x, 0);
  assert.equal(b.width, SIZES.medium.cross);
  assert.equal(b.height, SIZES.medium.main);
  assert.equal(b.y, Math.round((1080 - SIZES.medium.main) / 2));
});

test('right-center sits at right edge with offsetY', () => {
  const b = computeBounds({ preset: 'right-center', size: 'medium', offsetX: 0, offsetY: 20 }, display);
  assert.equal(b.x, 1920 - SIZES.medium.cross);
  assert.equal(b.y, Math.round((1080 - SIZES.medium.main) / 2) + 20);
});

test('respects non-zero workArea origin (secondary monitor)', () => {
  const d2 = { workArea: { x: 1920, y: 0, width: 1280, height: 720 } };
  const b = computeBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, d2);
  assert.equal(b.x, 1920 + Math.round((1280 - SIZES.medium.main) / 2));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/position.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/position.js`**

```js
const SIZES = {
  small: { main: 200, cross: 28 },
  medium: { main: 260, cross: 36 },
  large: { main: 340, cross: 48 },
};

const SIDE = new Set(['left-center', 'right-center']);

function computeBounds(appearance, display) {
  const { preset = 'top-center', offsetX = 0, offsetY = 0, size = 'medium' } = appearance || {};
  const area = display.workArea;
  const s = SIZES[size] || SIZES.medium;

  if (SIDE.has(preset)) {
    const width = s.cross;
    const height = s.main;
    const y = Math.round(area.y + (area.height - height) / 2) + offsetY;
    const x = preset === 'left-center' ? area.x : area.x + area.width - width;
    return { x, y, width, height };
  }

  const width = s.main;
  const height = s.cross;
  let x;
  if (preset === 'top-left') x = area.x + offsetX;
  else if (preset === 'top-right') x = area.x + area.width - width + offsetX;
  else x = Math.round(area.x + (area.width - width) / 2) + offsetX; // top-center
  const y = area.y + offsetY;
  return { x, y, width, height };
}

module.exports = { SIZES, computeBounds };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/position.test.js`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/position.js test/position.test.js
git commit -m "feat: notch window position math with presets and multi-monitor"
```

---

### Task 5: Hover trigger-zone math

**Files:**
- Create: `src/main/hover.js`
- Test: `test/hover.test.js`

**Interfaces:**
- Consumes: `computeBounds` from `position`.
- Produces:
  - `triggerZone(appearance, display) -> { x, y, width, height }` — a thin strip at the screen edge where the notch lives; thickness = `appearance.sensitivity` (min 1).
  - `isInZone(cursor, zone) -> boolean` where `cursor = { x, y }`.

- [ ] **Step 1: Write the failing test**

```js
// test/hover.test.js
const test = require('node:test');
const assert = require('node:assert');
const { triggerZone, isInZone } = require('../src/main/hover');
const { computeBounds } = require('../src/main/position');

const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };

test('top-center zone is a thin band at y=0 spanning the notch width', () => {
  const ap = { preset: 'top-center', size: 'medium', sensitivity: 4, offsetX: 0, offsetY: 0 };
  const z = triggerZone(ap, display);
  const b = computeBounds(ap, display);
  assert.equal(z.y, 0);
  assert.equal(z.height, 4);
  assert.equal(z.x, b.x);
  assert.equal(z.width, b.width);
});

test('left-center zone is a thin vertical band at x=0', () => {
  const ap = { preset: 'left-center', size: 'medium', sensitivity: 6, offsetX: 0, offsetY: 0 };
  const z = triggerZone(ap, display);
  assert.equal(z.x, 0);
  assert.equal(z.width, 6);
});

test('sensitivity below 1 clamps to 1', () => {
  const ap = { preset: 'top-center', size: 'medium', sensitivity: 0, offsetX: 0, offsetY: 0 };
  assert.equal(triggerZone(ap, display).height, 1);
});

test('isInZone detects inside and outside', () => {
  const z = { x: 10, y: 0, width: 100, height: 4 };
  assert.equal(isInZone({ x: 50, y: 2 }, z), true);
  assert.equal(isInZone({ x: 50, y: 10 }, z), false);
  assert.equal(isInZone({ x: 200, y: 2 }, z), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hover.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/hover.js`**

```js
const { computeBounds } = require('./position');

const SIDE = new Set(['left-center', 'right-center']);

function triggerZone(appearance, display) {
  const b = computeBounds(appearance, display);
  const t = Math.max(1, appearance.sensitivity || 1);
  const area = display.bounds || display.workArea;

  if (SIDE.has(appearance.preset)) {
    const x = appearance.preset === 'left-center' ? area.x : area.x + area.width - t;
    return { x, y: b.y, width: t, height: b.height };
  }
  return { x: b.x, y: area.y, width: b.width, height: t };
}

function isInZone(cursor, zone) {
  return cursor.x >= zone.x && cursor.x <= zone.x + zone.width
    && cursor.y >= zone.y && cursor.y <= zone.y + zone.height;
}

module.exports = { triggerZone, isInZone };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/hover.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/hover.js test/hover.test.js
git commit -m "feat: hover trigger-zone math"
```

---

### Task 6: Hooks installer (settings.json integration)

**Files:**
- Create: `src/main/hooks-installer.js`
- Test: `test/hooks-installer.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HOOK_EVENTS` — the 5 event names.
  - `buildHookCommand(scriptPath, port) -> string`.
  - `buildHooksFragment(scriptPath, port) -> object` — a `hooks` object keyed by event; `PreToolUse`/`PostToolUse` entries include `matcher: ""` (match all tools), others omit `matcher`.
  - `isInstalled(settings, scriptPath) -> boolean` — true only if every event has an entry whose command contains `scriptPath`.
  - `mergeHooks(settings, scriptPath, port) -> settings` — returns a new settings object; removes our prior entries (same `scriptPath`) then adds fresh ones, preserving foreign hooks.

- [ ] **Step 1: Write the failing test**

```js
// test/hooks-installer.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks-installer.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/main/hooks-installer.js`**

```js
const HOOK_EVENTS = ['Stop', 'Notification', 'PreToolUse', 'PostToolUse', 'SubagentStop'];
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);

function buildHookCommand(scriptPath, port) {
  return `node "${scriptPath}" --port ${port}`;
}

function buildHooksFragment(scriptPath, port) {
  const command = buildHookCommand(scriptPath, port);
  const fragment = {};
  for (const ev of HOOK_EVENTS) {
    const group = { hooks: [{ type: 'command', command }] };
    if (TOOL_EVENTS.has(ev)) group.matcher = '';
    fragment[ev] = [group];
  }
  return fragment;
}

function groupHasScript(group, scriptPath) {
  return (group.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes(scriptPath));
}

function isInstalled(settings, scriptPath) {
  const hooks = settings && settings.hooks;
  if (!hooks) return false;
  return HOOK_EVENTS.every((ev) => Array.isArray(hooks[ev]) && hooks[ev].some((g) => groupHasScript(g, scriptPath)));
}

function mergeHooks(settings, scriptPath, port) {
  const next = JSON.parse(JSON.stringify(settings || {}));
  next.hooks = next.hooks || {};
  const fragment = buildHooksFragment(scriptPath, port);
  for (const ev of HOOK_EVENTS) {
    const kept = Array.isArray(next.hooks[ev])
      ? next.hooks[ev].filter((g) => !groupHasScript(g, scriptPath))
      : [];
    next.hooks[ev] = [...kept, ...fragment[ev]];
  }
  return next;
}

module.exports = { HOOK_EVENTS, buildHookCommand, buildHooksFragment, isInstalled, mergeHooks };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/hooks-installer.test.js`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/hooks-installer.js test/hooks-installer.test.js
git commit -m "feat: Claude Code hooks installer and detection"
```

---

### Task 7: Hook notify script

**Files:**
- Create: `hooks/payload.js`
- Create: `hooks/notify.js`
- Test: `test/payload.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hooks/payload.js`: `buildPayload(hookInput) -> NormalizedEvent-shaped object` and `parsePort(argv) -> number` (defaults 4317).
  - `hooks/notify.js`: CLI entry — reads stdin JSON from Claude Code, POSTs the payload to `127.0.0.1:<port>/event`, exits silently on any error.

- [ ] **Step 1: Write the failing test**

```js
// test/payload.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/payload.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `hooks/payload.js`**

```js
function parsePort(argv) {
  const i = argv.indexOf('--port');
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : 4317;
}

function projectFromCwd(cwd) {
  if (typeof cwd !== 'string' || !cwd) return '';
  const trimmed = cwd.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || '';
}

function buildPayload(hookInput) {
  const input = hookInput || {};
  return {
    event: input.hook_event_name || '',
    sessionId: input.session_id || '',
    project: projectFromCwd(input.cwd),
    message: typeof input.message === 'string' ? input.message : '',
    tool: typeof input.tool_name === 'string' ? input.tool_name : null,
    ts: 0,
  };
}

module.exports = { parsePort, projectFromCwd, buildPayload };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/payload.test.js`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Implement `hooks/notify.js`**

```js
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
```

- [ ] **Step 6: Manually verify the script POSTs (with server from Task 3)**

Run (PowerShell):
```powershell
node -e "const {createEventServer}=require('./src/main/event-server'); createEventServer({port:4317,onEvent:e=>{console.log('GOT',e.event,e.project); process.exit(0)}}).start().then(p=>console.error('listening',p))"
```
In a second terminal:
```powershell
'{"hook_event_name":"Stop","cwd":"C:\\x\\demo"}' | node hooks/notify.js --port 4317
```
Expected: first terminal prints `GOT Stop demo`.

- [ ] **Step 7: Commit**

```bash
git add hooks/payload.js hooks/notify.js test/payload.test.js
git commit -m "feat: hook notify script and payload builder"
```

---

### Task 8: Electron main + notch window (integration)

**Files:**
- Create: `src/main/main.js`
- Create: `src/preload/notch-preload.js`
- Create: `src/renderer/notch/notch.html`
- Create: `src/renderer/notch/notch.css`
- Create: `src/renderer/notch/notch.js`

**Interfaces:**
- Consumes: `loadSettings`/`saveSettings` (Task 1), `createEventServer` (Task 3), `mapToDisplay` (Task 2), `computeBounds` (Task 4), `triggerZone`/`isInZone` (Task 5).
- Produces:
  - Main creates a transparent, frameless, always-on-top notch `BrowserWindow`.
  - Main sends `notch:display` (a `DisplayCommand`) and `notch:hover` (`true|false`) over IPC.
  - `window.notch.onDisplay(cb)` / `window.notch.onHover(cb)` exposed by preload.

- [ ] **Step 1: Install Electron**

Run: `npm install`
Expected: `electron` and `electron-builder` install (this is large; allow a few minutes).

- [ ] **Step 2: Create the notch renderer `src/renderer/notch/notch.html`**

```html
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /><link rel="stylesheet" href="notch.css" /></head>
<body>
  <div class="notch" id="notch">
    <div class="mascot idle" id="mascot">🤖</div>
    <div class="body" id="compact"><div class="title" id="cTitle">Claude Code</div><div class="sub" id="cSub">待機中</div></div>
    <span class="dot" id="dot"></span>
    <span class="badge hidden" id="badge">完了</span>
    <div class="body hidden" id="card"><div class="title" id="kTitle"></div><div class="sub" id="kSub"></div></div>
    <span class="sess hidden" id="sess"></span>
  </div>
  <script src="notch.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `src/renderer/notch/notch.css`**

Reuse the visual language from `mockups/notch-states.html` (the `.notch`, `.mascot`, state colors, `.card`, `.badge`). Add a hidden/revealed transform so the notch slides out of view when not shown:

```css
:root { --accent:#d97757; --ok:#6cc070; --warn:#e0b341; --text:#f5f5f4; --dim:#a1a1aa; }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { background:transparent; overflow:hidden; font-family:"Segoe UI",system-ui,sans-serif; }
.notch { background:#0a0a0b; color:var(--text); border-radius:0 0 22px 22px; padding:8px 16px 10px;
  display:flex; align-items:center; gap:12px; box-shadow:0 8px 30px rgba(0,0,0,.55);
  transform:translateY(-110%); transition:transform .35s cubic-bezier(.22,1,.36,1); }
.notch.shown { transform:translateY(0); }
.notch.card { padding:12px 18px 14px; }
.mascot { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; font-size:20px; flex-shrink:0;
  background:linear-gradient(135deg,var(--accent),#b85c3e); transition:background .3s; }
.mascot.working { background:linear-gradient(135deg,#5b8def,#3a6fd8); animation:pulse 1.1s infinite; }
.mascot.sub { background:linear-gradient(135deg,#9b7ddb,#7a55c4); animation:bob .7s infinite; }
.mascot.done { background:linear-gradient(135deg,var(--ok),#4a9e50); }
.mascot.wait { background:linear-gradient(135deg,var(--warn),#c79a2a); animation:shake .5s infinite; }
@keyframes pulse {0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes bob {0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes shake {0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
.body { display:flex; flex-direction:column; gap:2px; min-width:0; }
.title { font-size:13px; font-weight:600; white-space:nowrap; }
.sub { font-size:11px; color:var(--dim); white-space:nowrap; }
.dot { width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px var(--accent); }
.badge { font-size:10px; font-weight:700; padding:2px 7px; border-radius:6px; }
.badge.done { background:rgba(108,192,112,.15); color:var(--ok); }
.badge.wait { background:rgba(224,179,65,.15); color:var(--warn); }
.sess { font-size:10px; color:var(--dim); background:rgba(255,255,255,.06); padding:2px 6px; border-radius:5px; }
.hidden { display:none !important; }
```

- [ ] **Step 4: Create `src/renderer/notch/notch.js`** (display state machine)

```js
const el = (id) => document.getElementById(id);
const notch = el('notch');
let hideTimer = null;
let hovering = false;

function show() { notch.classList.add('shown'); }
function hideSoon(ms) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (!hovering) notch.classList.remove('shown'); }, ms);
}

function setCharacter(state) {
  el('mascot').className = 'mascot ' + state;
  el('mascot').textContent = { idle: '🤖', working: '🛠️', sub: '👥', done: '✅', wait: '⏳' }[state] || '🤖';
}

function showCard(cmd, durationMs) {
  notch.classList.add('card');
  el('compact').classList.add('hidden'); el('dot').classList.add('hidden');
  el('card').classList.remove('hidden'); el('badge').classList.remove('hidden'); el('sess').classList.remove('hidden');
  el('badge').className = 'badge ' + cmd.variant; el('badge').textContent = cmd.badge;
  el('kTitle').textContent = cmd.title; el('kSub').textContent = cmd.sub;
  el('sess').textContent = cmd.project || '';
  setCharacter(cmd.variant === 'done' ? 'done' : 'wait');
  show(); hideSoon(durationMs);
}

function showCharacterOnly(state) {
  notch.classList.remove('card');
  el('card').classList.add('hidden'); el('badge').classList.add('hidden'); el('sess').classList.add('hidden');
  el('compact').classList.remove('hidden'); el('dot').classList.remove('hidden');
  setCharacter(state);
  // character changes are subtle: reveal briefly, then retreat (unless hovering)
  show(); hideSoon(1500);
}

window.notch.onDisplay(({ cmd, durationMs }) => {
  if (cmd.kind === 'card') showCard(cmd, durationMs);
  else showCharacterOnly(cmd.state);
});
window.notch.onHover((isHover) => {
  hovering = isHover;
  if (isHover) { clearTimeout(hideTimer); show(); }
  else hideSoon(300);
});
```

- [ ] **Step 5: Create `src/preload/notch-preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('notch', {
  onDisplay: (cb) => ipcRenderer.on('notch:display', (_e, payload) => cb(payload)),
  onHover: (cb) => ipcRenderer.on('notch:hover', (_e, v) => cb(v)),
});
```

- [ ] **Step 6: Create `src/main/main.js`** (wiring; settings/tray expanded in later tasks)

```js
const { app, BrowserWindow, screen } = require('electron');
const path = require('node:path');
const { loadSettings } = require('./settings-store');
const { createEventServer } = require('./event-server');
const { mapToDisplay } = require('./event-mapper');
const { computeBounds } = require('./position');
const { triggerZone, isInZone } = require('./hover');

const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

let notchWin = null;
let settings = null;
let server = null;
let hoverInterval = null;
let lastHover = false;

function getDisplay() {
  const id = settings.appearance.displayId;
  const displays = screen.getAllDisplays();
  return displays.find((d) => d.id === id) || screen.getPrimaryDisplay();
}

function positionNotch() {
  const display = getDisplay();
  const b = computeBounds(settings.appearance, display);
  notchWin.setBounds(b);
}

function createNotch() {
  notchWin = new BrowserWindow({
    width: 300, height: 60, frame: false, transparent: true, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, '../preload/notch-preload.js') },
  });
  notchWin.setAlwaysOnTop(true, 'screen-saver');
  notchWin.loadFile(path.join(__dirname, '../renderer/notch/notch.html'));
  positionNotch();
}

function durationFor(event) {
  const per = settings.notifications.perEventDurationMs[event];
  return typeof per === 'number' ? per : settings.notifications.durationMs;
}

function eventEnabled(event) {
  const n = settings.notifications.events;
  if (event === 'Stop') return n.Stop;
  if (event === 'Notification') return n.Notification;
  if (event === 'PreToolUse' || event === 'PostToolUse') return n.toolUse;
  if (event === 'SubagentStop') return n.subagent;
  return true;
}

function handleEvent(ev) {
  if (settings.notifications.dnd) return;
  if (!eventEnabled(ev.event)) return;
  const cmd = mapToDisplay(ev);
  notchWin.webContents.send('notch:display', { cmd, durationMs: durationFor(ev.event) });
}

function startHoverWatch() {
  if (!settings.appearance.hoverReveal) return;
  hoverInterval = setInterval(() => {
    const display = getDisplay();
    const zone = triggerZone(settings.appearance, display);
    const cursor = screen.getCursorScreenPoint();
    const onNotch = isInZone(cursor, notchWin.getBounds());
    const inZone = isInZone(cursor, zone) || onNotch;
    if (inZone !== lastHover) {
      lastHover = inZone;
      notchWin.webContents.send('notch:hover', inZone);
    }
  }, 120);
}

app.whenReady().then(async () => {
  settings = loadSettings(SETTINGS_PATH());
  createNotch();
  server = createEventServer({
    port: settings.connection.port,
    token: settings.connection.token,
    onEvent: handleEvent,
  });
  await server.start();
  startHoverWatch();
});

app.on('window-all-closed', (e) => { e.preventDefault(); }); // stay resident in tray (Task 11)

module.exports = { __test: { durationFor: () => durationFor } };
```

- [ ] **Step 7: Manually verify the app shows events**

Run: `npm start`
Then in another terminal:
```powershell
'{"hook_event_name":"Notification","cwd":"C:\\x\\demo","message":"応答して"}' | node hooks/notify.js
'{"hook_event_name":"PreToolUse","cwd":"C:\\x\\demo"}' | node hooks/notify.js
```
Expected: the notch slides down at top-center; the first shows a yellow "許可待ち" card with `demo`; the second turns the mascot blue (working) briefly. Moving the mouse to the very top-center reveals the notch on hover.

- [ ] **Step 8: Commit**

```bash
git add src/main/main.js src/preload/notch-preload.js src/renderer/notch/
git commit -m "feat: electron main, notch window, hover reveal, event display"
```

---

### Task 9: Tray + autostart + resident lifecycle

**Files:**
- Create: `src/main/tray-controller.js`
- Modify: `src/main/main.js` (wire tray + autostart)
- Create: `assets/tray.png` (a 16x16 / 32x32 icon; any simple placeholder PNG)

**Interfaces:**
- Consumes: `app` from Electron.
- Produces:
  - `createTray({ onOpenSettings, onQuit, onToggleDnd }) -> { setConnected(bool), setDnd(bool), destroy() }`.

- [ ] **Step 1: Create `src/main/tray-controller.js`**

```js
const { Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

function createTray({ onOpenSettings, onQuit, onToggleDnd }) {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray.png'));
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  let connected = false;
  let dnd = false;

  function rebuild() {
    tray.setToolTip(connected ? 'Claude Notch — 接続中' : 'Claude Notch — 未接続');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: connected ? '🟢 接続中' : '⚪ 未接続', enabled: false },
      { type: 'separator' },
      { label: '設定を開く', click: onOpenSettings },
      { label: '集中モード（通知停止）', type: 'checkbox', checked: dnd, click: () => onToggleDnd() },
      { type: 'separator' },
      { label: '終了', click: onQuit },
    ]));
  }
  rebuild();

  return {
    setConnected: (v) => { connected = v; rebuild(); },
    setDnd: (v) => { dnd = v; rebuild(); },
    destroy: () => tray.destroy(),
  };
}

module.exports = { createTray };
```

- [ ] **Step 2: Add a placeholder tray icon**

Run (PowerShell, creates a tiny solid PNG so the tray has an image):
```powershell
New-Item -ItemType Directory -Force assets | Out-Null
$b64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHElEQVQ4y2NgGAWjYBSMglEwCkbBKBgFowAAA+gAAYjY3eEAAAAASUVORK5CYII="
[IO.File]::WriteAllBytes("assets/tray.png", [Convert]::FromBase64String($b64))
```
Expected: `assets/tray.png` exists. (Replace with real art later.)

- [ ] **Step 3: Wire tray + autostart into `src/main/main.js`**

Add near the top:
```js
const { createTray } = require('./tray-controller');
const { saveSettings } = require('./settings-store');
let tray = null;
```
Add a function:
```js
function applyAutostart() {
  app.setLoginItemSettings({ openAtLogin: !!settings.general.autostart });
}
```
At the end of `app.whenReady().then(...)`, after `startHoverWatch()`:
```js
  tray = createTray({
    onOpenSettings: () => openSettings(),       // defined in Task 10
    onQuit: () => { app.exit(0); },
    onToggleDnd: () => {
      settings.notifications.dnd = !settings.notifications.dnd;
      saveSettings(SETTINGS_PATH(), settings);
      tray.setDnd(settings.notifications.dnd);
    },
  });
  tray.setConnected(true);
  applyAutostart();
```
> `openSettings()` is added in Task 10. Until then, temporarily stub it: add `function openSettings() {}` so the app runs.

- [ ] **Step 4: Manually verify tray**

Run: `npm start`
Expected: a tray icon appears; right-click shows the menu (接続中, 設定を開く, 集中モード, 終了); toggling 集中モード suppresses notifications (re-send a Notification event to confirm it is dropped). 終了 closes the app.

- [ ] **Step 5: Commit**

```bash
git add src/main/tray-controller.js src/main/main.js assets/tray.png
git commit -m "feat: tray menu, DnD toggle, autostart, resident lifecycle"
```

---

### Task 10: Settings window + IPC + hooks UI + test notification

**Files:**
- Create: `src/main/ipc.js`
- Create: `src/preload/settings-preload.js`
- Create: `src/renderer/settings/settings.html`
- Create: `src/renderer/settings/settings.css`
- Create: `src/renderer/settings/settings.js`
- Modify: `src/main/main.js` (add `openSettings()`, register IPC, re-apply settings on change)
- Test: `test/duration.test.js`

**Interfaces:**
- Consumes: `loadSettings`/`saveSettings`, `isInstalled`/`mergeHooks`/`buildHookCommand` (Task 6), `normalizeEvent`/`mapToDisplay`.
- Produces (IPC channels via `ipcMain.handle`):
  - `settings:get` → current settings object.
  - `settings:set` (partial) → merged + saved settings; main re-applies position/server/hover.
  - `hooks:status` → `{ installed: boolean, command: string, claudeSettingsPath: string }`.
  - `hooks:install` → writes `mergeHooks` result to `~/.claude/settings.json`; returns `{ ok, installed }`.
  - `test:event` (eventName) → injects `mapToDisplay(normalizeEvent({event}))` into the notch (same path as a real event).
  - `displays:list` → `[{ id, label }]` for the monitor picker.

- [ ] **Step 1: Write the failing test for the shared duration helper**

(The duration/enabled logic from Task 8 is moved into a testable module.)

```js
// test/duration.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/duration.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/main/notify-policy.js`**

```js
function durationFor(settings, event) {
  const per = settings.notifications.perEventDurationMs[event];
  return typeof per === 'number' ? per : settings.notifications.durationMs;
}

function eventEnabled(settings, event) {
  const n = settings.notifications.events;
  if (event === 'Stop') return !!n.Stop;
  if (event === 'Notification') return !!n.Notification;
  if (event === 'PreToolUse' || event === 'PostToolUse') return !!n.toolUse;
  if (event === 'SubagentStop') return !!n.subagent;
  return true;
}

module.exports = { durationFor, eventEnabled };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/duration.test.js`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Refactor `main.js` to use `notify-policy`**

Delete the local `durationFor`/`eventEnabled` functions in `main.js` and instead:
```js
const { durationFor, eventEnabled } = require('./notify-policy');
```
Update calls: `durationFor(settings, ev.event)` and `eventEnabled(settings, ev.event)`.
Run `npm test` to confirm all suites still pass.

- [ ] **Step 6: Create `src/main/ipc.js`**

```js
const { ipcMain, screen } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeWithDefaults, saveSettings } = require('./settings-store');
const { isInstalled, mergeHooks, buildHookCommand } = require('./hooks-installer');
const { normalizeEvent, mapToDisplay } = require('./event-mapper');
const { durationFor } = require('./notify-policy');

const claudeSettingsPath = () => path.join(os.homedir(), '.claude', 'settings.json');

function registerIpc({ getSettings, setSettings, settingsPath, notchSend, scriptPath, getPort }) {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, partial) => {
    const next = mergeWithDefaults({ ...getSettings(), ...partial });
    setSettings(next);
    saveSettings(settingsPath(), next);
    return next;
  });

  ipcMain.handle('displays:list', () =>
    screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `モニター ${i + 1} (${d.size.width}x${d.size.height})` })));

  ipcMain.handle('hooks:status', () => {
    let claude = {};
    try { claude = JSON.parse(fs.readFileSync(claudeSettingsPath(), 'utf8')); } catch { claude = {}; }
    return { installed: isInstalled(claude, scriptPath), command: buildHookCommand(scriptPath, getPort()), claudeSettingsPath: claudeSettingsPath() };
  });

  ipcMain.handle('hooks:install', () => {
    let claude = {};
    try { claude = JSON.parse(fs.readFileSync(claudeSettingsPath(), 'utf8')); } catch { claude = {}; }
    const merged = mergeHooks(claude, scriptPath, getPort());
    fs.mkdirSync(path.dirname(claudeSettingsPath()), { recursive: true });
    fs.writeFileSync(claudeSettingsPath(), JSON.stringify(merged, null, 2), 'utf8');
    return { ok: true, installed: isInstalled(merged, scriptPath) };
  });

  ipcMain.handle('test:event', (_e, eventName) => {
    const ev = normalizeEvent({ event: eventName, project: 'test', message: 'テスト通知' });
    if (!ev) return { ok: false };
    notchSend({ cmd: mapToDisplay(ev), durationMs: durationFor(getSettings(), eventName) });
    return { ok: true };
  });
}

module.exports = { registerIpc };
```

- [ ] **Step 7: Create `src/preload/settings-preload.js`**

```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  hooksStatus: () => ipcRenderer.invoke('hooks:status'),
  hooksInstall: () => ipcRenderer.invoke('hooks:install'),
  testEvent: (name) => ipcRenderer.invoke('test:event', name),
});
```

- [ ] **Step 8: Create the settings UI**

`src/renderer/settings/settings.html` — a tabbed layout with the 6 sections from the spec (一般 / 接続 / 通知 / ノッチ表示 / キャラクター / 詳細). Minimal but complete controls:

```html
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /><link rel="stylesheet" href="settings.css" /></head>
<body>
  <nav id="tabs">
    <button data-tab="general" class="active">一般</button>
    <button data-tab="connection">接続</button>
    <button data-tab="notifications">通知</button>
    <button data-tab="appearance">ノッチ表示</button>
    <button data-tab="character">キャラ</button>
    <button data-tab="advanced">詳細</button>
  </nav>
  <main>
    <section data-panel="general">
      <label><input type="checkbox" id="autostart" /> Windows 起動時に自動起動</label>
      <label>テーマ <select id="theme"><option value="system">システム</option><option value="dark">ダーク</option><option value="light">ライト</option></select></label>
    </section>
    <section data-panel="connection" hidden>
      <label>ポート <input type="number" id="port" /></label>
      <p id="connStatus"></p>
      <button id="installHooks">Hooks をワンクリック登録</button>
      <p id="hooksStatus"></p>
      <pre id="snippet"></pre>
    </section>
    <section data-panel="notifications" hidden>
      <label>表示秒数 <input type="range" id="duration" min="1000" max="10000" step="500" /> <span id="durationVal"></span></label>
      <label><input type="checkbox" data-ev="Stop" /> タスク完了</label>
      <label><input type="checkbox" data-ev="Notification" /> 許可待ち</label>
      <label><input type="checkbox" data-ev="toolUse" /> ツール実行（キャラ変化）</label>
      <label><input type="checkbox" data-ev="subagent" /> サブエージェント完了</label>
    </section>
    <section data-panel="appearance" hidden>
      <label><input type="checkbox" id="hoverReveal" /> ホバーで表示</label>
      <label>位置 <select id="preset">
        <option value="top-center">上中央</option><option value="top-left">上左</option><option value="top-right">上右</option>
        <option value="left-center">左端中央</option><option value="right-center">右端中央</option></select></label>
      <label>サイズ <select id="size"><option value="small">小</option><option value="medium">中</option><option value="large">大</option></select></label>
      <label>横オフセット <input type="number" id="offsetX" /></label>
      <label>縦オフセット <input type="number" id="offsetY" /></label>
      <label>モニター <select id="displayId"></select></label>
    </section>
    <section data-panel="character" hidden>
      <label><input type="checkbox" id="charEnabled" /> キャラクターを表示</label>
    </section>
    <section data-panel="advanced" hidden>
      <p>テスト通知：</p>
      <button data-test="Stop">完了</button>
      <button data-test="Notification">許可待ち</button>
      <button data-test="PreToolUse">作業中</button>
      <button data-test="SubagentStop">サブ完了</button>
    </section>
  </main>
  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 9: Create `src/renderer/settings/settings.css`** (any clean, readable styling)

```css
body { font-family:"Segoe UI",system-ui,sans-serif; margin:0; display:flex; min-height:100vh; background:#16181f; color:#eee; }
#tabs { display:flex; flex-direction:column; background:#0f1116; padding:12px 0; min-width:120px; }
#tabs button { background:none; border:0; color:#aaa; padding:10px 16px; text-align:left; cursor:pointer; }
#tabs button.active { color:#fff; background:#d97757; }
main { flex:1; padding:24px; }
section { display:flex; flex-direction:column; gap:14px; max-width:480px; }
label { display:flex; align-items:center; gap:8px; }
input,select { background:#222; border:1px solid #333; color:#eee; padding:4px 6px; border-radius:6px; }
button { cursor:pointer; }
pre { background:#0f1116; padding:10px; border-radius:8px; white-space:pre-wrap; font-size:11px; }
```

- [ ] **Step 10: Create `src/renderer/settings/settings.js`**

```js
let settings = null;
const $ = (s) => document.querySelector(s);

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('section').forEach((s) => { s.hidden = s.dataset.panel !== b.dataset.tab; });
}));

async function save(partial) { settings = await window.api.setSettings(partial); }

async function refreshHooks() {
  const st = await window.api.hooksStatus();
  $('#hooksStatus').textContent = st.installed ? '✅ 登録済み' : '⚠ 未登録';
  $('#snippet').textContent = st.command;
}

async function init() {
  settings = await window.api.getSettings();
  $('#autostart').checked = settings.general.autostart;
  $('#theme').value = settings.general.theme;
  $('#port').value = settings.connection.port;
  $('#duration').value = settings.notifications.durationMs;
  $('#durationVal').textContent = settings.notifications.durationMs + 'ms';
  document.querySelectorAll('[data-ev]').forEach((c) => { c.checked = settings.notifications.events[c.dataset.ev]; });
  $('#hoverReveal').checked = settings.appearance.hoverReveal;
  $('#preset').value = settings.appearance.preset;
  $('#size').value = settings.appearance.size;
  $('#offsetX').value = settings.appearance.offsetX;
  $('#offsetY').value = settings.appearance.offsetY;
  $('#charEnabled').checked = settings.character.enabled;

  const displays = await window.api.listDisplays();
  $('#displayId').innerHTML = '<option value="">プライマリ</option>' +
    displays.map((d) => `<option value="${d.id}">${d.label}</option>`).join('');
  $('#displayId').value = settings.appearance.displayId || '';

  await refreshHooks();

  $('#autostart').addEventListener('change', (e) => save({ general: { autostart: e.target.checked } }));
  $('#theme').addEventListener('change', (e) => save({ general: { theme: e.target.value } }));
  $('#port').addEventListener('change', (e) => save({ connection: { port: Number(e.target.value) } }).then(refreshHooks));
  $('#duration').addEventListener('input', (e) => { $('#durationVal').textContent = e.target.value + 'ms'; save({ notifications: { durationMs: Number(e.target.value) } }); });
  document.querySelectorAll('[data-ev]').forEach((c) => c.addEventListener('change', () => save({ notifications: { events: { [c.dataset.ev]: c.checked } } })));
  $('#hoverReveal').addEventListener('change', (e) => save({ appearance: { hoverReveal: e.target.checked } }));
  $('#preset').addEventListener('change', (e) => save({ appearance: { preset: e.target.value } }));
  $('#size').addEventListener('change', (e) => save({ appearance: { size: e.target.value } }));
  $('#offsetX').addEventListener('change', (e) => save({ appearance: { offsetX: Number(e.target.value) } }));
  $('#offsetY').addEventListener('change', (e) => save({ appearance: { offsetY: Number(e.target.value) } }));
  $('#displayId').addEventListener('change', (e) => save({ appearance: { displayId: e.target.value ? Number(e.target.value) : null } }));
  $('#charEnabled').addEventListener('change', (e) => save({ character: { enabled: e.target.checked } }));
  $('#installHooks').addEventListener('click', async () => { await window.api.hooksInstall(); await refreshHooks(); });
  document.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => window.api.testEvent(b.dataset.test)));
}
init();
```

- [ ] **Step 11: Add `openSettings()` + IPC registration + settings re-apply in `main.js`**

Replace the temporary `function openSettings() {}` stub with:
```js
let settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 720, height: 560, title: 'Claude Notch 設定',
    webPreferences: { preload: path.join(__dirname, '../preload/settings-preload.js') },
  });
  settingsWin.loadFile(path.join(__dirname, '../renderer/settings/settings.html'));
}
```
Add `applySettings()` so live edits take effect:
```js
async function applySettings(next) {
  const portChanged = next.connection.port !== settings.connection.port
    || next.connection.token !== settings.connection.token;
  settings = next;
  positionNotch();
  applyAutostart();
  if (tray) tray.setDnd(settings.notifications.dnd);
  if (portChanged) {
    await server.stop();
    server = createEventServer({ port: settings.connection.port, token: settings.connection.token, onEvent: handleEvent });
    await server.start();
  }
}
```
Register IPC at the end of `app.whenReady()`:
```js
  const { registerIpc } = require('./ipc');
  registerIpc({
    getSettings: () => settings,
    setSettings: (next) => { applySettings(next); },
    settingsPath: SETTINGS_PATH,
    notchSend: (payload) => notchWin.webContents.send('notch:display', payload),
    scriptPath: path.join(__dirname, '../../hooks/notify.js'),
    getPort: () => server.port,
  });
```

- [ ] **Step 12: Run full test suite**

Run: `npm test`
Expected: PASS — all suites (settings-store, event-mapper, event-server, position, hover, hooks-installer, payload, duration).

- [ ] **Step 13: Manually verify settings end-to-end**

Run: `npm start`, open settings via tray → 設定を開く.
- Switch 位置 to 右端中央 → notch jumps to the right edge (vertical pill).
- 詳細 tab → click テスト通知 buttons → notch reacts each time.
- 接続 tab → click "Hooks をワンクリック登録" → status shows ✅ 登録済み; verify `~/.claude/settings.json` now contains the notify command for all 5 events (and any pre-existing hooks are intact).
- Change ポート → server restarts; the snippet updates to the new port.

- [ ] **Step 14: Commit**

```bash
git add src/main/ipc.js src/main/notify-policy.js src/preload/settings-preload.js src/renderer/settings/ src/main/main.js test/duration.test.js
git commit -m "feat: settings window, IPC, hooks one-click install, test notifications"
```

---

### Task 11: Packaging + README + final E2E

**Files:**
- Modify: `package.json` (electron-builder `build` block)
- Create: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a Windows installer under `dist/`.

- [ ] **Step 1: Add electron-builder config to `package.json`**

Add a top-level `"build"` key:
```json
"build": {
  "appId": "com.claudenotch.app",
  "productName": "Claude Notch",
  "files": ["src/**/*", "hooks/**/*", "assets/**/*", "package.json"],
  "win": { "target": "nsis" },
  "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
}
```

- [ ] **Step 2: Write `README.md`**

Document: what it is, install, first-run (open settings → 接続 → ワンクリック登録 → restart Claude Code), settings overview, the localhost-only/port note, and that v1 is display-only.

- [ ] **Step 3: Build the installer**

Run: `npm run dist`
Expected: an NSIS installer (e.g. `dist/Claude Notch Setup 0.1.0.exe`) is produced. (Unsigned — SmartScreen will warn on first run; note this in README.)

- [ ] **Step 4: Final real E2E with Claude Code**

- Install via the built installer (or keep running `npm start`).
- In settings, register hooks and set the port.
- Restart Claude Code so it reloads `~/.claude/settings.json`.
- Run a real Claude Code task: confirm PreToolUse turns the mascot to "working", a Stop shows the "タスク完了" card for ~2.5s, and a permission prompt shows the "許可待ち" card.
- Open a second Claude Code in a different project: confirm both projects' events appear on the one notch, each card labeled with its project name.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "build: electron-builder packaging and README"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §2 events / §5 mapping → Tasks 2, 8, 10. ✓
- §3 Electron stack → Tasks 1, 8. ✓
- §4 components (EventServer/WindowManager/HoverWatcher/Tray/SettingsStore/HooksInstaller/Notch UI/Settings UI/notify script) → Tasks 3, 8, 5/8, 9, 1, 6, 8, 10, 7. ✓
- §6 display logic (hover + auto-hide + multi-session label) → Tasks 8 (notch.js, hover watch), 10. ✓
- §7 position presets incl. sides + offset + multi-monitor → Task 4, surfaced in Task 10 UI. ✓
- §8 settings 6 tabs incl. hooks one-click + test notification → Task 10. ✓
- §9 persistence → Task 1. ✓
- §10 error handling (port fallback, bad POST, unconnected, corrupt settings) → Tasks 3, 1, 9 (tray "未接続"). ✓
- §11 testing → unit tests in Tasks 1-7,10; manual/E2E in Tasks 8-11. ✓
- §12 distribution → Task 11. ✓

**Placeholder scan:** No "TBD/TODO". The Task 9→10 `openSettings()` stub is explicitly created then replaced (real code shown in both places). Tray icon is a real base64 PNG, flagged as replaceable art.

**Type consistency:** `DisplayCommand` shape from `mapToDisplay` (Task 2) is consumed identically in `notch.js` and `ipc.js`. `appearance` object shape is consistent across `computeBounds`/`triggerZone`/settings UI. `durationFor`/`eventEnabled` signatures unified in `notify-policy` (Task 10) and the Task 8 inline versions are explicitly refactored to match.

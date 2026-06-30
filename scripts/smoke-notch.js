// Renderer smoke test: loads the real notch page with the real preload and
// drives it through the actual IPC channels, asserting the renderer script
// loaded (no parse/runtime error), the contextBridge API is present, and a
// notch:display event toggles the card/character state.
//
// This guards the class of bug that unit tests cannot see: the renderer never
// executing. Run with:  npm run smoke
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
app.disableHardwareAcceleration();

const failures = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 480, height: 140, show: false,
    webPreferences: { preload: path.join(ROOT, 'src/preload/notch-preload.js') },
  });

  win.webContents.on('console-message', (_e, _lvl, msg) => {
    if (/SyntaxError|ReferenceError|TypeError|Uncaught/.test(msg)) failures.push('renderer console error: ' + msg);
  });

  await win.loadFile(path.join(ROOT, 'src/renderer/notch/notch.html'));

  const api = JSON.parse(await win.webContents.executeJavaScript(
    `JSON.stringify({ type: typeof window.notch,
      onDisplay: typeof (window.notch && window.notch.onDisplay),
      onHover: typeof (window.notch && window.notch.onHover),
      onPos: typeof (window.notch && window.notch.onPos) })`,
  ));
  if (api.type !== 'object') failures.push('window.notch is not an object (got ' + api.type + ')');
  if (api.onDisplay !== 'function') failures.push('window.notch.onDisplay is not a function');
  if (api.onHover !== 'function') failures.push('window.notch.onHover is not a function');
  if (api.onPos !== 'function') failures.push('window.notch.onPos is not a function');

  // Card event via real IPC.
  win.webContents.send('notch:pos', 'top-center');
  win.webContents.send('notch:display', {
    cmd: { kind: 'card', variant: 'wait', badge: 'b', title: 't', sub: 's', project: 'p' },
    durationMs: 5000,
  });
  await wait(600);
  const cardCls = await win.webContents.executeJavaScript(`document.getElementById('notch').className`);
  if (!/\bcard\b/.test(cardCls) || !/\bshown\b/.test(cardCls)) {
    failures.push('notch did not become card+shown after notch:display (className=' + cardCls + ')');
  }

  // Character event via real IPC.
  win.webContents.send('notch:display', { cmd: { kind: 'character', state: 'working' }, durationMs: 1500 });
  await wait(200);
  const mascotCls = await win.webContents.executeJavaScript(`document.getElementById('mascot').className`);
  if (!/working/.test(mascotCls)) failures.push('mascot did not switch to working (className=' + mascotCls + ')');

  if (failures.length) {
    console.error('SMOKE FAIL:\n - ' + failures.join('\n - '));
    app.exit(1);
  } else {
    console.log('SMOKE OK: renderer loads, contextBridge API present, IPC display toggles card + character');
    app.exit(0);
  }
});

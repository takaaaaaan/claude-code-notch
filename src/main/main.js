const { app, BrowserWindow, screen, nativeTheme } = require('electron');
const path = require('node:path');
const { loadSettings, saveSettings } = require('./settings-store');
const { createEventServer } = require('./event-server');
const { mapToDisplay } = require('./event-mapper');
const { computeStageBounds } = require('./position');
const { triggerZone, isInZone } = require('./hover');
const { createTray } = require('./tray-controller');
const { durationFor, eventEnabled } = require('./notify-policy');

const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

let notchWin = null;
let settingsWin = null;
let settings = null;
let server = null;
let hoverInterval = null;
let lastHover = false;
let tray = null;

function getDisplay() {
  const id = settings.appearance.displayId;
  const displays = screen.getAllDisplays();
  return displays.find((d) => d.id === id) || screen.getPrimaryDisplay();
}

function positionNotch() {
  const display = getDisplay();
  const b = computeStageBounds(settings.appearance, display);
  notchWin.setBounds(b);
}

function sendPos() {
  if (notchWin && !notchWin.isDestroyed()) {
    notchWin.webContents.send('notch:pos', settings.appearance.preset);
  }
}

function createNotch() {
  notchWin = new BrowserWindow({
    width: 480, height: 140, frame: false, transparent: true, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, '../preload/notch-preload.js') },
  });
  notchWin.setAlwaysOnTop(true, 'screen-saver');
  // Display-only: the notch never receives clicks. Make the (large, mostly
  // transparent) stage click-through so it doesn't block the desktop beneath it.
  // Hover reveal still works because it polls the global cursor position.
  notchWin.setIgnoreMouseEvents(true);
  notchWin.webContents.on('did-finish-load', () => sendPos());
  notchWin.loadFile(path.join(__dirname, '../renderer/notch/notch.html'));
  positionNotch();
}

function handleEvent(ev) {
  if (settings.notifications.dnd) return;
  if (!eventEnabled(settings, ev.event)) return;
  const cmd = mapToDisplay(ev);
  if (cmd.kind === 'character' && !settings.character.enabled) return;
  notchWin.webContents.send('notch:display', { cmd, durationMs: durationFor(settings, ev.event) });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 720, height: 560, title: 'Claude Notch 設定',
    webPreferences: { preload: path.join(__dirname, '../preload/settings-preload.js') },
  });
  settingsWin.loadFile(path.join(__dirname, '../renderer/settings/settings.html'));
}

function applyAutostart() {
  app.setLoginItemSettings({ openAtLogin: !!settings.general.autostart });
}

async function applySettings(next) {
  const portChanged = next.connection.port !== settings.connection.port
    || next.connection.token !== settings.connection.token;
  settings = next;
  positionNotch();
  sendPos();
  applyAutostart();
  nativeTheme.themeSource = settings.general.theme;
  if (tray) tray.setDnd(settings.notifications.dnd);
  if (portChanged) {
    await server.stop();
    server = createEventServer({ port: settings.connection.port, token: settings.connection.token, onEvent: handleEvent });
    await server.start();
  }
  if (hoverInterval) { clearInterval(hoverInterval); hoverInterval = null; }
  lastHover = false;
  startHoverWatch();
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
  nativeTheme.themeSource = settings.general.theme;
  createNotch();
  server = createEventServer({
    port: settings.connection.port,
    token: settings.connection.token,
    onEvent: handleEvent,
  });
  await server.start();
  startHoverWatch();
  tray = createTray({
    onOpenSettings: () => openSettings(),
    onQuit: () => {
      if (hoverInterval) clearInterval(hoverInterval);
      if (tray) tray.destroy();
      app.exit(0);
    },
    onToggleDnd: () => {
      settings.notifications.dnd = !settings.notifications.dnd;
      saveSettings(SETTINGS_PATH(), settings);
      tray.setDnd(settings.notifications.dnd);
    },
  });
  tray.setConnected(true);
  applyAutostart();

  const { registerIpc } = require('./ipc');
  registerIpc({
    getSettings: () => settings,
    setSettings: async (next) => { await applySettings(next); },
    settingsPath: SETTINGS_PATH,
    notchSend: (payload) => notchWin.webContents.send('notch:display', payload),
    scriptPath: path.join(__dirname, '../../hooks/notify.js'),
    getPort: () => server.port,
  });
});

app.on('window-all-closed', (e) => { e.preventDefault(); }); // stay resident in tray (Task 11)

module.exports = {};

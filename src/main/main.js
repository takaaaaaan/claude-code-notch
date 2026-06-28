const { app, BrowserWindow, screen } = require('electron');
const path = require('node:path');
const { loadSettings, saveSettings } = require('./settings-store');
const { createEventServer } = require('./event-server');
const { mapToDisplay } = require('./event-mapper');
const { computeBounds } = require('./position');
const { triggerZone, isInZone } = require('./hover');
const { createTray } = require('./tray-controller');

const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

let notchWin = null;
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

function openSettings() {
  // Stub — real implementation comes in Task 10
}

function applyAutostart() {
  app.setLoginItemSettings({ openAtLogin: !!settings.general.autostart });
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
});

app.on('window-all-closed', (e) => { e.preventDefault(); }); // stay resident in tray (Task 11)

module.exports = { __test: { durationFor: () => durationFor } };

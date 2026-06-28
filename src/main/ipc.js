const { ipcMain, screen } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeWithDefaults, saveSettings, deepMerge } = require('./settings-store');
const { isInstalled, mergeHooks, buildHookCommand } = require('./hooks-installer');
const { normalizeEvent, mapToDisplay } = require('./event-mapper');
const { durationFor } = require('./notify-policy');

const claudeSettingsPath = () => path.join(os.homedir(), '.claude', 'settings.json');

function registerIpc({ getSettings, setSettings, settingsPath, notchSend, scriptPath, getPort }) {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', async (_e, partial) => {
    const next = mergeWithDefaults(deepMerge(getSettings(), partial));
    await setSettings(next);
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

const { ipcMain, screen } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeWithDefaults, saveSettings, deepMerge } = require('./settings-store');
const { isInstalled, mergeHooks, buildHookCommand, parseExistingSettings } = require('./hooks-installer');
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
    screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `#${i + 1} · ${d.size.width}×${d.size.height}` })));

  ipcMain.handle('hooks:status', () => {
    let raw = null;
    try { raw = fs.readFileSync(claudeSettingsPath(), 'utf8'); } catch { raw = null; }
    const { settings: claude, parseError } = parseExistingSettings(raw);
    const command = buildHookCommand(scriptPath, getPort());
    if (parseError) return { installed: false, parseError: true, command, claudeSettingsPath: claudeSettingsPath() };
    return { installed: isInstalled(claude, scriptPath), command, claudeSettingsPath: claudeSettingsPath() };
  });

  ipcMain.handle('hooks:install', () => {
    let raw = null;
    try { raw = fs.readFileSync(claudeSettingsPath(), 'utf8'); } catch { raw = null; }
    const { settings: claude, parseError } = parseExistingSettings(raw);
    if (parseError) {
      return { ok: false, error: 'parseError' };
    }
    const merged = mergeHooks(claude, scriptPath, getPort());
    fs.mkdirSync(path.dirname(claudeSettingsPath()), { recursive: true });
    fs.writeFileSync(claudeSettingsPath(), JSON.stringify(merged, null, 2), 'utf8');
    return { ok: true, installed: true };
  });

  ipcMain.handle('test:event', (_e, eventName) => {
    const ev = normalizeEvent({ event: eventName, project: 'test' });
    if (!ev) return { ok: false };
    const lang = getSettings().general.language;
    notchSend({ cmd: mapToDisplay(ev, lang), durationMs: durationFor(getSettings(), eventName) });
    return { ok: true };
  });
}

module.exports = { registerIpc };

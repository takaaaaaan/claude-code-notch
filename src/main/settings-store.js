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

module.exports = { DEFAULT_SETTINGS, mergeWithDefaults, loadSettings, saveSettings, deepMerge };

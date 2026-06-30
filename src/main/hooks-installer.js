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

// Recognize OUR hook regardless of where notify.js lives (source checkout,
// app.asar, or app.asar.unpacked). Used so install/remove operate on every
// claude-notch entry, not just the one matching the current path — this also
// lets a reinstall replace a stale/broken (e.g. asar) entry.
const OUR_HOOK_RE = /[\\/]hooks[\\/]notify\.js/;
function groupIsOurs(group) {
  return (group.hooks || []).some((h) => typeof h.command === 'string' && OUR_HOOK_RE.test(h.command));
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
      ? next.hooks[ev].filter((g) => !groupIsOurs(g))
      : [];
    next.hooks[ev] = [...kept, ...fragment[ev]];
  }
  return next;
}

// Remove every claude-notch hook entry from all events, preserving foreign
// hooks. Drops emptied event arrays (and the hooks object if it ends up empty).
function removeHooks(settings) {
  const next = JSON.parse(JSON.stringify(settings || {}));
  if (!next.hooks) return next;
  for (const ev of HOOK_EVENTS) {
    if (!Array.isArray(next.hooks[ev])) continue;
    const kept = next.hooks[ev].filter((g) => !groupIsOurs(g));
    if (kept.length) next.hooks[ev] = kept;
    else delete next.hooks[ev];
  }
  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

function parseExistingSettings(raw) {
  // raw: string|null  -> { settings, parseError }
  if (raw == null || String(raw).trim() === '') return { settings: {}, parseError: null };
  try { return { settings: JSON.parse(raw), parseError: null }; }
  catch (e) { return { settings: null, parseError: e.message }; }
}

// In a packaged Electron app the hook script lives inside app.asar, which an
// external `node` process cannot read. electron-builder's asarUnpack extracts
// hooks/ to app.asar.unpacked; point the hook command at that real file.
function unpackedScriptPath(p) {
  return /app\.asar[\\/]/.test(p) ? p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1') : p;
}

module.exports = { HOOK_EVENTS, buildHookCommand, buildHooksFragment, isInstalled, mergeHooks, removeHooks, parseExistingSettings, unpackedScriptPath };

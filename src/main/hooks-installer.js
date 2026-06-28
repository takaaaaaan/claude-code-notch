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

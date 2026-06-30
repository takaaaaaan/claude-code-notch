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

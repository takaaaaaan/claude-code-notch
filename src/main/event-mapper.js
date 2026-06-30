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

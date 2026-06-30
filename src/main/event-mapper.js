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

// Default card text per language. The card's `sub` falls back to these when the
// hook itself carries no message (that message is produced by Claude Code and
// stays in whatever language it used).
const CARD_STRINGS = {
  en: { doneBadge: 'Done', doneTitle: 'Task complete', doneSub: 'The response finished',
        waitBadge: 'Waiting', waitTitle: 'Your response is needed', waitSub: 'Waiting for your response' },
  ja: { doneBadge: '完了', doneTitle: 'タスク完了', doneSub: '応答が完了しました',
        waitBadge: '許可待ち', waitTitle: 'あなたの応答が必要', waitSub: '応答を待っています' },
  ko: { doneBadge: '완료', doneTitle: '작업 완료', doneSub: '응답이 완료되었습니다',
        waitBadge: '대기', waitTitle: '응답이 필요합니다', waitSub: '응답을 기다리는 중' },
};

function mapToDisplay(event, lang) {
  const s = CARD_STRINGS[lang] || CARD_STRINGS.ja;
  switch (event.event) {
    case 'Stop':
      return { kind: 'card', variant: 'done', badge: s.doneBadge,
        title: s.doneTitle, sub: event.message || s.doneSub, project: event.project };
    case 'Notification':
      return { kind: 'card', variant: 'wait', badge: s.waitBadge,
        title: s.waitTitle, sub: event.message || s.waitSub, project: event.project };
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

module.exports = { VALID_EVENTS, normalizeEvent, mapToDisplay, CARD_STRINGS };

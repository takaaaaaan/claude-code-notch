function durationFor(settings, event) {
  const per = settings.notifications.perEventDurationMs[event];
  return typeof per === 'number' ? per : settings.notifications.durationMs;
}

function eventEnabled(settings, event) {
  const n = settings.notifications.events;
  if (event === 'Stop') return !!n.Stop;
  if (event === 'Notification') return !!n.Notification;
  if (event === 'PreToolUse' || event === 'PostToolUse') return !!n.toolUse;
  if (event === 'SubagentStop') return !!n.subagent;
  return true;
}

module.exports = { durationFor, eventEnabled };

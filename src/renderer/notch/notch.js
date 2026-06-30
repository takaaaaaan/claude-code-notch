const el = (id) => document.getElementById(id);
// NOTE: do not name this `notch` — the preload exposes a non-configurable
// global `window.notch` (the IPC API) via contextBridge, and a top-level
// `const notch` collides with it ("Identifier 'notch' has already been
// declared"), which aborts this whole script and leaves the notch dead.
const notchEl = el('notch');
let hideTimer = null;
let hovering = false;

function show() { notchEl.classList.add('shown'); }
function hideSoon(ms) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (!hovering) notchEl.classList.remove('shown'); }, ms);
}

function setCharacter(state) {
  el('mascot').className = 'mascot ' + state;
  el('mascot').textContent = { idle: '🤖', working: '🛠️', sub: '👥', done: '✅', wait: '⏳' }[state] || '🤖';
}

function showCard(cmd, durationMs) {
  notchEl.classList.add('card');
  el('compact').classList.add('hidden'); el('dot').classList.add('hidden');
  el('card').classList.remove('hidden'); el('badge').classList.remove('hidden'); el('sess').classList.remove('hidden');
  el('badge').className = 'badge ' + cmd.variant; el('badge').textContent = cmd.badge;
  el('kTitle').textContent = cmd.title; el('kSub').textContent = cmd.sub;
  el('sess').textContent = cmd.project || '';
  setCharacter(cmd.variant === 'done' ? 'done' : 'wait');
  show(); hideSoon(durationMs);
}

function showCharacterOnly(state) {
  notchEl.classList.remove('card');
  el('card').classList.add('hidden'); el('badge').classList.add('hidden'); el('sess').classList.add('hidden');
  el('compact').classList.remove('hidden'); el('dot').classList.remove('hidden');
  setCharacter(state);
  // character changes are subtle: reveal briefly, then retreat (unless hovering)
  show(); hideSoon(1500);
}

window.notch.onDisplay(({ cmd, durationMs }) => {
  if (cmd.kind === 'card') showCard(cmd, durationMs);
  else showCharacterOnly(cmd.state);
});
window.notch.onHover((isHover) => {
  hovering = isHover;
  if (isHover) { clearTimeout(hideTimer); show(); }
  else hideSoon(300);
});
window.notch.onPos((preset) => {
  document.body.dataset.pos = preset || 'top-center';
});

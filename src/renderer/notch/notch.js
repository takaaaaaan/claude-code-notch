const el = (id) => document.getElementById(id);
const notch = el('notch');
let hideTimer = null;
let hovering = false;

function show() { notch.classList.add('shown'); }
function hideSoon(ms) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (!hovering) notch.classList.remove('shown'); }, ms);
}

function setCharacter(state) {
  el('mascot').className = 'mascot ' + state;
  el('mascot').textContent = { idle: '🤖', working: '🛠️', sub: '👥', done: '✅', wait: '⏳' }[state] || '🤖';
}

function showCard(cmd, durationMs) {
  notch.classList.add('card');
  el('compact').classList.add('hidden'); el('dot').classList.add('hidden');
  el('card').classList.remove('hidden'); el('badge').classList.remove('hidden'); el('sess').classList.remove('hidden');
  el('badge').className = 'badge ' + cmd.variant; el('badge').textContent = cmd.badge;
  el('kTitle').textContent = cmd.title; el('kSub').textContent = cmd.sub;
  el('sess').textContent = cmd.project || '';
  setCharacter(cmd.variant === 'done' ? 'done' : 'wait');
  show(); hideSoon(durationMs);
}

function showCharacterOnly(state) {
  notch.classList.remove('card');
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

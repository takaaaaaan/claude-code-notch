let settings = null;
const $ = (s) => document.querySelector(s);

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('section').forEach((s) => { s.hidden = s.dataset.panel !== b.dataset.tab; });
}));

async function save(partial) { settings = await window.api.setSettings(partial); }

async function refreshHooks() {
  const st = await window.api.hooksStatus();
  $('#hooksStatus').textContent = st.installed ? '✅ 登録済み' : '⚠ 未登録';
  $('#snippet').textContent = st.command;
}

async function init() {
  settings = await window.api.getSettings();
  $('#autostart').checked = settings.general.autostart;
  $('#theme').value = settings.general.theme;
  $('#port').value = settings.connection.port;
  $('#duration').value = settings.notifications.durationMs;
  $('#durationVal').textContent = settings.notifications.durationMs + 'ms';
  document.querySelectorAll('[data-ev]').forEach((c) => { c.checked = settings.notifications.events[c.dataset.ev]; });
  $('#hoverReveal').checked = settings.appearance.hoverReveal;
  $('#preset').value = settings.appearance.preset;
  $('#size').value = settings.appearance.size;
  $('#offsetX').value = settings.appearance.offsetX;
  $('#offsetY').value = settings.appearance.offsetY;
  $('#charEnabled').checked = settings.character.enabled;

  const displays = await window.api.listDisplays();
  $('#displayId').innerHTML = '<option value="">プライマリ</option>' +
    displays.map((d) => `<option value="${d.id}">${d.label}</option>`).join('');
  $('#displayId').value = settings.appearance.displayId || '';

  await refreshHooks();

  $('#autostart').addEventListener('change', (e) => save({ general: { autostart: e.target.checked } }));
  $('#theme').addEventListener('change', (e) => save({ general: { theme: e.target.value } }));
  $('#port').addEventListener('change', (e) => save({ connection: { port: Number(e.target.value) } }).then(refreshHooks));
  $('#duration').addEventListener('input', (e) => { $('#durationVal').textContent = e.target.value + 'ms'; save({ notifications: { durationMs: Number(e.target.value) } }); });
  document.querySelectorAll('[data-ev]').forEach((c) => c.addEventListener('change', () => save({ notifications: { events: { [c.dataset.ev]: c.checked } } })));
  $('#hoverReveal').addEventListener('change', (e) => save({ appearance: { hoverReveal: e.target.checked } }));
  $('#preset').addEventListener('change', (e) => save({ appearance: { preset: e.target.value } }));
  $('#size').addEventListener('change', (e) => save({ appearance: { size: e.target.value } }));
  $('#offsetX').addEventListener('change', (e) => save({ appearance: { offsetX: Number(e.target.value) } }));
  $('#offsetY').addEventListener('change', (e) => save({ appearance: { offsetY: Number(e.target.value) } }));
  $('#displayId').addEventListener('change', (e) => save({ appearance: { displayId: e.target.value ? Number(e.target.value) : null } }));
  $('#charEnabled').addEventListener('change', (e) => save({ character: { enabled: e.target.checked } }));
  $('#installHooks').addEventListener('click', async () => { await window.api.hooksInstall(); await refreshHooks(); });
  document.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => window.api.testEvent(b.dataset.test)));
}
init();

const { Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

function createTray({ onOpenSettings, onQuit, onToggleDnd }) {
  const raw = nativeImage.createFromPath(path.join(__dirname, '../../assets/icon.png'));
  const icon = raw.isEmpty() ? nativeImage.createEmpty() : raw.resize({ width: 16, height: 16 });
  const tray = new Tray(icon);
  let connected = false;
  let dnd = false;

  function rebuild() {
    tray.setToolTip(connected ? 'Claude Notch — 接続中' : 'Claude Notch — 未接続');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: connected ? '🟢 接続中' : '⚪ 未接続', enabled: false },
      { type: 'separator' },
      { label: '設定を開く', click: onOpenSettings },
      { label: '集中モード（通知停止）', type: 'checkbox', checked: dnd, click: () => onToggleDnd() },
      { type: 'separator' },
      { label: '終了', click: onQuit },
    ]));
  }
  rebuild();

  return {
    setConnected: (v) => { connected = v; rebuild(); },
    setDnd: (v) => { dnd = v; rebuild(); },
    destroy: () => tray.destroy(),
  };
}

module.exports = { createTray };

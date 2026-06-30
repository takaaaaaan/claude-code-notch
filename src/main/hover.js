const { computeBounds } = require('./position');

const SIDE = new Set(['left-center', 'right-center']);
const BOTTOM = new Set(['bottom-left', 'bottom-right']);

function triggerZone(appearance, display) {
  const b = computeBounds(appearance, display);
  const t = Math.max(1, appearance.sensitivity || 1);
  const area = display.bounds || display.workArea;

  if (SIDE.has(appearance.preset)) {
    const x = appearance.preset === 'left-center' ? area.x : area.x + area.width - t;
    return { x, y: b.y, width: t, height: b.height };
  }
  if (BOTTOM.has(appearance.preset)) {
    return { x: b.x, y: area.y + area.height - t, width: b.width, height: t };
  }
  return { x: b.x, y: area.y, width: b.width, height: t };
}

function isInZone(cursor, zone) {
  return cursor.x >= zone.x && cursor.x <= zone.x + zone.width
    && cursor.y >= zone.y && cursor.y <= zone.y + zone.height;
}

module.exports = { triggerZone, isInZone };

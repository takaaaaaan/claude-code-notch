const SIZES = {
  small: { main: 200, cross: 28 },
  medium: { main: 260, cross: 36 },
  large: { main: 340, cross: 48 },
};

const SIDE = new Set(['left-center', 'right-center']);

function computeBounds(appearance, display) {
  const { preset = 'top-center', offsetX = 0, offsetY = 0, size = 'medium' } = appearance || {};
  const area = display.workArea;
  const s = SIZES[size] || SIZES.medium;

  if (SIDE.has(preset)) {
    const width = s.cross;
    const height = s.main;
    const y = Math.round(area.y + (area.height - height) / 2) + offsetY;
    const x = preset === 'left-center' ? area.x : area.x + area.width - width;
    return { x, y, width, height };
  }

  const width = s.main;
  const height = s.cross;
  let x;
  if (preset === 'top-left') x = area.x + offsetX;
  else if (preset === 'top-right') x = area.x + area.width - width + offsetX;
  else x = Math.round(area.x + (area.width - width) / 2) + offsetX; // top-center
  const y = area.y + offsetY;
  return { x, y, width, height };
}

module.exports = { SIZES, computeBounds };

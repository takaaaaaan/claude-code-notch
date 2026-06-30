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

// The transparent host window ("stage") must be large enough to contain the
// fully-expanded notch (a card is ~60px tall and wider than the collapsed pill),
// otherwise the OS window clips the content. The visible pill is sized to its
// content by CSS and anchored inside this stage.
// Cards are horizontal (~418px wide), so even the side presets need a stage
// wide enough to hold a full card; side presets differ only by anchoring the
// pill to the left/right edge and sliding it in horizontally.
const STAGE = { topW: 480, topH: 140, sideW: 480, sideH: 200 };

function computeStageBounds(appearance, display) {
  const { preset = 'top-center', offsetX = 0, offsetY = 0 } = appearance || {};
  const area = display.workArea;

  if (SIDE.has(preset)) {
    const width = Math.min(STAGE.sideW, area.width);
    const height = Math.min(STAGE.sideH, area.height);
    const y = Math.round(area.y + (area.height - height) / 2) + offsetY;
    const x = preset === 'left-center' ? area.x : area.x + area.width - width;
    return { x, y, width, height };
  }

  const width = Math.min(STAGE.topW, area.width);
  const height = Math.min(STAGE.topH, area.height);
  let x;
  if (preset === 'top-left') x = area.x + offsetX;
  else if (preset === 'top-right') x = area.x + area.width - width + offsetX;
  else x = Math.round(area.x + (area.width - width) / 2) + offsetX; // top-center
  const y = area.y + offsetY;
  return { x, y, width, height };
}

module.exports = { SIZES, computeBounds, STAGE, computeStageBounds };

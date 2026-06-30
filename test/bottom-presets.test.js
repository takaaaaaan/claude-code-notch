const test = require('node:test');
const assert = require('node:assert');
const { computeBounds, computeStageBounds, SIZES, STAGE } = require('../src/main/position');
const { triggerZone } = require('../src/main/hover');

const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };

test('computeBounds bottom-left sits at the bottom-left corner', () => {
  const b = computeBounds({ preset: 'bottom-left', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.x, 0);
  assert.equal(b.width, SIZES.medium.main);
  assert.equal(b.height, SIZES.medium.cross);
  assert.equal(b.y, 1080 - SIZES.medium.cross);
});

test('computeBounds bottom-right sits at the bottom-right corner', () => {
  const b = computeBounds({ preset: 'bottom-right', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.x, 1920 - SIZES.medium.main);
  assert.equal(b.y, 1080 - SIZES.medium.cross);
});

test('computeStageBounds bottom-left anchors the stage to the bottom-left', () => {
  const s = computeStageBounds({ preset: 'bottom-left', offsetX: 0, offsetY: 0 }, display);
  assert.equal(s.x, 0);
  assert.equal(s.width, STAGE.topW);
  assert.equal(s.height, STAGE.topH);
  assert.equal(s.y, 1080 - STAGE.topH);
});

test('computeStageBounds bottom-right anchors the stage to the bottom-right', () => {
  const s = computeStageBounds({ preset: 'bottom-right', offsetX: 0, offsetY: 0 }, display);
  assert.equal(s.x, 1920 - STAGE.topW);
  assert.equal(s.y, 1080 - STAGE.topH);
});

test('triggerZone for a bottom preset is a thin strip at the bottom edge', () => {
  const ap = { preset: 'bottom-left', size: 'medium', sensitivity: 4, offsetX: 0, offsetY: 0 };
  const z = triggerZone(ap, display);
  assert.equal(z.y, 1080 - 4);
  assert.equal(z.height, 4);
  assert.equal(z.x, 0);
  assert.equal(z.width, SIZES.medium.main);
});

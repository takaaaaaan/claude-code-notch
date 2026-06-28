const test = require('node:test');
const assert = require('node:assert');
const { computeBounds, SIZES } = require('../src/main/position');

const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };

test('top-center medium is centered horizontally at top', () => {
  const b = computeBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.width, SIZES.medium.main);
  assert.equal(b.height, SIZES.medium.cross);
  assert.equal(b.y, 0);
  assert.equal(b.x, Math.round((1920 - SIZES.medium.main) / 2));
});

test('top-center honors offsetX', () => {
  const b = computeBounds({ preset: 'top-center', size: 'medium', offsetX: 50, offsetY: 0 }, display);
  assert.equal(b.x, Math.round((1920 - SIZES.medium.main) / 2) + 50);
});

test('top-right sits at right edge', () => {
  const b = computeBounds({ preset: 'top-right', size: 'small', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.x, 1920 - SIZES.small.main);
});

test('left-center is a vertical pill on the left edge', () => {
  const b = computeBounds({ preset: 'left-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(b.x, 0);
  assert.equal(b.width, SIZES.medium.cross);
  assert.equal(b.height, SIZES.medium.main);
  assert.equal(b.y, Math.round((1080 - SIZES.medium.main) / 2));
});

test('right-center sits at right edge with offsetY', () => {
  const b = computeBounds({ preset: 'right-center', size: 'medium', offsetX: 0, offsetY: 20 }, display);
  assert.equal(b.x, 1920 - SIZES.medium.cross);
  assert.equal(b.y, Math.round((1080 - SIZES.medium.main) / 2) + 20);
});

test('respects non-zero workArea origin (secondary monitor)', () => {
  const d2 = { workArea: { x: 1920, y: 0, width: 1280, height: 720 } };
  const b = computeBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, d2);
  assert.equal(b.x, 1920 + Math.round((1280 - SIZES.medium.main) / 2));
});

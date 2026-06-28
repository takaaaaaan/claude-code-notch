const test = require('node:test');
const assert = require('node:assert');
const { triggerZone, isInZone } = require('../src/main/hover');
const { computeBounds } = require('../src/main/position');

const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };

test('top-center zone is a thin band at y=0 spanning the notch width', () => {
  const ap = { preset: 'top-center', size: 'medium', sensitivity: 4, offsetX: 0, offsetY: 0 };
  const z = triggerZone(ap, display);
  const b = computeBounds(ap, display);
  assert.equal(z.y, 0);
  assert.equal(z.height, 4);
  assert.equal(z.x, b.x);
  assert.equal(z.width, b.width);
});

test('left-center zone is a thin vertical band at x=0', () => {
  const ap = { preset: 'left-center', size: 'medium', sensitivity: 6, offsetX: 0, offsetY: 0 };
  const z = triggerZone(ap, display);
  assert.equal(z.x, 0);
  assert.equal(z.width, 6);
});

test('sensitivity below 1 clamps to 1', () => {
  const ap = { preset: 'top-center', size: 'medium', sensitivity: 0, offsetX: 0, offsetY: 0 };
  assert.equal(triggerZone(ap, display).height, 1);
});

test('isInZone detects inside and outside', () => {
  const z = { x: 10, y: 0, width: 100, height: 4 };
  assert.equal(isInZone({ x: 50, y: 2 }, z), true);
  assert.equal(isInZone({ x: 50, y: 10 }, z), false);
  assert.equal(isInZone({ x: 200, y: 2 }, z), false);
});

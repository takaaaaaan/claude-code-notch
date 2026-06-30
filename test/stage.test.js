const test = require('node:test');
const assert = require('node:assert');
const { computeStageBounds, STAGE } = require('../src/main/position');

const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };

test('stage for top-center fits a card, sits at top, centered', () => {
  const s = computeStageBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(s.y, 0);
  assert.ok(s.height >= 80, 'stage must be tall enough for a card');
  assert.equal(s.height, STAGE.topH);
  assert.equal(s.width, STAGE.topW);
  assert.equal(s.x, Math.round((1920 - STAGE.topW) / 2));
});

test('stage for top-right anchors to right edge', () => {
  const s = computeStageBounds({ preset: 'top-right', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(s.x, 1920 - STAGE.topW);
  assert.equal(s.y, 0);
});

test('stage for left-center is tall, anchored left, vertically centered', () => {
  const s = computeStageBounds({ preset: 'left-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(s.x, 0);
  assert.equal(s.width, STAGE.sideW);
  assert.equal(s.height, STAGE.sideH);
  assert.equal(s.y, Math.round((1080 - STAGE.sideH) / 2));
});

test('stage for right-center anchors to right edge', () => {
  const s = computeStageBounds({ preset: 'right-center', size: 'medium', offsetX: 0, offsetY: 0 }, display);
  assert.equal(s.x, 1920 - STAGE.sideW);
});

test('stage clamps to a small display work area', () => {
  const small = { workArea: { x: 0, y: 0, width: 320, height: 240 } };
  const s = computeStageBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, small);
  assert.equal(s.width, 320);
  assert.ok(s.height <= 240);
});

test('stage honors a secondary monitor origin', () => {
  const d2 = { workArea: { x: 1920, y: 0, width: 1280, height: 720 } };
  const s = computeStageBounds({ preset: 'top-center', size: 'medium', offsetX: 0, offsetY: 0 }, d2);
  assert.equal(s.x, 1920 + Math.round((1280 - STAGE.topW) / 2));
});

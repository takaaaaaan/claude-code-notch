const test = require('node:test');
const assert = require('node:assert');
const { normalizeEvent, mapToDisplay, CARD_STRINGS } = require('../src/main/event-mapper');

test('mapToDisplay defaults to Japanese when lang is omitted', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Stop' }));
  assert.equal(d.title, 'タスク完了');
  assert.equal(d.badge, '完了');
});

test('mapToDisplay localizes the Stop card to English', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Stop' }), 'en');
  assert.equal(d.title, 'Task complete');
  assert.equal(d.badge, 'Done');
});

test('mapToDisplay localizes the Notification card to Korean', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Notification' }), 'ko');
  assert.equal(d.title, '응답이 필요합니다');
  assert.equal(d.badge, '대기');
});

test('mapToDisplay falls back to ja for an unknown language', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Stop' }), 'zz');
  assert.equal(d.title, 'タスク完了');
});

test('a hook-provided message still overrides the localized default sub', () => {
  const d = mapToDisplay(normalizeEvent({ event: 'Stop', message: 'custom message' }), 'en');
  assert.equal(d.sub, 'custom message');
});

test('CARD_STRINGS define all three languages', () => {
  for (const l of ['en', 'ja', 'ko']) {
    assert.ok(CARD_STRINGS[l].doneTitle && CARD_STRINGS[l].waitTitle);
  }
});

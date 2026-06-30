const test = require('node:test');
const assert = require('node:assert');
const I18N = require('../src/renderer/settings/i18n');

test('i18n provides en, ja, ko', () => {
  for (const l of ['en', 'ja', 'ko']) assert.ok(I18N[l], 'missing language ' + l);
});

test('all languages have identical key sets (no missing translations)', () => {
  const enKeys = Object.keys(I18N.en).sort();
  for (const l of ['ja', 'ko']) {
    assert.deepEqual(Object.keys(I18N[l]).sort(), enKeys, 'key mismatch in ' + l);
  }
});

test('no translation is empty', () => {
  for (const l of ['en', 'ja', 'ko']) {
    for (const k of Object.keys(I18N[l])) {
      assert.ok(I18N[l][k].length > 0, `${l}.${k} is empty`);
    }
  }
});

test('status.listening keeps the {port} placeholder in every language', () => {
  for (const l of ['en', 'ja', 'ko']) {
    assert.ok(I18N[l]['status.listening'].includes('{port}'), `${l} lost {port}`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { plural, seatsPhrase, SEAT_FORMS } from '../../src/js/lib/plural.mjs';

test('plural forms for seats', () => {
  const cases = { 1: 'место', 2: 'места', 4: 'места', 5: 'мест', 10: 'мест', 11: 'мест', 21: 'место', 22: 'места', 25: 'мест' };
  for (const [n, form] of Object.entries(cases)) assert.equal(plural(Number(n), SEAT_FORMS), form, `n=${n}`);
});

test('seatsPhrase uses the content template', () => {
  assert.equal(seatsPhrase(1), 'Осталось 1 место на этой неделе');
  assert.equal(seatsPhrase(4), 'Осталось 4 места на этой неделе');
  assert.equal(seatsPhrase(7), 'Осталось 7 мест на этой неделе');
  assert.equal(seatsPhrase(3, 'Осталось {n} {seats} в этом наборе'), 'Осталось 3 места в этом наборе');
});

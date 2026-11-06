import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, reduce, stepErrors, tutorsForStep, validators } from '../../src/js/quiz-state.mjs';
import segment from '../../src/content/segments/5-9.json' with { type: 'json' };
import tutors from '../../src/content/tutors.json' with { type: 'json' };

const tutorsById = Object.fromEntries(tutors.map(tutor => [tutor.id, tutor]));
const NOW = 1_794_000_000_000;
const SLOT = { startsAt: '2026-11-12T18:00:00+03:00', label: 'чт, 12 нояб., 18:00 МСК', short: 'чт, 18:00' };
const init = (query = '') => createInitialState({ segment, params: new URLSearchParams(query), tutorsById });

test('default grade: ?grade in range, otherwise segment.defaultGrade', () => {
  assert.equal(init().grade, 7);
  assert.equal(init('?grade=9').grade, 9);
  assert.equal(init('?grade=12').grade, 7);
  assert.equal(init().subject, 'math');
  assert.equal(init('?subject=russian').subject, 'russian');
});

test('step 2 shows at most 3 tutors, the preferred one first', () => {
  assert.deepEqual(tutorsForStep({ segment, subject: 'math', tutorsById }).map(t => t.id), ['roman-yurievich', 'amet-memetovich', 'galina-vladimirovna']);
  assert.deepEqual(tutorsForStep({ segment, subject: 'math', tutorsById, preferredId: 'rustam-ravilevich' }).map(t => t.id), ['rustam-ravilevich', 'roman-yurievich', 'amet-memetovich']);
  assert.deepEqual(tutorsForStep({ segment, subject: 'russian', tutorsById }).map(t => t.id), ['russian-match']);
  assert.equal(init('?tutor=rustam-ravilevich').tutorId, 'rustam-ravilevich');
  assert.equal(init('?tutor=nobody').tutorId, null);
});

test('transitions: 1 → 2 → 3, back keeps everything', () => {
  let state = init();
  state = reduce(state, { type: 'next', now: NOW });
  assert.equal(state.step, 2);
  state = reduce(state, { type: 'next', now: NOW });
  assert.equal(state.step, 2, 'cannot leave step 2 without tutor and slot');
  state = reduce(state, { type: 'tutor', tutorId: 'amet-memetovich' });
  state = reduce(state, { type: 'slot', slot: SLOT, now: NOW, holdMinutes: 10 });
  assert.equal(state.holdExpiresAt, NOW + 600000);
  state = reduce(state, { type: 'next', now: NOW + 1000 });
  assert.equal(state.step, 3);
  state = reduce(state, { type: 'field', name: 'name', value: 'Мария' });
  state = reduce(state, { type: 'back' });
  assert.equal(state.step, 2);
  assert.equal(state.name, 'Мария');
  assert.equal(state.tutorId, 'amet-memetovich');
  assert.deepEqual(state.slot, SLOT);
});

test('changing subject drops a tutor who does not teach it', () => {
  let state = reduce(init(), { type: 'tutor', tutorId: 'roman-yurievich' });
  state = reduce(state, { type: 'slot', slot: SLOT, now: NOW, holdMinutes: 10 });
  state = reduce(state, { type: 'subject', subject: 'russian' });
  assert.equal(state.tutorId, null);
  assert.equal(state.slot, null);
});

test('hold expiry drops the slot but keeps contacts', () => {
  let state = reduce(init(), { type: 'tutor', tutorId: 'roman-yurievich' });
  state = reduce(state, { type: 'slot', slot: SLOT, now: NOW, holdMinutes: 10 });
  state = reduce(state, { type: 'field', name: 'phone', value: '+7 (912) 345-67-89' });
  state = reduce(state, { type: 'holdExpired' });
  assert.equal(state.slot, null);
  assert.equal(state.holdExpiresAt, null);
  assert.equal(state.notice, 'hold-expired');
  assert.equal(state.phone, '+7 (912) 345-67-89');
  assert.ok(stepErrors({ ...state, step: 2 }, 2, NOW).slot);
});

test('submission flow: failure returns to step 3 with data intact', () => {
  let state = { ...init(), step: 3, name: 'Мария' };
  state = reduce(state, { type: 'submitting' });
  assert.equal(state.status, 'submitting');
  state = reduce(state, { type: 'failure', code: 'upstream_timeout' });
  assert.equal(state.status, 'error');
  assert.equal(state.step, 3);
  assert.equal(state.name, 'Мария');
  state = reduce(state, { type: 'success', bookingId: 'TO-ABC234', promoCode: 'P' });
  assert.equal(state.status, 'ticket');
  assert.equal(state.bookingId, 'TO-ABC234');
});

test('field validators', () => {
  assert.equal(validators.name('Мария'), '');
  assert.equal(validators.name('Анна-Мария Петрова'), '');
  assert.notEqual(validators.name('М'), '');
  assert.notEqual(validators.name('Maria123'), '');
  assert.equal(validators.phone('+7 (912) 345-67-89'), '');
  assert.notEqual(validators.phone('+7 (912) 345'), '');
  assert.equal(validators.email(''), '');
  assert.equal(validators.email('a@b.ru'), '');
  assert.notEqual(validators.email('a@b'), '');
  assert.notEqual(validators.commitment(false), '');
  assert.notEqual(validators.consentPd(false), '');
  const errors = stepErrors({ ...init(), step: 3, name: 'Мария', phone: '+7 (912) 345-67-89', commitment: true, consentPd: true }, 3, NOW);
  assert.deepEqual(errors, {});
});

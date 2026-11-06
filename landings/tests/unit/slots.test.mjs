import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots } from '../../src/js/lib/slots.mjs';
import schedule from '../../src/content/schedule.json' with { type: 'json' };

const at = iso => Date.parse(iso);

test('three nearest days with slots, first slot not earlier than now + 3 h', () => {
  // Tuesday 10.11.2026 15:30 MSK → 18:30 is the earliest allowed, so 19:00 and 20:00 remain today.
  const days = buildSlots({ weekly: schedule.weekly, tutorId: 'roman-yurievich', now: at('2026-11-10T12:30:00Z') });
  assert.equal(days.length, 3);
  assert.deepEqual(days[0].slots.map(slot => slot.time), ['19:00', '20:00']);
  assert.equal(days[0].slots[0].startsAt, '2026-11-10T19:00:00+03:00');
  assert.equal(days[1].date, '2026-11-11');
  assert.equal(days[2].date, '2026-11-12');
});

test('a day without remaining slots is skipped', () => {
  // Tuesday 18:30 MSK: nothing left today (need ≥ 21:30).
  const days = buildSlots({ weekly: schedule.weekly, tutorId: 'x', now: at('2026-11-10T15:30:00Z') });
  assert.equal(days[0].date, '2026-11-11');
});

test('weekend uses the weekend template', () => {
  const days = buildSlots({ weekly: schedule.weekly, tutorId: 'x', now: at('2026-11-14T05:00:00Z') }); // Sat 08:00 MSK
  assert.equal(days[0].date, '2026-11-14');
  assert.equal(days[0].slots[0].time, '11:00');
});

test('labels in Moscow time', () => {
  const [day] = buildSlots({ weekly: schedule.weekly, tutorId: 'x', now: at('2026-11-12T05:00:00Z') });
  assert.equal(day.label, 'чт, 12 нояб.');
  assert.equal(day.slots[2].label, 'чт, 12 нояб., 18:00 МСК');
  assert.equal(day.slots[2].short, 'чт, 18:00');
});

test('result does not depend on the process time zone', () => {
  const original = process.env.TZ;
  const run = zone => { process.env.TZ = zone; return JSON.stringify(buildSlots({ weekly: schedule.weekly, tutorId: 'x', now: at('2026-11-10T12:30:00Z') })); };
  const results = ['Asia/Vladivostok', 'UTC', 'America/New_York'].map(run);
  process.env.TZ = original;
  assert.equal(new Set(results).size, 1);
});

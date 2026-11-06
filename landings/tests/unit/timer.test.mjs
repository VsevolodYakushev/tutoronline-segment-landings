import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, format } from '../../src/js/lib/timer.mjs';

function fakeClock(start) {
  let now = start;
  let tick = null;
  return {
    now: () => now,
    advance(ms) { now += ms; tick?.(); },
    jump(ms) { now += ms; },
    setIntervalFn(fn) { tick = fn; return 1; },
    clearIntervalFn() { tick = null; },
    get running() { return tick !== null; },
  };
}

test('format is MM:SS and never negative', () => {
  assert.equal(format(15 * 60000), '15:00');
  assert.equal(format(61000), '01:01');
  assert.equal(format(999), '00:01');
  assert.equal(format(-5000), '00:00');
});

test('running → urgent at 60 s → expired; callbacks fire once', () => {
  const clock = fakeClock(0);
  const events = [];
  createTimer({
    deadline: 120000, now: clock.now, setIntervalFn: clock.setIntervalFn, clearIntervalFn: clock.clearIntervalFn, doc: null,
    onTick: (left, text) => events.push(text), onUrgent: () => events.push('URGENT'), onExpire: () => events.push('EXPIRED'),
  });
  assert.equal(events[0], '02:00');
  clock.advance(59000);
  assert.ok(!events.includes('URGENT'));
  clock.advance(1000);
  assert.equal(events.filter(e => e === 'URGENT').length, 1);
  clock.advance(60000);
  clock.advance(1000);
  assert.equal(events.filter(e => e === 'EXPIRED').length, 1);
  assert.equal(clock.running, false, 'stops after expiry');
});

test('a sleeping tab that missed the deadline expires exactly once on the next tick', () => {
  const clock = fakeClock(0);
  let expired = 0;
  const timer = createTimer({ deadline: 900000, now: clock.now, setIntervalFn: clock.setIntervalFn, clearIntervalFn: clock.clearIntervalFn, doc: null, onExpire: () => { expired++; } });
  clock.jump(3_600_000);
  timer.tick();
  timer.tick();
  assert.equal(expired, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVisitorState, parseCookieValue, serializeCookie, hashSeats, seatsShown, firstTouchFrom,
} from '../../src/js/lib/visitor-state.mjs';

const offer = { seatsMin: 3, seatsMax: 10, timerMinutes: 15, storageVersion: 'v1', ttlDays: 30 };
const NOW = 1_794_000_000_000;

function memoryStorage() {
  const data = new Map();
  return { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), data };
}
function memoryCookies() {
  const jar = new Map();
  return {
    get: () => [...jar].map(([key, value]) => `${key}=${value}`).join('; '),
    set: value => { const [pair] = value.split(';'); const index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)); },
    jar,
  };
}
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const throwingCookies = { get() { throw new Error('blocked'); }, set() { throw new Error('blocked'); } };

test('cookie value round-trip', () => {
  const state = { seats: 4, deadline: NOW + 900000, variant: 'b' };
  assert.deepEqual(parseCookieValue(serializeCookie(state)), state);
  assert.equal(parseCookieValue('garbage'), null);
});

test('state from cookie is kept and mirrored to localStorage', () => {
  const storage = memoryStorage();
  const cookies = memoryCookies();
  cookies.jar.set('tst_v1_5-9', `6.${NOW + 900000}.b`);
  const visitor = createVisitorState({ segmentId: '5-9', offer, now: NOW, storage, cookies });
  assert.equal(visitor.mode, 'cookie');
  assert.equal(visitor.state.seats, 6);
  assert.equal(visitor.state.variant, 'b');
  assert.equal(JSON.parse(storage.data.get('tst_v1_5-9')).seats, 6);
});

test('localStorage restores a lost cookie', () => {
  const storage = memoryStorage();
  storage.setItem('tst_v1_5-9', JSON.stringify({ seats: 8, deadline: NOW + 1000, variant: 'a', booked: 1, createdAt: NOW - 899000 }));
  const cookies = memoryCookies();
  const visitor = createVisitorState({ segmentId: '5-9', offer, now: NOW, storage, cookies });
  assert.equal(visitor.mode, 'storage');
  assert.equal(visitor.state.seats, 8);
  assert.match(cookies.jar.get('tst_v1_5-9'), /^8\.\d+\.a$/);
});

test('older first visit wins when cookie was re-issued', () => {
  const storage = memoryStorage();
  storage.setItem('tst_v1_5-9', JSON.stringify({ seats: 9, deadline: NOW - 5000, variant: 'a', createdAt: NOW - 905000 }));
  const cookies = memoryCookies();
  cookies.jar.set('tst_v1_5-9', `3.${NOW + 900000}.b`);
  const visitor = createVisitorState({ segmentId: '5-9', offer, now: NOW, storage, cookies });
  assert.equal(visitor.state.seats, 9);
  assert.equal(visitor.state.deadline, NOW - 5000);
});

test('localStorage throwing → state comes from cookie', () => {
  const cookies = memoryCookies();
  cookies.jar.set('tst_v1_1-4', `5.${NOW + 900000}.a`);
  const visitor = createVisitorState({ segmentId: '1-4', offer, now: NOW, storage: throwing, cookies });
  assert.equal(visitor.state.seats, 5);
});

test('both storages unavailable → stable hash fallback in range', () => {
  const runs = [1, 2, 3].map(() => createVisitorState({ segmentId: '5-9', offer, now: NOW, storage: throwing, cookies: throwingCookies, visitorId: 'visitor-42' }));
  assert.equal(runs[0].mode, 'fallback');
  assert.ok(runs.every(run => run.state.seats === runs[0].state.seats));
  for (const id of ['a', 'b', 'c', 'visitor-1', 'visitor-2']) {
    const seats = hashSeats(id, '5-9');
    assert.ok(seats >= 3 && seats <= 10, `seats=${seats}`);
  }
});

test('records older than 30 days are recreated', () => {
  const storage = memoryStorage();
  storage.setItem('tst_v1_5-9', JSON.stringify({ seats: 9, deadline: NOW - 31 * 86400000, variant: 'a', createdAt: NOW - 31 * 86400000 - 900000 }));
  const visitor = createVisitorState({ segmentId: '5-9', offer, now: NOW, storage, cookies: memoryCookies(), rand: () => 0 });
  assert.equal(visitor.mode, 'generated');
  assert.equal(visitor.state.deadline, NOW + 900000);
});

test('generated seats stay within 3–10', () => {
  for (const r of [0, 0.5, 0.9999]) {
    const visitor = createVisitorState({ segmentId: '10-11', offer, now: NOW, storage: memoryStorage(), cookies: memoryCookies(), rand: () => r });
    assert.ok(visitor.state.seats >= 3 && visitor.state.seats <= 10);
  }
});

test('seatsShown never drops below 1', () => {
  assert.equal(seatsShown({ seats: 3, booked: 1 }), 2);
  assert.equal(seatsShown({ seats: 3, booked: 5 }), 1);
});

test('firstTouch is captured once and not overwritten', () => {
  const visitor = createVisitorState({ segmentId: '5-9', offer, now: NOW, storage: memoryStorage(), cookies: memoryCookies() });
  visitor.captureFirstTouch('?utm_source=avito&utm_content=AD1', NOW);
  visitor.captureFirstTouch('?utm_source=ozon&utm_content=AD2', NOW + 1);
  assert.equal(visitor.state.firstTouch.utm_source, 'avito');
  assert.equal(visitor.state.firstTouch.utm_content, 'AD1');
  assert.equal(firstTouchFrom('?foo=1', NOW), null);
  assert.equal(firstTouchFrom(`?utm_term=${'x'.repeat(400)}`, NOW).utm_term.length, 300);
});

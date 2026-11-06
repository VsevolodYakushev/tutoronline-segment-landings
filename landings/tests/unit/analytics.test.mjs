import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { init, track, trackOnce, buildEvent, resetForTests } from '../../src/js/analytics.mjs';

beforeEach(() => resetForTests());

test('every event carries segment, variant, utm_source, utm_content, ts', () => {
  init({ segment: '5-9', variant: 'b', firstTouch: { utm_source: 'avito', utm_content: 'AD1' }, ymCounterId: null });
  const event = buildEvent('lp_step_2', { step: 2 }, 123);
  assert.deepEqual(event, { event: 'lp_step_2', segment: '5-9', variant: 'b', utm_source: 'avito', utm_content: 'AD1', step: 2, ts: 123 });
});

test('personal data is stripped from events', () => {
  init({ segment: '5-9', variant: 'a', firstTouch: null });
  const env = {};
  const pushed = track('lp_submit', { name: 'Мария', phone: '+7 912', email: 'a@b.ru', step: 3 }, env);
  assert.equal('name' in pushed || 'phone' in pushed || 'email' in pushed, false);
  assert.equal(env.dataLayer.length, 1);
  assert.equal(pushed.utm_source, null);
});

test('without ymCounterId Metrika is not called; with it reachGoal gets the params', () => {
  const calls = [];
  const env = { ym: (...args) => calls.push(args) };
  init({ segment: '1-4', variant: 'a', firstTouch: null, ymCounterId: null });
  track('lp_view', {}, env);
  assert.equal(calls.length, 0);
  init({ segment: '1-4', variant: 'a', firstTouch: { utm_source: 'wb' }, ymCounterId: 12345 });
  track('lp_tutor_select', { tutor_id: 'x', origin: 'form' }, env);
  assert.equal(calls.length, 1);
  const [id, method, goal, params] = calls[0];
  assert.equal(id, 12345);
  assert.equal(method, 'reachGoal');
  assert.equal(goal, 'lp_tutor_select');
  assert.equal(params.tutor_id, 'x');
  assert.equal(params.utm_source, 'wb');
});

test('trackOnce sends an event only once per id', () => {
  init({ segment: '5-9', variant: 'a', firstTouch: null });
  const env = {};
  trackOnce('view', 'lp_view', {}, env);
  trackOnce('view', 'lp_view', {}, env);
  assert.equal(env.dataLayer.length, 1);
});

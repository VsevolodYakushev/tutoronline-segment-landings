import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLandingServer, leadFields, buildInfo, bookingIdFromKey, formatSlotMsk, isConfirmed, loadContent,
} from '../../server.mjs';

const content = loadContent();
content.offer = { ...content.offer, promoCode: 'PROMO100' };
const NOW = Date.parse('2026-11-10T09:00:00Z'); // вт, 12:00 МСК
const SLOT = '2026-11-12T18:00:00+03:00';

function payload(overrides = {}) {
  return {
    segment: '5-9', variant: 'a', grade: 7, subject: 'math',
    tutor: { id: 'roman-yurievich', name: 'Подменённое имя' }, slot: SLOT,
    name: 'Мария', phone: '+7 (912) 345-67-89', email: 'maria@example.com', discountRequested: true,
    commitment: true, consent_pd: true, consent_ads: false,
    landing: 'https://example.ru/5-9/?secret=1#x',
    attribution: { utm_source: 'avito', utm_medium: 'cpc', utm_campaign: 'trial-5-9', utm_content: '4128837712', utm_term: '', other: 'x' },
    ...overrides,
  };
}
const ctx = (extra = {}) => ({ content, now: NOW, bookingId: 'TO-7KQ2MD', ...extra });
const codeOf = fn => { try { fn(); return 'ok'; } catch (error) { return error.message; } };

test('validation codes follow contracts/lead-api.md', () => {
  const cases = [
    [{ segment: '7-8' }, 'invalid_form'],
    [{ variant: 'c' }, 'invalid_form'],
    [{ grade: 11 }, 'invalid_form'],
    [{ grade: '7' }, 'invalid_form'],
    [{ subject: 'physics' }, 'invalid_form'],
    [{ tutor: { id: 'unknown' } }, 'invalid_form'],
    [{ tutor: { id: 'pavel-stepanovich' } }, 'invalid_form'], // not in the segment form list
    [{ subject: 'russian' }, 'invalid_form'], // roman-yurievich does not teach russian
    [{ slot: 'tomorrow' }, 'invalid_slot'],
    [{ slot: '2026-11-01T18:00:00+03:00' }, 'invalid_slot'],
    [{ slot: '2026-11-30T18:00:00+03:00' }, 'invalid_slot'],
    [{ name: 'М' }, 'invalid_form'],
    [{ phone: '12345' }, 'invalid_phone'],
    [{ email: 'not-an-email' }, 'invalid_email'],
    [{ commitment: false }, 'commitment_required'],
    [{ consent_pd: false }, 'consent_required'],
    [{ landing: 'javascript:alert(1)' }, 'invalid_landing'],
  ];
  for (const [override, code] of cases) assert.equal(codeOf(() => leadFields(payload(override), ctx())), code, JSON.stringify(override));
  assert.equal(codeOf(() => leadFields(payload(), ctx())), 'ok');
  assert.equal(codeOf(() => leadFields(payload({ subject: 'russian', tutor: { id: 'russian-match' } }), ctx())), 'ok');
});

test('webhook fields: tutor name from tutors.json, server promo code, landing with 5 UTM only', () => {
  const fields = leadFields(payload({ promoCode: 'HACKED' }), ctx());
  assert.deepEqual(Object.keys(fields), ['name', 'phone', 'email', 'subject', 'landing', 'info']);
  assert.equal(fields.subject, 'Математика');
  assert.equal(fields.landing, 'https://example.ru/5-9/?utm_source=avito&utm_medium=cpc&utm_campaign=trial-5-9&utm_content=4128837712');
  assert.equal(fields.info,
    'Бронь пробного урока TO-7KQ2MD | Сегмент: 5-9 | Класс: 7 | Предмет: Математика | Репетитор: Роман Юрьевич | Слот: чт 12.11.2026 18:00 МСК | Промокод: PROMO100 (100%) | Скидка −1500 ₽: запрошена | Вариант: a | Источник: avito | Объявление: 4128837712 | Реклама: нет | Обязательство прийти: да');
  assert.ok(!fields.info.includes('HACKED'));
  assert.ok(!fields.info.includes('Подменённое'));
});

test('discount is requested only with a valid email and client flag', () => {
  assert.match(leadFields(payload({ email: '' }), ctx()).info, /Скидка −1500 ₽: нет/);
  assert.match(leadFields(payload({ discountRequested: false }), ctx()).info, /Скидка −1500 ₽: нет/);
});

test('placeholder tutor, missing UTM and empty promo use dashes', () => {
  const info = leadFields(payload({ subject: 'russian', tutor: { id: 'russian-match' }, attribution: {} }), ctx({ content: { ...content, offer: { ...content.offer, promoCode: '' } } })).info;
  assert.match(info, /Предмет: Русский язык/);
  assert.match(info, /Репетитор: подобрать \(русский язык\)/);
  assert.match(info, /Промокод: —/);
  assert.match(info, /Источник: — \| Объявление: —/);
});

test('info is bounded: values ≤ 120, total ≤ 1000', () => {
  const info = buildInfo({ bookingId: 'TO-AAAAAA', segment: '5-9', grade: 7, subject: 'Математика', tutor: 'Я'.repeat(500), slot: 'x', promoCode: 'P'.repeat(500), discount: 1500, discountRequested: false, variant: 'a', utmSource: 'u'.repeat(500), utmContent: 'c'.repeat(500), consentAds: false });
  assert.ok(info.length <= 1000);
  for (const part of info.split(' | ').slice(1)) assert.ok(part.split(': ')[1].length <= 120, part.slice(0, 30));
});

test('bookingId is deterministic and uses an unambiguous alphabet', () => {
  const id = bookingIdFromKey('11111111-2222-3333-4444-555555555555');
  assert.match(id, /^TO-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(bookingIdFromKey('11111111-2222-3333-4444-555555555555'), id);
  assert.notEqual(bookingIdFromKey('11111111-2222-3333-4444-555555555556'), id);
});

test('slot is shown in Moscow time', () => {
  assert.equal(formatSlotMsk('2026-11-12T15:00:00Z'), 'чт 12.11.2026 18:00 МСК');
});

test('isConfirmed keeps the base semantics', () => {
  for (const reply of ['ok', 'true', '{"success":true}', '{"Success":true}', '{"SaveRegistrationRequestResult":"ok"}', '{"SaveRegistrationRequestResult":{"success":true}}']) assert.equal(isConfirmed(reply), true, reply);
  for (const reply of ['', '<html>ok</html>', '{"success":false}', '{"error":"x"}', 'false', '[]']) assert.equal(isConfirmed(reply), false, reply);
});

let server; let base; let calls = []; let reply = () => new Response('{"success":true}');
before(async () => {
  server = createLandingServer({ webhook: 'https://example.invalid/hook', content, now: () => NOW, upstreamFetch: async (url, init) => { calls.push(init); return reply(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

const post = (body, key = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') => fetch(`${base}/api/lead`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
});

test('POST /api/lead: success returns bookingId and promoCode; repeat does not call the webhook again', async () => {
  calls = []; reply = () => new Response('{"success":true}');
  const first = await post(payload(), 'k1111111-0000-0000-0000-000000000001');
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.success, true);
  assert.match(firstBody.bookingId, /^TO-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(firstBody.promoCode, 'PROMO100');
  const second = await post(payload(), 'k1111111-0000-0000-0000-000000000001');
  assert.deepEqual(await second.json(), firstBody);
  assert.equal(calls.length, 1);
  const sent = new URLSearchParams(calls[0].body);
  assert.match(sent.get('info'), new RegExp(`^Бронь пробного урока ${firstBody.bookingId} \\|`));
});

test('POST /api/lead: validation errors return the specific code', async () => {
  const response = await post(payload({ commitment: false }), 'k2222222-0000-0000-0000-000000000002');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, code: 'commitment_required' });
});

test('POST /api/lead: unconfirmed upstream is 502 without bookingId', async () => {
  reply = () => new Response('<html>ok</html>');
  const response = await post(payload(), 'k3333333-0000-0000-0000-000000000003');
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { success: false, code: 'upstream_unconfirmed' });
});

test('POST /api/lead: changed data under the same key is rejected', async () => {
  reply = () => new Response('ok');
  await post(payload(), 'k4444444-0000-0000-0000-000000000004');
  const changed = await post(payload({ name: 'Ольга' }), 'k4444444-0000-0000-0000-000000000004');
  assert.equal(changed.status, 409);
});

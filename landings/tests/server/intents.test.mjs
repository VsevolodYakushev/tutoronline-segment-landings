// Phase 10: страницы интентов, запасной вход по метке, заявка с направлением и ключом.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLandingServer, normalizeKeyword, resolveKeyword, loadKeywords, loadContent } from '../../server.mjs';
import { build } from '../../build.mjs';

let server;
let base;
let sent;

before(async () => {
  await build({ log: () => {} });
  server = createLandingServer({
    webhook: 'https://example.invalid/hook',
    upstreamFetch: async (url, options) => { sent = options?.body; return new Response('ok'); },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

const infoOf = body => {
  const text = decodeURIComponent(String(body || '')).replace(/\+/g, ' ');
  return (text.match(/info=([^&]*)/) || [, text])[1];
};

test('страница интента: свой заголовок, предвыбранный фильтр, CSP', async () => {
  const response = await fetch(`${base}/oge-geometriya/`);
  assert.equal(response.status, 200);
  const page = await response.text();
  assert.match(page, /Бесплатный пробный урок с репетитором по геометрии/);
  assert.match(page, /data-subject="geometry" aria-pressed="true"/);
  assert.match(page, /data-grade="9" aria-pressed="true"/);
  assert.ok(response.headers.get('content-security-policy'), 'CSP отдаётся и на странице интента');
});

test('cookie ставится по кластеру, а не по интенту: мест и таймера это не сбрасывает', async () => {
  const response = await fetch(`${base}/oge-geometriya/`);
  assert.match(response.headers.get('set-cookie'), /^tst_v1_5-9=/);
  // посетитель с cookie кластера не получает новую на другом интенте того же кластера
  const second = await fetch(`${base}/oge-fizika/`, { headers: { cookie: 'tst_v1_5-9=4.1794000000000.a' } });
  assert.equal(second.headers.get('set-cookie'), null);
});

test('кластерные страницы остаются доступны для прямого трафика', async () => {
  for (const id of ['1-4', '5-9', '10-11']) {
    const response = await fetch(`${base}/${id}/`);
    assert.equal(response.status, 200, id);
  }
});

test('utm_term уводит на страницу интента, сохраняя метки и подставляя класс', async () => {
  const response = await fetch(`${base}/?utm_source=avito&utm_term=repetitor-po-geometrii-8-klass`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  const location = response.headers.get('location');
  assert.ok(location.startsWith('/oge-geometriya/'), location);
  assert.match(location, /utm_source=avito/);
  assert.match(location, /utm_term=repetitor-po-geometrii-8-klass/);
  assert.match(location, /grade=8/, 'класс из ключевого слова попадает в фильтр');
});

test('метку принимаем в любом виде: кириллица, регистр, плюсы', async () => {
  assert.equal(normalizeKeyword('  Репетитор по Геометрии  '), 'репетитор-по-геометрии');
  assert.equal(normalizeKeyword('ОГЭ+математика'), 'огэ-математика');
  assert.equal(normalizeKeyword('repetitor_po_geometrii'), 'repetitor-po-geometrii');
  const keywords = loadKeywords();
  assert.equal(resolveKeyword('Репетитор по геометрии', keywords).intent, 'oge-geometriya');
  assert.equal(resolveKeyword('REPETITOR-PO-GEOMETRII', keywords).intent, 'oge-geometriya');
  assert.equal(resolveKeyword('нет такого ключа', keywords), null);

  const response = await fetch(`${base}/?utm_term=${encodeURIComponent('Репетитор по геометрии')}`, { redirect: 'manual' });
  assert.ok((response.headers.get('location') || '').startsWith('/oge-geometriya/'));
});

test('?i= принимает и имя интента, и ключевое слово', async () => {
  const byKey = await fetch(`${base}/?i=ege-fizika`, { redirect: 'manual' });
  assert.ok((byKey.headers.get('location') || '').startsWith('/ege-fizika/'));
  const byWord = await fetch(`${base}/?i=repetitor-po-himii-oge`, { redirect: 'manual' });
  assert.ok((byWord.headers.get('location') || '').startsWith('/oge-himiya/'));
});

test('неизвестная метка не уводит никуда, и своя метка не зацикливает редирект', async () => {
  const unknown = await fetch(`${base}/oge-geometriya/?utm_term=net-takogo-klyucha`, { redirect: 'manual' });
  assert.equal(unknown.status, 200, 'страница отдаётся как есть');
  const own = await fetch(`${base}/oge-geometriya/?utm_term=repetitor-po-geometrii`, { redirect: 'manual' });
  assert.equal(own.status, 200, 'нет петли редиректа на своей же странице');
  // без метки корень по-прежнему ведёт на кластер 5-9
  const root = await fetch(`${base}/?utm_source=avito`, { redirect: 'manual' });
  assert.equal(root.headers.get('location'), '/5-9/?utm_source=avito');
});

test('несуществующий интент — 404, исходники закрыты', async () => {
  for (const path of ['/ege-astronomiya/', '/oge-/', '/src/content/keywords.json', '/src/content/intents/ege-fizika.json']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
  }
});

test('бронь без косого слеша редиректится как у кластеров', async () => {
  const response = await fetch(`${base}/oge-geometriya?x=1`, { redirect: 'manual' });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), '/oge-geometriya/?x=1');
});

const lead = () => ({
  segment: '5-9', intent: 'oge-geometriya', keyword: 'repetitor-po-geometrii',
  variant: 'a', grade: 8, subjects: ['geometry'],
  tutor: { id: 'roman-yurievich', name: 'Роман Юрьевич' },
  slot: new Date(Date.now() + 86400000).toISOString().replace(/\.\d+Z$/, 'Z'),
  name: 'Мария', phone: '+7 (912) 345-67-89', email: 'maria@example.com',
  commitment: true, consent_pd: true, consent_ads: false,
  landing: `${base}/oge-geometriya/`,
  attribution: { utm_source: 'avito', utm_term: 'repetitor-po-geometrii' },
});

const post = (body, key) => fetch(`${base}/api/lead`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  body: JSON.stringify(body),
});

test('заявка несёт направление и ключевое слово в info (FR-041)', async () => {
  const response = await post(lead(), `intent-${Date.now()}`);
  assert.equal(response.status, 200);
  const info = infoOf(sent);
  assert.match(info, /Направление: ОГЭ геометрия/);
  assert.match(info, /Запрос: repetitor-po-geometrii/);
  assert.match(info, /Предмет: Геометрия/);
  // состав полей вебхука не изменился: их по-прежнему шесть
  const fields = [...new URLSearchParams(String(sent)).keys()].sort();
  assert.deepEqual(fields, ['email', 'info', 'landing', 'name', 'phone', 'subject']);
});

test('заявка без интента по-прежнему принимается — прямой трафик на кластер', async () => {
  const direct = { ...lead(), intent: '', keyword: '', grade: 9, subjects: ['math'] };
  const response = await post(direct, `direct-${Date.now()}`);
  assert.equal(response.status, 200);
  const info = infoOf(sent);
  assert.match(info, /Направление: —/);
  assert.match(info, /Запрос: —/);
});

test('интент чужого кластера и неизвестный интент отклоняются', async () => {
  const alien = await post({ ...lead(), intent: 'ege-fizika' }, `alien-${Date.now()}`);
  assert.equal(alien.status, 400);
  assert.equal((await alien.json()).code, 'invalid_form');

  const ghost = await post({ ...lead(), intent: 'oge-astronomiya' }, `ghost-${Date.now()}`);
  assert.equal(ghost.status, 400);
});

test('каждый интент в контенте ведёт на собранную страницу своего кластера', async () => {
  const content = loadContent();
  for (const intent of Object.values(content.intents)) {
    assert.ok(content.segments[intent.cluster], `${intent.key}: нет кластера ${intent.cluster}`);
    const response = await fetch(`${base}/${intent.key}/`);
    assert.equal(response.status, 200, intent.key);
    const page = await response.text();
    assert.ok(page.includes(intent.hero.title), `${intent.key}: на странице нет своего заголовка`);
    for (const subject of intent.defaultSubjects) {
      assert.match(page, new RegExp(`data-subject="${subject}" aria-pressed="true"`), `${intent.key}: предмет ${subject} не предвыбран`);
    }
  }
});

test('каждое ключевое слово из карты доезжает до своего интента', async () => {
  const keywords = loadKeywords();
  for (const [slug, entry] of Object.entries(keywords)) {
    const response = await fetch(`${base}/?utm_term=${slug}`, { redirect: 'manual' });
    assert.equal(response.status, 302, slug);
    const location = response.headers.get('location');
    assert.ok(location.startsWith(`/${entry.intent}/`), `${slug} → ${location}`);
    if (entry.grade) assert.match(location, new RegExp(`grade=${entry.grade}`), slug);
  }
});

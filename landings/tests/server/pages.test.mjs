import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLandingServer, visitorCookie, parseCookies, contentSecurityPolicy } from '../../server.mjs';
import { build } from '../../build.mjs';

let server;
let base;

before(async () => {
  await build({ log: () => {} });
  server = createLandingServer({ webhook: 'https://example.invalid/hook', upstreamFetch: async () => new Response('ok') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('segment pages are served with a visitor cookie', async () => {
  for (const id of ['1-4', '5-9', '10-11']) {
    const response = await fetch(`${base}/${id}/`);
    assert.equal(response.status, 200, id);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('set-cookie'), new RegExp(`^tst_v1_${id}=([3-9]|10)\\.\\d{13}\\.[ab]; Max-Age=2592000; Path=/; SameSite=Lax$`));
  }
});

test('no new cookie when the visitor already has one', async () => {
  const response = await fetch(`${base}/5-9/`, { headers: { cookie: 'tst_v1_5-9=4.1794000000000.a' } });
  assert.equal(response.headers.get('set-cookie'), null);
});

test('redirects: / → /5-9/ (302, query kept), /5-9 → /5-9/ (301)', async () => {
  const root = await fetch(`${base}/?utm_source=avito`, { redirect: 'manual' });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/5-9/?utm_source=avito');
  const bare = await fetch(`${base}/5-9?x=1`, { redirect: 'manual' });
  assert.equal(bare.status, 301);
  assert.equal(bare.headers.get('location'), '/5-9/?x=1');
});

test('sources and content are never served', async () => {
  for (const path of ['/server.mjs', '/package.json', '/src/content/offer.json', '/build.mjs', '/dist/manifest.json', '/assets/../server.mjs', '/7-8/']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
  }
});

test('pages carry a CSP that allows exactly their own inline scripts (T069)', async () => {
  const response = await fetch(`${base}/5-9/`);
  const page = await response.text();
  const policy = response.headers.get('content-security-policy');
  assert.ok(policy, 'CSP header is sent with the page');
  assert.match(policy, /(^|; )default-src 'self'(;|$)/);
  assert.match(policy, /(^|; )font-src 'self'(;|$)/);
  assert.match(policy, /(^|; )base-uri 'none'(;|$)/);
  assert.match(policy, /(^|; )object-src 'none'(;|$)/);
  // every inline script of the page is allowed by its hash, so the page still runs under this CSP
  const inline = [...page.matchAll(/<script(?![^>]*src=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length >= 1);
  for (const [, code] of inline) {
    assert.ok(policy.includes(`'sha256-${createHash('sha256').update(code).digest('base64')}'`), 'inline script hash is in script-src');
  }
  // Metrika is off (site.ymCounterId = null) → no third-party origins
  assert.ok(!policy.includes('mc.yandex.ru'), 'no Metrika origins while the counter is off');
  // with the counter on, the Metrika origins are added
  const withYm = contentSecurityPolicy({ inline: { scripts: ["'sha256-x'"] }, metrika: true });
  for (const directive of ['script-src', 'img-src', 'connect-src', 'frame-src']) {
    assert.match(withYm, new RegExp(`${directive}[^;]*https://mc\.yandex\.ru`), directive);
  }
});

test('hashed assets are immutable, plain assets cached for a day', async () => {
  const page = await (await fetch(`${base}/5-9/`)).text();
  const css = /href="(\/css\/landing\.[0-9a-f]{8}\.css)"/.exec(page)[1];
  const cssResponse = await fetch(`${base}${css}`);
  assert.equal(cssResponse.status, 200);
  assert.match(cssResponse.headers.get('cache-control'), /immutable/);
  const font = await fetch(`${base}/assets/fonts/graphik-500.woff2`);
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
});

test('visitorCookie respects offer limits and Secure flag', () => {
  const offer = { seatsMin: 3, seatsMax: 10, timerMinutes: 15, storageVersion: 'v1' };
  const low = visitorCookie('5-9', offer, { now: 1000, rand: (a, b) => (b === undefined ? 0 : a) });
  assert.match(low, /^tst_v1_5-9=3\.901000\.a;/);
  const high = visitorCookie('5-9', offer, { now: 1000, secure: true, rand: (a, b) => (b === undefined ? 1 : b - 1) });
  assert.match(high, /^tst_v1_5-9=10\.901000\.b;.*; Secure$/);
  assert.deepEqual(parseCookies('a=1; b=2=3'), { a: '1', b: '2=3' });
});

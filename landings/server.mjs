// Segment landings server: static pages from dist/, visitor cookie, POST /api/lead → CRM webhook.
// Extended from Design System/tutoronline-adaptive/server.mjs (confirmation, idempotency, limits, no PII logs).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomInt } from 'node:crypto';
import { isIP } from 'node:net';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const WEBHOOK = 'https://profile.tutoronline.ru/DataService.svc/SaveRegistrationRequest';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.ics': 'text/calendar; charset=utf-8',
};
const STATIC_PATH = /^\/(assets|css|js)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(woff2|webp|avif|png|jpg|svg|css|mjs|js|ics)$/;
const HASHED = /(?:^|[./])[0-9a-f]{8}(?:[./])/;
export const VISITOR_TTL_SECONDS = 2592000;
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg\+xml)/;

// Text responses are compressed (brotli, else gzip); results are cached per file content.
const compressed = new Map();
export function negotiateEncoding(acceptEncoding = '') {
  if (/\bbr\b/.test(acceptEncoding)) return 'br';
  if (/\bgzip\b/.test(acceptEncoding)) return 'gzip';
  return null;
}
function compress(file, encoding) {
  const key = `${encoding}:${createHash('sha1').update(file).digest('hex')}`;
  let body = compressed.get(key);
  if (!body) {
    body = encoding === 'br'
      ? brotliCompressSync(file, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9, [zlib.BROTLI_PARAM_SIZE_HINT]: file.length } })
      : gzipSync(file, { level: 9 });
    if (compressed.size > 500) compressed.clear();
    compressed.set(key, body);
  }
  return body;
}

export function loadContent(dir = CONTENT_DIR) {
  const read = name => JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
  const segments = {};
  for (const file of readdirSync(path.join(dir, 'segments'))) {
    if (!file.endsWith('.json')) continue;
    const segment = read(path.join('segments', file));
    segments[segment.id] = segment;
  }
  return { offer: read('offer.json'), tutors: read('tutors.json'), site: read('site.json'), segments };
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (name && !(name in cookies)) cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}

// Visitor state for one segment: <seats>.<deadlineMs>.<variant>, issued on the first page view (research R5).
export function visitorCookie(segmentId, offer, { now = Date.now(), secure = false, rand = randomInt } = {}) {
  const seats = rand(offer.seatsMin, offer.seatsMax + 1);
  const deadline = now + offer.timerMinutes * 60000;
  const variant = rand(2) ? 'b' : 'a';
  return `tst_${offer.storageVersion}_${segmentId}=${seats}.${deadline}.${variant}; Max-Age=${VISITOR_TTL_SECONDS}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// Do not turn an arbitrary 200 page, validation error or empty response into success.
export function isConfirmed(text) {
  const value = text.replace(/^﻿/, '').trim();
  if (value.toLowerCase() === 'ok' || value === 'true') return true;
  try {
    let result = JSON.parse(value);
    if (result && typeof result === 'object' && Object.hasOwn(result, 'SaveRegistrationRequestResult')) result = result.SaveRegistrationRequestResult;
    if (typeof result === 'string') {
      if (result.toLowerCase() === 'ok' || result === 'true') return true;
      try { result = JSON.parse(result); } catch { return false; }
    }
    if (result === true) return true;
    if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
    if (result.success === false || result.Success === false || result.error || result.Error) return false;
    return result.success === true || result.Success === true;
  } catch { return false; }
}

const SUBJECTS_FALLBACK = { math: 'Математика', russian: 'Русский язык' };
export const MAX_SUBJECTS = 5;
const BOOKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no 0/O/1/I
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LEAD_ERROR_CODES = ['invalid_form', 'invalid_slot', 'invalid_phone', 'invalid_email', 'commitment_required', 'consent_required', 'invalid_landing'];

export function bookingIdFromKey(key) {
  const digest = createHash('sha256').update(String(key)).digest();
  let id = '';
  for (let index = 0; index < 6; index++) id += BOOKING_ALPHABET[digest[index] & 31];
  return `TO-${id}`;
}

export function formatSlotMsk(iso) {
  const date = new Date(Date.parse(iso) + 3 * 3600000);
  const pad = value => String(value).padStart(2, '0');
  return `${WEEKDAYS[date.getUTCDay()]} ${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} МСК`;
}

// contracts/crm-webhook.md: fixed order, " | " between pairs, "—" for empty, values ≤ 120, total ≤ 1000.
export function buildInfo(data) {
  const value = text => {
    const clean = String(text ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
    return (clean || '—').slice(0, 120);
  };
  const pairs = [
    ['Сегмент', data.segment], ['Класс', data.gradeOutside ? `${data.grade} (вне сегмента)` : data.grade],
    ['Предмет', data.subject], ['Ещё предметы', data.extraSubjects], ['Репетитор', data.tutor], ['Слот', data.slot],
    ['Промокод', data.promoCode ? `${data.promoCode} (100%)` : ''],
    [`Скидка −${data.discount} ₽`, data.discountRequested ? 'запрошена' : 'нет'],
    ['Вариант', data.variant], ['Источник', data.utmSource], ['Объявление', data.utmContent],
    ['Реклама', data.consentAds ? 'да' : 'нет'], ['Обязательство прийти', 'да'],
  ];
  return [`Бронь пробного урока ${data.bookingId}`, ...pairs.map(([key, text]) => `${key}: ${value(text)}`)].join(' | ').slice(0, 1000);
}

export function leadFields(input, { content, now = Date.now(), bookingId }) {
  const fail = code => { throw new Error(code); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('invalid_form');
  const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

  const segment = content.segments[input.segment];
  if (!segment) fail('invalid_form');
  if (input.variant !== 'a' && input.variant !== 'b') fail('invalid_form');
  const labels = content.site?.subjects || SUBJECTS_FALLBACK;
  // FR-038: any grade the site supports is accepted, even outside this segment's own range.
  const grades = content.site?.grades?.length ? content.site.grades : segment.grades;
  if (!Number.isInteger(input.grade) || !grades.includes(input.grade)) fail('invalid_form');
  // FR-037: one or more subjects; the first one is the primary subject of the booking.
  const asked = Array.isArray(input.subjects) ? input.subjects : [];
  const subjects = [...new Set(asked.filter(subject => typeof subject === 'string' && labels[subject]))];
  if (!subjects.length || subjects.length !== asked.length || subjects.length > MAX_SUBJECTS) fail('invalid_form');
  if (subjects.some(subject => !(segment.subjects || []).includes(subject))) fail('invalid_form');
  const primary = subjects[0];
  const tutorId = typeof input.tutor?.id === 'string' ? input.tutor.id : '';
  const tutor = content.tutors.find(item => item.id === tutorId);
  if (!tutor || !(segment.tutorIds?.[primary] || []).includes(tutorId) || !tutor.subjects.includes(primary)) fail('invalid_form');

  const slotMs = typeof input.slot === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(input.slot) ? Date.parse(input.slot) : NaN;
  if (!Number.isFinite(slotMs) || slotMs < now - 60000 || slotMs > now + 7 * 86400000) fail('invalid_slot');

  const name = clean(input.name, 150);
  if (name.length < 2) fail('invalid_form');
  const phone = clean(input.phone, 32);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15 || !/^[+\d()\s.-]+$/.test(phone)) fail('invalid_phone');
  const email = clean(input.email, 254);
  if (email && !EMAIL_RE.test(email)) fail('invalid_email');
  if (input.commitment !== true) fail('commitment_required');
  if (input.consent_pd !== true) fail('consent_required');

  let landing;
  try { landing = new URL(input.landing); } catch { fail('invalid_landing'); }
  if (!['http:', 'https:'].includes(landing.protocol) || landing.username || landing.password) fail('invalid_landing');
  landing.search = ''; landing.hash = '';
  const utm = new URLSearchParams();
  if (input.attribution && typeof input.attribution === 'object') {
    for (const key of UTM_KEYS) {
      const value = clean(input.attribution[key], 300);
      if (value) utm.set(key, value);
    }
  }
  landing.search = utm.toString();

  const info = buildInfo({
    bookingId, segment: segment.id, grade: input.grade, gradeOutside: !segment.grades.includes(input.grade),
    subject: labels[primary], extraSubjects: subjects.slice(1).map(subject => labels[subject]).join(', '),
    tutor: tutor.placeholder ? `подобрать (${labels[primary].toLowerCase()})` : tutor.name,
    slot: formatSlotMsk(input.slot), promoCode: content.offer.promoCode, discount: content.offer.discount,
    discountRequested: input.discountRequested === true && Boolean(email), variant: input.variant,
    utmSource: utm.get('utm_source'), utmContent: utm.get('utm_content'), consentAds: input.consent_ads === true,
  });
  return { name, phone, email, subject: labels[primary], landing: landing.href, info };
}

// Inline <script>/<style> hashes are computed by build.mjs and stored in dist/manifest.json.
export function loadManifest(dir = DIST) {
  try { return JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')); }
  catch { return { pages: {} }; }
}

// T069: pages are locked to their own origin; only the inline scripts of this build may run.
export function contentSecurityPolicy({ inline = {}, metrika = false } = {}) {
  const ym = 'https://mc.yandex.ru';
  const script = ["'self'", ...(inline.scripts || [])];
  const style = ["'self'", ...(inline.styles || [])];
  if (metrika) script.push(ym);
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    `style-src ${style.join(' ')}`,
    `img-src 'self' data:${metrika ? ` ${ym}` : ''}`,
    `connect-src 'self'${metrika ? ` ${ym}` : ''}`,
    "font-src 'self'",
    ...(metrika ? [`frame-src ${ym}`] : []),
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function securityHeaders(extra = {}) {
  return { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...extra };
}

export function createLandingServer({
  upstreamFetch = fetch,
  webhook = process.env.LEAD_WEBHOOK_URL || WEBHOOK,
  format = process.env.LEAD_WEBHOOK_FORMAT || 'form',
  publicOrigin = process.env.PUBLIC_ORIGIN || '',
  timeoutMs = 12000,
  content = loadContent(),
  distDir = DIST,
  manifest = null,
  now = () => Date.now(),
} = {}) {
  if (!['form', 'json'].includes(format)) throw new Error('LEAD_WEBHOOK_FORMAT must be form or json');
  if (new URL(webhook).protocol !== 'https:') throw new Error('Webhook requires HTTPS');
  const segmentIds = Object.keys(content.segments);
  const metrika = Boolean(content.site?.ymCounterId);
  // The policy carries the hashes of this build's inline scripts, so it follows the manifest:
  // a rebuild without a restart must not leave a stale hash in the header.
  const manifestFile = path.join(distDir, 'manifest.json');
  let loaded = manifest;
  let loadedAt = -1;
  let policies = new Map();
  function policyFor(segmentId) {
    if (!manifest) {
      let stamp = 0;
      try { stamp = statSync(manifestFile).mtimeMs; } catch { stamp = 0; }
      if (stamp !== loadedAt) { loaded = loadManifest(distDir); loadedAt = stamp; policies = new Map(); }
    }
    if (!policies.has(segmentId)) {
      policies.set(segmentId, contentSecurityPolicy({ inline: loaded?.pages?.[segmentId]?.inline, metrika }));
    }
    return policies.get(segmentId);
  }
  const secureCookies = publicOrigin.startsWith('https:');
  const rates = new Map();
  const submissions = new Map();

  async function serveFile(request, response, filePath, headers) {
    let file;
    try { file = await readFile(filePath); }
    catch { return json(response, 404, { success: false, code: 'not_found' }); }
    const encoding = COMPRESSIBLE.test(headers['Content-Type'] || '') && file.length > 1024 ? negotiateEncoding(request.headers['accept-encoding']) : null;
    if (encoding) {
      file = compress(file, encoding);
      headers = { ...headers, 'Content-Encoding': encoding, Vary: 'Accept-Encoding' };
    }
    response.writeHead(200, securityHeaders({ 'Content-Length': file.length, ...headers }));
    response.end(request.method === 'HEAD' ? undefined : file);
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === '/api/lead') {
        if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return json(response, 405, { success: false, code: 'method_not_allowed' }); }
        if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) return json(response, 415, { success: false, code: 'json_required' });
        const origin = request.headers.origin;
        const expectedOrigin = publicOrigin || `http://${request.headers.host}`;
        if (origin && origin !== expectedOrigin) return json(response, 403, { success: false, code: 'origin_rejected' });
        const peer = request.socket.remoteAddress || 'unknown';
        const trustedProxy = process.env.TRUST_PROXY === '1' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
        const forwarded = request.headers['x-real-ip'];
        const ip = trustedProxy && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : peer;
        const current = now();
        // Bounded, in-memory limits for one server process; no personal data are logged.
        for (const [key, record] of rates) if (current - record.start > 60000) rates.delete(key);
        for (const [key, record] of submissions) if (current - record.start > 600000) submissions.delete(key);
        const rate = rates.get(ip) || { start: current, count: 0 }; rate.count++; rates.set(ip, rate);
        if (rate.count > 30 || rates.size > 10000) return json(response, 429, { success: false, code: 'too_many_requests' });
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 16384) return json(response, 413, { success: false, code: 'payload_too_large' });
          chunks.push(chunk);
        }
        const key = request.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{10,100}$/.test(key)) return json(response, 400, { success: false, code: 'submission_key_required' });
        const bookingId = bookingIdFromKey(key);
        let input; let fields;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return json(response, 400, { success: false, code: 'invalid_form' }); }
        try { fields = leadFields(input, { content, now: current, bookingId }); }
        catch (error) { return json(response, 400, { success: false, code: LEAD_ERROR_CODES.includes(error.message) ? error.message : 'invalid_form' }); }
        const promoCode = content.offer.promoCode || '';
        const hash = createHash('sha256').update(JSON.stringify(fields)).digest('hex');
        const existing = submissions.get(key);
        if (existing) {
          if (existing.hash !== hash) return json(response, 409, { success: false, code: 'submission_changed' });
          const cached = await existing.result;
          return json(response, cached.status, cached.body);
        }
        if (submissions.size >= 10000) return json(response, 503, { success: false, code: 'busy' });
        const result = (async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const upstream = await upstreamFetch(webhook, {
              method: 'POST', redirect: 'error', signal: controller.signal,
              headers: { 'Content-Type': format === 'form' ? 'application/x-www-form-urlencoded; charset=UTF-8' : 'application/json; charset=UTF-8', 'Accept': 'application/json, text/plain, */*', 'Referer': fields.landing },
              body: format === 'form' ? new URLSearchParams(fields).toString() : JSON.stringify(fields),
            });
            const reply = await upstream.text();
            if (upstream.ok && isConfirmed(reply)) return { status: 200, body: { success: true, bookingId, promoCode } };
            return { status: 502, body: { success: false, code: 'upstream_unconfirmed' } };
          } catch {
            return { status: 502, body: { success: false, code: controller.signal.aborted ? 'upstream_timeout' : 'upstream_unconfirmed' } };
          } finally { clearTimeout(timer); }
        })();
        submissions.set(key, { start: current, hash, result });
        const answer = await result;
        return json(response, answer.status, answer.body);
      }

      if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { success: false, code: 'method_not_allowed' });

      if (pathname === '/') {
        response.writeHead(302, securityHeaders({ Location: `/5-9/${url.search}`, 'Cache-Control': 'no-store' }));
        return response.end();
      }
      const segmentMatch = /^\/([0-9]+-[0-9]+)(\/(?:index\.html)?)?$/.exec(pathname);
      if (segmentMatch && segmentIds.includes(segmentMatch[1])) {
        const segmentId = segmentMatch[1];
        if (!segmentMatch[2]) {
          response.writeHead(301, securityHeaders({ Location: `/${segmentId}/${url.search}` }));
          return response.end();
        }
        const headers = { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache', 'Content-Security-Policy': policyFor(segmentId) };
        const cookieName = `tst_${content.offer.storageVersion}_${segmentId}`;
        if (!parseCookies(request.headers.cookie)[cookieName]) headers['Set-Cookie'] = visitorCookie(segmentId, content.offer, { now: now(), secure: secureCookies });
        return serveFile(request, response, path.join(distDir, segmentId, 'index.html'), headers);
      }

      // Allowlist public files so sources, content JSON and server code are never served.
      if (!STATIC_PATH.test(pathname) || pathname.includes('..')) return json(response, 404, { success: false, code: 'not_found' });
      const filePath = path.join(distDir, pathname.slice(1));
      if (!filePath.startsWith(distDir + path.sep) || !existsSync(filePath)) return json(response, 404, { success: false, code: 'not_found' });
      return serveFile(request, response, filePath, {
        'Content-Type': MIME[path.extname(pathname)] || 'application/octet-stream',
        'Cache-Control': HASHED.test(pathname) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
      });
    } catch { if (!response.headersSent) json(response, 400, { success: false, code: 'bad_request' }); else response.end(); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createLandingServer();
  server.listen(Number(process.env.PORT || 8765), process.env.HOST || '127.0.0.1', () => console.log(`Landings: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8765}/5-9/`));
}

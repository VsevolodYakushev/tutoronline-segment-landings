import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEBHOOK = 'https://profile.tutoronline.ru/DataService.svc/SaveRegistrationRequest';
const INFO = 'Заявка с лендинга по математике. Запись на бесплатный урок-диагностику.';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

// Do not turn an arbitrary 200 page, validation error or empty response into success.
export function isConfirmed(text) {
  const value = text.replace(/^\uFEFF/, '').trim();
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

export function leadFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_payload');
  const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const phone = clean(input.phone, 32);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15 || !/^[+\d()\s.-]+$/.test(phone)) throw new Error('invalid_phone');
  if (input.consent_pd !== true) throw new Error('consent_required');
  const email = clean(input.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
  let landing;
  try { landing = new URL(input.landing); } catch { throw new Error('invalid_landing'); }
  if (!['http:', 'https:'].includes(landing.protocol) || landing.username || landing.password) throw new Error('invalid_landing');
  landing.search = ''; landing.hash = '';
  const utm = new URLSearchParams();
  if (input.attribution && typeof input.attribution === 'object') {
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = clean(input.attribution[key], 300);
      if (value) utm.set(key, value);
    }
  }
  landing.search = utm.toString();
  return { name: clean(input.name, 150), phone, email, subject: 'Математика', landing: landing.href, info: INFO };
}

export function createLandingServer({ upstreamFetch = fetch, webhook = process.env.LEAD_WEBHOOK_URL || WEBHOOK, format = process.env.LEAD_WEBHOOK_FORMAT || 'form', publicOrigin = process.env.PUBLIC_ORIGIN || '', timeoutMs = 12000 } = {}) {
  if (!['form', 'json'].includes(format)) throw new Error('LEAD_WEBHOOK_FORMAT must be form or json');
  if (new URL(webhook).protocol !== 'https:') throw new Error('Webhook requires HTTPS');
  const rates = new Map();
  const submissions = new Map();
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      // Supports preview /adaptive/ as well as a domain root.
      if (pathname.startsWith('/adaptive/')) pathname = pathname.slice('/adaptive'.length);
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
        const now = Date.now();
        // Bounded, in-memory limits for one server process; no personal data are logged.
        for (const [key, record] of rates) if (now - record.start > 60000) rates.delete(key);
        for (const [key, record] of submissions) if (now - record.start > 600000) submissions.delete(key);
        const rate = rates.get(ip) || { start: now, count: 0 }; rate.count++; rates.set(ip, rate);
        if (rate.count > 30 || rates.size > 10000) return json(response, 429, { success: false, code: 'too_many_requests' });
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 16384) return json(response, 413, { success: false, code: 'payload_too_large' });
          chunks.push(chunk);
        }
        let input; let fields;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); fields = leadFields(input); }
        catch { return json(response, 400, { success: false, code: 'invalid_form' }); }
        const key = request.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{10,100}$/.test(key)) return json(response, 400, { success: false, code: 'submission_key_required' });
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
            if (upstream.ok && isConfirmed(reply)) return { status: 200, body: { success: true } };
            // Preserve an uncertain result for this submission key to avoid duplicate leads.
            return { status: 502, body: { success: false, code: 'upstream_unconfirmed' } };
          } catch {
            return { status: 502, body: { success: false, code: controller.signal.aborted ? 'upstream_timeout' : 'upstream_unconfirmed' } };
          } finally { clearTimeout(timer); }
        })();
        submissions.set(key, { start: now, hash, result });
        const answer = await result;
        return json(response, answer.status, answer.body);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { success: false, code: 'method_not_allowed' });
      if (pathname === '/' || pathname === '/index.html') pathname = '/index.html';
      // Allowlist public files so server source and environment files never get served.
      if (!['/index.html', '/styles.css', '/app.js', '/config.js'].includes(pathname) && !/^\/assets\/[a-zA-Z0-9_-]+\.(png|jpg|webp|svg|ttf|mp4)$/.test(pathname)) return json(response, 404, { success: false, code: 'not_found' });
      let file;
      try { file = await readFile(path.join(ROOT, pathname.slice(1))); }
      catch { return json(response, 404, { success: false, code: 'not_found' }); }
      response.writeHead(200, { 'Content-Type': MIME[path.extname(pathname)] || 'application/octet-stream', 'Content-Length': file.length, 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
      response.end(request.method === 'HEAD' ? undefined : file);
    } catch { if (!response.headersSent) json(response, 400, { success: false, code: 'bad_request' }); else response.end(); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createLandingServer();
  server.listen(Number(process.env.PORT || 8765), process.env.HOST || '127.0.0.1', () => console.log(`Landing: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8765}/`));
}

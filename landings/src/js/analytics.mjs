// Analytics (contracts/analytics-events.md): dataLayer always, Yandex Metrika when ymCounterId is set.
// Personal data never leaves through events.
const PII_KEYS = ['name', 'phone', 'email'];
let base = { segment: null, variant: null, utm_source: null, utm_content: null };
let counterId = null;
const once = new Set();

export function init({ segment, variant, firstTouch, ymCounterId }) {
  base = { segment, variant, utm_source: firstTouch?.utm_source || null, utm_content: firstTouch?.utm_content || null };
  counterId = ymCounterId || null;
}

export function buildEvent(event, params = {}, now = Date.now()) {
  const payload = { event, ...base, ...params, ts: now };
  for (const key of PII_KEYS) delete payload[key];
  return payload;
}

export function track(event, params = {}, env = globalThis) {
  const payload = buildEvent(event, params);
  env.dataLayer = env.dataLayer || [];
  env.dataLayer.push(payload);
  if (counterId && typeof env.ym === 'function') {
    const { event: goal, ts, ...goalParams } = payload;
    try { env.ym(counterId, 'reachGoal', goal, goalParams); } catch { /* counter not ready */ }
  }
  return payload;
}

export function trackOnce(id, event, params, env) {
  if (once.has(id)) return null;
  once.add(id);
  return track(event, params, env);
}

// lp_view once per load; lp_scroll_50 once when the viewport bottom passes half of the document.
export function watchPage(env = globalThis, doc = globalThis.document) {
  const view = () => trackOnce('view', 'lp_view', {}, env);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', view, { once: true });
  else view();
  let scheduled = false;
  const check = () => {
    scheduled = false;
    const height = doc.documentElement.scrollHeight;
    if (height && (env.scrollY + env.innerHeight) / height >= 0.5) {
      trackOnce('scroll50', 'lp_scroll_50', {}, env);
      env.removeEventListener('scroll', onScroll);
    }
  };
  const onScroll = () => {
    if (scheduled) return;
    scheduled = true;
    (env.requestAnimationFrame || setTimeout)(check);
  };
  env.addEventListener('scroll', onScroll, { passive: true });
}

// lp_form_start once: first click on any booking CTA (source = data-cta) or first interaction with the form.
export function watchFormStart(doc = globalThis.document, env = globalThis) {
  doc.addEventListener('click', event => {
    const cta = event.target.closest?.('[data-cta]');
    if (cta) trackOnce('form_start', 'lp_form_start', { source: cta.dataset.cta }, env);
  });
  doc.addEventListener('lp:form-start', event => trackOnce('form_start', 'lp_form_start', { source: event.detail?.source || 'form' }, env));
}

export function resetForTests() {
  once.clear();
  base = { segment: null, variant: null, utm_source: null, utm_content: null };
  counterId = null;
}

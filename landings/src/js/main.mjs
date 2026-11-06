// Page bootstrap: config, visitor state, first-touch UTM, analytics, then feature modules.
// Modules are imported statically so they download in parallel and run right after parsing.
import { browserVisitorState } from './lib/visitor-state.mjs';
import * as analytics from './analytics.mjs';
import * as scarcity from './scarcity.mjs';
import * as quiz from './quiz.mjs';
import * as floating from './floating.mjs';

const MODULES = [scarcity, quiz, floating];

function readConfig() {
  const node = document.getElementById('lp-config');
  return node ? JSON.parse(node.textContent) : null;
}

function metrikaClientId(counterId) {
  return new Promise(resolve => {
    if (!counterId || typeof window.ym !== 'function') return resolve(null);
    const timer = setTimeout(() => resolve(null), 300);
    try { window.ym(counterId, 'getClientID', id => { clearTimeout(timer); resolve(id ? String(id) : null); }); }
    catch { clearTimeout(timer); resolve(null); }
  });
}

async function start() {
  const config = readConfig();
  if (!config) return;
  const segmentId = config.segment.id;
  let visitor = browserVisitorState({ segmentId, offer: config.offer });
  // Only without any storage does the visitor id matter: prefer the Metrika client id over the browser fingerprint.
  if (visitor.mode === 'fallback' && config.site.ymCounterId) {
    const clientId = await metrikaClientId(config.site.ymCounterId);
    if (clientId) visitor = browserVisitorState({ segmentId, offer: config.offer, visitorId: clientId });
  }
  visitor.captureFirstTouch(location.search);
  const variant = document.documentElement.dataset.variant || visitor.state.variant;
  analytics.init({ segment: segmentId, variant, firstTouch: visitor.state.firstTouch, ymCounterId: config.site.ymCounterId });
  analytics.watchPage();
  analytics.watchFormStart();
  const ctx = { config, visitor, variant, analytics };
  window.__lp = ctx; // debugging aid for QA

  // Feature modules are optional: one failing module must not break the others.
  for (const module of MODULES) {
    try { module.init(ctx); } catch (error) { console.error('[landing] module failed', error); }
  }
  document.documentElement.dataset.ready = 'true';
}

start().catch(error => console.error('[landing] start failed', error));

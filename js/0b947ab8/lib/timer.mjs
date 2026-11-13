// Countdown to an absolute deadline (research R6): reload-proof, corrects drift on every tick.
const pad = value => String(value).padStart(2, '0');

export function format(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function createTimer({
  deadline, now = () => Date.now(), onTick, onUrgent, onExpire, urgentMs = 60000,
  setIntervalFn = (fn, ms) => setInterval(fn, ms), clearIntervalFn = id => clearInterval(id), doc = globalThis.document,
}) {
  let urgentFired = false;
  let expiredFired = false;
  let id = null;

  function stop() {
    if (id !== null) { clearIntervalFn(id); id = null; }
    doc?.removeEventListener?.('visibilitychange', onVisible);
  }

  function tick() {
    if (expiredFired) return;
    const left = deadline - now();
    onTick?.(left, format(left));
    if (!urgentFired && left > 0 && left <= urgentMs) { urgentFired = true; onUrgent?.(); }
    if (left <= 0) { expiredFired = true; stop(); onExpire?.(); }
  }

  function onVisible() { if (!doc.hidden) tick(); }

  tick();
  if (!expiredFired) {
    id = setIntervalFn(tick, 1000);
    doc?.addEventListener?.('visibilitychange', onVisible);
  }
  return { tick, stop };
}

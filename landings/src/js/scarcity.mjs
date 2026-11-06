// Seats and offer timer on the page (FR-010…FR-013): one source of truth — the visitor state.
import { seatsPhrase } from './lib/plural.mjs';
import { createTimer } from './lib/timer.mjs';

export function init(ctx) {
  const { visitor, config, analytics } = ctx;
  const root = document.documentElement;
  const template = config.segment.topbar?.seatsTemplate;
  const discount = config.offer.discount;

  const renderSeats = () => {
    const phrase = seatsPhrase(visitor.seatsShown(), template);
    document.querySelectorAll('[data-seats]').forEach(node => { node.textContent = phrase; });
    document.querySelectorAll('[data-seats-badge]').forEach(node => { node.hidden = false; });
  };
  renderSeats();
  document.addEventListener('lp:booked', renderSeats);

  const timers = () => document.querySelectorAll('[data-timer]');
  const finalTimer = document.querySelector('[data-final-timer]');

  function burn({ silent }) {
    root.dataset.offer = 'expired';
    document.querySelectorAll('[data-timer-bound]').forEach(node => node.classList.add('is-burned'));
    const label = document.querySelector('[data-topbar-label]');
    if (label) label.textContent = `Скидка ${discount} ₽ сгорела · пробный урок — бесплатно`;
    timers().forEach(node => { node.hidden = true; });
    if (finalTimer) finalTimer.closest('[data-timer-bound]').hidden = true;
    if (!visitor.state.expired) {
      visitor.markExpired();
      // The event is only for a timer that ran out while the page was open (contracts/analytics-events.md).
      if (!silent) analytics?.track('lp_timer_expired');
    }
    document.dispatchEvent(new CustomEvent('lp:expired'));
  }

  if (Date.now() >= visitor.state.deadline) { burn({ silent: true }); return; }

  root.dataset.offer = 'running';
  if (finalTimer) finalTimer.closest('[data-timer-bound]').hidden = false;
  createTimer({
    deadline: visitor.state.deadline,
    onTick: (left, text) => {
      timers().forEach(node => { node.textContent = text; });
      if (finalTimer) finalTimer.textContent = `Скидка ${discount} ₽ действует ещё ${text}`;
    },
    onUrgent: () => {
      root.dataset.offer = 'urgent';
      timers().forEach(node => node.classList.add('is-urgent'));
    },
    onExpire: () => burn({ silent: false }),
  });
}

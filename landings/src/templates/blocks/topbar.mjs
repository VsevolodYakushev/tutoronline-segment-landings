import { html } from '../html.mjs';

// Fixed top bar (FR-026): offer timer + seats; ≤ 48 px on mobile. Without JS — only the free-lesson line.
export function topbar({ segment }) {
  return html`<div class="topbar" data-topbar role="region" aria-label="Предложение">
<div class="wrap topbar-row">
  <p class="topbar-offer needs-js" data-timer-bound><span class="ico ico-time" aria-hidden="true"></span><span data-topbar-label>${segment.topbar?.timerLabel || 'Скидка 1500 ₽ сгорит через'}</span> <b class="timer" data-timer role="timer">15:00</b></p>
  <p class="topbar-seats needs-js"><span data-seats></span></p>
  <p class="topbar-static no-js-only">Первый урок — бесплатно</p>
</div>
</div>`;
}

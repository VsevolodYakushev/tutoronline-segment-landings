import { html } from '../html.mjs';

export function final({ segment }) {
  const { title, text } = segment.final || {};
  if (!title) return '';
  return html`<section id="final" class="sec final-sec" aria-labelledby="final-title">
<div class="wrap">
  <div class="final-card">
    <h2 class="h2 final-title" id="final-title">${title}</h2>
    <p class="final-text">${text}</p>
    <p class="final-timer" data-timer-bound hidden><span class="ico ico-time" aria-hidden="true"></span><span data-final-timer></span></p>
    <a class="btn btn-accent btn-l" href="#form" data-cta="final">Забронировать бесплатный урок</a>
  </div>
</div>
</section>`;
}

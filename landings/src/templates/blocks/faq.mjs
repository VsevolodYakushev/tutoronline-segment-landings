import { html } from '../html.mjs';

export function faq({ segment }) {
  const items = segment.faq || [];
  if (!items.length) return '';
  return html`<section id="faq" class="sec faq-sec" aria-labelledby="faq-title">
<div class="wrap">
  <div class="sec-head is-center"><h2 class="h2" id="faq-title">Частые вопросы</h2></div>
  <div class="faq-list">
    ${items.map((item, index) => html`<details class="faq-item"${index === 0 ? html` open` : ''}>
      <summary><span>${item.q}</span><span class="faq-btn" aria-hidden="true"></span></summary>
      <p class="faq-a">${item.a}</p>
    </details>`)}
  </div>
</div>
</section>`;
}

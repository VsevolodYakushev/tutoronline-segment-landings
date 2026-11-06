import { html } from '../html.mjs';

const ICONS = new Set(['calendar', 'call', 'chat', 'danger', 'discount', 'document', 'game', 'graph', 'lock', 'profile', 'shield', 'star', 'tick', 'ticket', 'time']);

export function pains({ segment }) {
  const { title, items = [] } = segment.pains || {};
  if (!items.length) return '';
  return html`<section id="pains" class="sec pains-sec" aria-labelledby="pains-title">
<div class="wrap">
  <div class="sec-head"><h2 class="h2" id="pains-title">${title}</h2></div>
  <ul class="pain-list">
    ${items.map(item => html`<li class="pain-card">
      <span class="pain-icon"><span class="ico ico-${ICONS.has(item.icon) ? item.icon : 'danger'}" aria-hidden="true"></span></span>
      <h3 class="pain-title">${item.title}</h3>
      <p class="pain-text">${item.text}</p>
    </li>`)}
  </ul>
</div>
</section>`;
}

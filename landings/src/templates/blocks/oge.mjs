import { html } from '../html.mjs';

export function oge({ segment }) {
  const block = segment.oge;
  if (!block) return '';
  return html`<section id="oge" class="sec extra-sec" aria-labelledby="oge-title">
<div class="wrap">
  <div class="extra-card">
    <h2 class="h2" id="oge-title">${block.title}</h2>
    <p class="lead">${block.text}</p>
    <ul class="check-list">${(block.items || []).map(item => html`<li><span class="ico ico-tick" aria-hidden="true"></span>${item}</li>`)}</ul>
  </div>
</div>
</section>`;
}

import { html } from '../html.mjs';

export function trial({ segment }) {
  const { title, items = [] } = segment.trialSteps || {};
  if (!items.length) return '';
  return html`<section id="trial" class="sec sec-muted trial-sec" aria-labelledby="trial-title">
<div class="wrap">
  <div class="sec-head"><h2 class="h2" id="trial-title">${title}</h2></div>
  <ol class="trial-steps">
    ${items.map((item, index) => html`<li class="trial-step">
      <span class="trial-num" aria-hidden="true">${index + 1}</span>
      <div><h3 class="trial-title">${item.title}</h3><p class="trial-text">${item.text}</p></div>
    </li>`)}
  </ol>
</div>
</section>`;
}

import { html } from '../html.mjs';

// 10–11: the student decides, the parent pays — a second layer of text for the parent (ТЗ §2).
export function parents({ segment }) {
  const block = segment.parents;
  if (!block) return '';
  return html`<section id="parents" class="sec extra-sec" aria-labelledby="parents-title">
<div class="wrap">
  <div class="extra-card is-parents">
    <h2 class="h2" id="parents-title">${block.title}</h2>
    <p class="lead">${block.text}</p>
    <ul class="check-list">${(block.items || []).map(item => html`<li><span class="ico ico-tick" aria-hidden="true"></span>${item}</li>`)}</ul>
  </div>
</div>
</section>`;
}

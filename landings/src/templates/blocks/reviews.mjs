import { html } from '../html.mjs';

// Only real ratings from the base landing (FR-006): independent platforms, no invented testimonials.
export function reviews({ content }) {
  const platforms = content.site.reviewPlatforms || [];
  if (!platforms.length) return '';
  return html`<section id="reviews" class="sec reviews-sec" aria-labelledby="reviews-title">
<div class="wrap">
  <div class="sec-head"><h2 class="h2" id="reviews-title">Рейтинги TutorOnline на независимых площадках</h2></div>
  <ul class="rv-grid">
    ${platforms.map(platform => html`<li class="rv-item">
      <span class="rv-logo"><img src="/assets/reviews/${platform.logo}" alt="${platform.name}" height="28" loading="lazy" decoding="async"></span>
      <span class="rv-val">${platform.rating}<img src="/assets/icons/star-rating.png" alt="" width="20" height="20" loading="lazy"></span>
    </li>`)}
  </ul>
</div>
</section>`;
}

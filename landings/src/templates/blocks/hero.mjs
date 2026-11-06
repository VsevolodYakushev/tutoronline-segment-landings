import { html } from '../html.mjs';
import { tutorPicture } from './picture.mjs';

const NOTE = {
  parent: 'После урока вы решаете, продолжать занятия или нет',
  student: 'После урока ты решаешь, продолжать занятия или нет',
};

function variantText(hero, key) {
  const a = hero.a?.[key] || '';
  const b = hero.b?.[key] || a;
  if (a === b) return a;
  return html`<span data-variant-only="a">${a}</span><span data-variant-only="b">${b}</span>`;
}

// First screen: pain headline, offer, 3 tutors with names, seats counter, CTA — no scroll at 360×560 (FR-004).
export function hero({ segment, tutorsById, content }) {
  const tutors = (segment.heroTutorIds || []).map(id => tutorsById[id]).filter(Boolean).slice(0, 3);
  return html`<section id="top" class="hero" aria-labelledby="hero-title">
<div class="wrap hero-grid">
  <div class="hero-copy">
    <p class="hero-source" data-source-note hidden></p>
    <p class="hero-badge"><span class="hero-badge-price">0 ₽</span><span>${variantText(segment.hero, 'offerBadge')}</span></p>
    <h1 id="hero-title" class="hero-title">${variantText(segment.hero, 'title')}</h1>
    <p class="hero-sub">${variantText(segment.hero, 'subtitle')}</p>
  </div>
  <div class="hero-tutors">
    <ul class="hero-avatars">
      ${tutors.map((tutor, index) => html`<li class="hero-avatar">
        <span class="hero-avatar-photo">${tutorPicture(tutor, { sizes: '(min-width: 1024px) 160px, 56px', widths: [160, 320], fallback: 160, eager: index === 0, alt: '', className: 'hero-avatar-img' })}</span>
        <span class="hero-avatar-name">${tutor.name}</span>
      </li>`)}
    </ul>
    <div class="hero-tutors-info">
      <p class="hero-tutors-caption">Пробные онлайн-уроки ведут <b>${tutors.map(tutor => tutor.name).join(', ')}</b></p>
      <p class="seats-badge" data-seats-badge hidden><span class="seats-dot" aria-hidden="true"></span><span data-seats></span></p>
    </div>
  </div>
  <div class="hero-actions">
    <div class="hero-cta-wrap">
      <a class="btn btn-accent btn-l hero-cta" href="#form" data-cta="hero">Забронировать бесплатный урок</a>
      <span class="sticker is-discount hero-sticker needs-js" data-timer-bound aria-hidden="true">−${content.offer.discount} ₽</span>
    </div>
    <p class="hero-note">${NOTE[segment.audience] || NOTE.parent}</p>
  </div>
</div>
</section>`;
}

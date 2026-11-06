import { html } from '../html.mjs';

const WIDTHS = [160, 320, 500, 640];

// Tutor photo: AVIF + WebP with srcset; focal point via class (no inline styles — CSP).
export function tutorPicture(tutor, { sizes, widths = WIDTHS, fallback = 320, className = 'tut-img', eager = false, alt } = {}) {
  if (!tutor?.photo) return '';
  const base = `/assets/tutors/${tutor.photo.webp}`;
  const set = ext => widths.map(width => `${base}-${width}.${ext} ${width}w`).join(', ');
  const focal = tutor.photo.focal === 'center 18%' ? ' is-portrait' : '';
  return html`<picture>
<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">
<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
<img class="${className}${focal}" src="${base}-${fallback}.webp" alt="${alt ?? tutor.name}" width="${fallback}" height="${fallback}" decoding="async"${eager ? html` fetchpriority="high"` : html` loading="lazy"`}>
</picture>`;
}

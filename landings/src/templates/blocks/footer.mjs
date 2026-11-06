import { html } from '../html.mjs';

// Legal block and contacts carried over from the base landing footer.
export function footer({ content }) {
  const { site } = content;
  return html`<footer class="site-footer">
<div class="wrap footer-grid">
  <div class="footer-brand">
    <img src="/assets/logo/logo_big_white.svg" width="150" height="38" alt="${site.brand}" loading="lazy">
    <a class="footer-contact" href="${site.phoneHref}">${site.phone}</a>
    <a class="footer-contact" href="mailto:${site.email}">${site.email}</a>
    <span class="footer-muted">${site.hours}</span>
    <a class="footer-link" href="${site.legal.license.href}">${site.legal.license.label}</a>
  </div>
  <nav class="footer-docs" aria-label="Документы">
    ${site.legal.documents.map(doc => html`<a class="footer-link" href="${doc.href}">${doc.label}</a>`)}
  </nav>
  <div class="footer-company">
    ${site.legal.company.map(line => html`<span class="footer-muted">${line}</span>`)}
  </div>
</div>
</footer>`;
}

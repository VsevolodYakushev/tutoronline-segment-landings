import { html } from '../html.mjs';

export function header({ content }) {
  const { site } = content;
  return html`<header class="site-header">
<div class="wrap site-header-row">
  <a class="brand" href="#top" aria-label="${site.brand} — наверх"><img src="/assets/logo/logo_big.svg" width="140" height="36" alt="${site.brand}"></a>
  <a class="header-phone" href="${site.phoneHref}"><span class="ico ico-call" aria-hidden="true"></span><span class="header-phone-text">${site.phone}</span></a>
</div>
</header>`;
}

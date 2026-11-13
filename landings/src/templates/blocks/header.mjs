import { html } from '../html.mjs';

export function header({ content }) {
  const { site } = content;
  return html`<header class="site-header">
<div class="wrap site-header-row">
  <a class="brand" href="#top" aria-label="${site.brand} — наверх"><img src="/assets/logo/logo_big.svg" width="140" height="36" alt="${site.brand}"></a>
  <!-- На узких экранах номер скрыт (.header-phone-text), остаётся только иконка,
       поэтому у ссылки обязателен aria-label: иначе у неё нет доступного имени. -->
  <a class="header-phone" href="${site.phoneHref}" aria-label="Позвонить: ${site.phone}"><span class="ico ico-call" aria-hidden="true"></span><span class="header-phone-text">${site.phone}</span></a>
</div>
</header>`;
}

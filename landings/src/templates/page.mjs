import { html, raw } from './html.mjs';
import * as blocks from './blocks/index.mjs';

// Runs in <head> before first paint: marks JS, picks the A/B variant (?v= → cookie → localStorage → "a").
function headScript(segmentId, storageVersion) {
  const key = `tst_${storageVersion}_${segmentId}`;
  return `(function(d){var h=d.documentElement,v=null;h.classList.add('js');try{var m=/[?&]v=([ab])(?:&|$)/.exec(location.search);if(m)v=m[1]}catch(e){}if(!v){try{var c=/(?:^|; )${key.replace(/-/g, '\\-')}=\\d+\\.\\d+\\.([ab])(?:;|$)/.exec(d.cookie);if(c)v=c[1]}catch(e){}}if(!v){try{var s=JSON.parse(localStorage.getItem('${key}'));if(s&&(s.variant==='a'||s.variant==='b'))v=s.variant}catch(e){}}h.setAttribute('data-variant',v||'a')})(document);`;
}

function metrika(id) {
  if (!id) return '';
  return html`<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${raw(Number(id))},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});</script>`;
}

export function pageConfig({ segment, content, tutorsById }) {
  const ids = new Set([...(segment.heroTutorIds || []), ...Object.values(segment.tutorIds || {}).flat()]);
  return {
    segment: {
      id: segment.id, path: segment.path, grades: segment.grades, defaultGrade: segment.defaultGrade,
      audience: segment.audience, tutorIds: segment.tutorIds, topbar: segment.topbar, quizVariant: segment.quizVariant || null,
      subjects: segment.subjects || ['math'],
    },
    offer: content.offer,
    schedule: content.schedule,
    tutors: [...ids].map(id => tutorsById[id]).filter(Boolean),
    site: {
      phone: content.site.phone, phoneHref: content.site.phoneHref, ymCounterId: content.site.ymCounterId,
      grades: content.site.grades || segment.grades, subjects: content.site.subjects || {}, sourceNotes: content.site.sourceNotes || {},
    },
  };
}

export function renderPage(ctx) {
  const { segment, content, assets } = ctx;
  const config = JSON.stringify(pageConfig(ctx)).replace(/</g, '\\u003c');
  const extra = new Set(segment.extraBlocks || []);
  return `<!doctype html>\n${html`<html lang="ru" data-segment="${segment.id}" data-theme="${segment.theme || 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${segment.meta?.title || content.site.brand}</title>
<meta name="description" content="${segment.meta?.description || ''}">
<meta name="theme-color" content="#5756b3">
<meta name="format-detection" content="telephone=no">
<link rel="preload" href="/assets/fonts/graphik-500.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<script>${raw(headScript(segment.id, content.offer.storageVersion))}</script>
${metrika(content.site.ymCounterId)}
</head>
<body>
${blocks.topbar(ctx)}
${blocks.header(ctx)}
<main id="main">
${blocks.hero(ctx)}
<div class="lp-grid">
${blocks.pains(ctx)}
${blocks.trial(ctx)}
${extra.has('oge') ? blocks.oge(ctx) : ''}
${blocks.tutors(ctx)}
${blocks.reviews(ctx)}
${blocks.offer(ctx)}
${blocks.quiz(ctx)}
${blocks.faq(ctx)}
${extra.has('parents') ? blocks.parents(ctx) : ''}
${blocks.final(ctx)}
</div>
</main>
${blocks.footer(ctx)}
${blocks.sticky(ctx)}
<script type="application/json" id="lp-config">${raw(config)}</script>
<script type="module" src="${assets.js}"></script>
</body>
</html>`}\n`;
}

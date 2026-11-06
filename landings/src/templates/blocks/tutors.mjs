import { html } from '../html.mjs';
import { tutorPicture } from './picture.mjs';

const TEXT = {
  parent: { title: 'Репетиторы, которые проводят пробные уроки', lead: 'Выберите репетитора — он будет ждать вас на уроке.', cta: 'Хочу к этому репетитору' },
  student: { title: 'Репетиторы, которые проводят пробные уроки', lead: 'Выбери репетитора — он будет ждать тебя на уроке.', cta: 'Хочу к этому репетитору' },
};

const years = n => {
  const abs = n % 100; const last = n % 10;
  const word = abs > 10 && abs < 20 ? 'лет' : last === 1 ? 'год' : last > 1 && last < 5 ? 'года' : 'лет';
  return `${n} ${word}`;
};
const thousands = n => n.toLocaleString('ru-RU').replace(/ /g, ' ');
const rating = n => n.toFixed(1).replace('.', ',');

function card(tutor, cta) {
  const meta = [
    tutor.experienceYears != null && html`<span class="tut-m"><span class="tut-mv">${years(tutor.experienceYears)}</span><span class="tut-ml">опыт</span></span>`,
    tutor.lessonsCount != null && html`<span class="tut-m"><span class="tut-mv">${thousands(tutor.lessonsCount)}</span><span class="tut-ml">онлайн-уроков</span></span>`,
    tutor.rating != null && html`<span class="tut-m"><span class="tut-mv"><img src="/assets/icons/star-rating.png" alt="" width="18" height="18" loading="lazy">${rating(tutor.rating)}</span><span class="tut-ml">рейтинг</span></span>`,
  ].filter(Boolean);
  return html`<article class="tut-card">
<div class="tut-photo">${tutorPicture(tutor, { sizes: '(min-width: 768px) 320px, 260px', widths: [320, 500, 640], fallback: 500 })}</div>
<div class="tut-body">
  <p class="tut-name-row"><span class="tut-name">${tutor.name}</span>${tutor.verified ? html`<span class="tut-ver" tabindex="0"><span class="ico ico-shield" role="img" aria-label="Проверенный преподаватель"></span><span class="tut-tip" role="tooltip">Проверка пройдена! Наши стандарты проверки гарантируют, что вы получаете обучение от квалифицированного преподавателя.</span></span>` : ''}</p>
  <p class="tut-subjects">${tutor.subjectsLabel}</p>
</div>
${meta.length ? html`<div class="tut-meta">${meta}</div>` : ''}
<a class="tut-btn" href="#form" data-tutor="${tutor.id}" data-cta="tutor_card">${cta}</a>
</article>`;
}

export function tutors({ segment, tutorsById }) {
  const text = TEXT[segment.audience] || TEXT.parent;
  const list = (segment.tutorIds?.math || []).map(id => tutorsById[id]).filter(Boolean);
  if (!list.length) return '';
  return html`<section id="tutors" class="sec tutors-sec" aria-labelledby="tutors-title">
<div class="wrap">
  <div class="sec-head">
    <h2 class="h2" id="tutors-title">${segment.tutorsBlock?.title || text.title}</h2>
    <p class="lead">${segment.tutorsBlock?.lead || text.lead}</p>
  </div>
  <div class="tut-track" tabindex="0" role="region" aria-label="Репетиторы">
    ${list.map(tutor => card(tutor, text.cta))}
  </div>
</div>
</section>`;
}

import { html } from '../html.mjs';

const rub = value => `${Number(value).toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;

const COPY = {
  parent: {
    title: 'Забронируйте бесплатный пробный урок',
    sub: '3 коротких шага — меньше минуты',
    steps: { a: ['Для кого урок?', 'Выберите репетитора и время', 'Куда прислать подтверждение?'], b: ['Класс и предмет', 'Кто проведёт урок', 'Контакты для брони'] },
  },
  student: {
    title: 'Забронируй бесплатный пробный урок',
    sub: '3 коротких шага — меньше минуты',
    steps: { a: ['Какой класс и предмет?', 'Выбери репетитора и время', 'Куда прислать подтверждение?'], b: ['Класс и предмет', 'Кто проведёт урок', 'Контакты для брони'] },
  },
};

function stepTitle(segment, copy, index) {
  const a = segment.quizVariant?.a?.[index] || copy.steps.a[index];
  const b = segment.quizVariant?.b?.[index] || copy.steps.b[index];
  return html`<span data-variant-only="a">${a}</span><span data-variant-only="b">${b}</span>`;
}

function checkbox({ id, name, required, children }) {
  return html`<div class="field field-check" data-field="${name}">
  <label class="cb" for="${id}"><input type="checkbox" id="${id}" name="${name}"${required ? html` required aria-describedby="${id}-error"` : ''}><span class="cb-box" aria-hidden="true"></span><span class="cb-text">${children}</span></label>
  <p class="field-error" id="${id}-error" hidden></p>
</div>`;
}

export function quiz({ segment, content }) {
  const copy = COPY[segment.audience] || COPY.parent;
  const { offer, site } = content;
  const subjects = (segment.subjects?.length ? segment.subjects : ['math']).filter(key => site.subjects?.[key]);
  const otherGrades = (site.grades || []).filter(grade => !segment.grades.includes(grade));
  return html`<section id="form" class="sec quiz-sec" aria-labelledby="quiz-title">
<div class="wrap">
<div class="quiz-card">
  <div class="quiz-head">
    <h2 id="quiz-title" class="quiz-title">${copy.title}</h2>
    <p class="quiz-sub">${copy.sub}</p>
  </div>
  <p class="no-js-only quiz-nojs">Онлайн-бронь работает с включённым JavaScript. Запишитесь по телефону: <a href="${site.phoneHref}">${site.phone}</a></p>
  <form class="quiz needs-js" data-quiz novalidate aria-labelledby="quiz-title">
    <div class="quiz-progress" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" aria-label="Шаг брони" data-progress>
      <span class="quiz-progress-label">Шаг <b data-step-now>1</b> из 3</span>
      <span class="quiz-progress-bar" aria-hidden="true"><span class="quiz-progress-fill" data-step-fill></span></span>
    </div>

    <fieldset class="quiz-step" data-step="1">
      <legend class="quiz-step-title" tabindex="-1">${stepTitle(segment, copy, 0)}</legend>
      <p class="quiz-label" id="quiz-grade-label">Класс</p>
      <div class="chips" role="group" aria-labelledby="quiz-grade-label">
        ${segment.grades.map(grade => html`<button type="button" class="chip" data-grade="${grade}" aria-pressed="${grade === segment.defaultGrade ? 'true' : 'false'}">${grade} класс</button>`)}
        ${otherGrades.length ? html`<button type="button" class="chip chip-more" data-grades-toggle aria-expanded="false" aria-controls="quiz-grades-other">Другой класс</button>` : ''}
      </div>
      ${otherGrades.length ? html`<div class="chips chips-other" id="quiz-grades-other" role="group" aria-label="Другие классы" data-grades-other hidden>
        ${otherGrades.map(grade => html`<button type="button" class="chip" data-grade="${grade}" aria-pressed="false">${grade} класс</button>`)}
      </div>` : ''}
      <p class="quiz-label" id="quiz-subject-label">Предмет <span class="quiz-label-note">можно выбрать несколько</span></p>
      <div class="chips" role="group" aria-labelledby="quiz-subject-label">
        ${subjects.map((key, index) => html`<button type="button" class="chip" data-subject="${key}" aria-pressed="${index === 0 ? 'true' : 'false'}">${site.subjects[key]}</button>`)}
      </div>
      <p class="field-error" data-step1-error hidden></p>
    </fieldset>

    <fieldset class="quiz-step" data-step="2" hidden>
      <legend class="quiz-step-title" tabindex="-1">${stepTitle(segment, copy, 1)}</legend>
      <p class="quiz-note" data-grade-note hidden></p>
      <div class="tutor-picks" role="group" aria-label="Репетитор" data-tutor-list></div>
      <p class="quiz-label" id="quiz-slot-label">Время урока <span class="quiz-label-note">по Москве (МСК), урок ${content.schedule.lessonMinutes} минут</span></p>
      <div class="slot-days" role="group" aria-labelledby="quiz-slot-label" data-slot-list></div>
      <p class="quiz-wait" data-wait hidden></p>
      <p class="hold-timer" data-hold role="timer" aria-live="polite" hidden><span class="ico ico-lock" aria-hidden="true"></span><span>Место закреплено за вами <b data-hold-left>10:00</b></span></p>
      <p class="field-error" data-step2-error hidden></p>
    </fieldset>

    <fieldset class="quiz-step" data-step="3" hidden>
      <legend class="quiz-step-title" tabindex="-1">${stepTitle(segment, copy, 2)}</legend>
      <div class="field" data-field="name">
        <label class="field-label" for="quiz-name">Имя</label>
        <input class="field-input" id="quiz-name" name="name" type="text" autocomplete="given-name" maxlength="150" required aria-describedby="quiz-name-error">
        <p class="field-error" id="quiz-name-error" hidden></p>
      </div>
      <div class="field" data-field="phone">
        <label class="field-label" for="quiz-phone">Телефон</label>
        <input class="field-input" id="quiz-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" maxlength="18" required aria-describedby="quiz-phone-error">
        <p class="field-error" id="quiz-phone-error" hidden></p>
      </div>
      <div class="discount-box" data-discount-box>
        <p class="discount-title" data-discount-title>Заполните также для получения скидки</p>
        <div class="field" data-field="email">
          <label class="field-label" for="quiz-email">Email <span class="field-hint" data-discount-hint>— пришлём скидку −${offer.discount} ₽ на первое платное занятие</span></label>
          <input class="field-input" id="quiz-email" name="email" type="email" autocomplete="email" maxlength="254" aria-describedby="quiz-email-error">
          <p class="field-error" id="quiz-email-error" hidden></p>
        </div>
      </div>
      <div class="promo-plate"><span class="ico ico-ticket-star" aria-hidden="true"></span><span class="promo-text">Промокод на 100% уже применён</span>${offer.promoCode ? html`<code class="promo-code" data-promo>${offer.promoCode}</code>` : ''}</div>
      <dl class="price-total">
        <dt>Пробный урок</dt>
        <dd><s>${rub(offer.trialPrice)}</s> <b>${rub(offer.trialFinal)}</b></dd>
      </dl>
      <p class="price-discount" data-timer-bound>−${offer.discount} ₽ на первое платное занятие<span class="burned-label"> — сгорела</span></p>
      ${checkbox({ id: 'quiz-commitment', name: 'commitment', required: true, children: 'Я приду на урок. Если планы изменятся — предупрежу за 3 часа, чтобы место получил другой ученик' })}
      ${checkbox({ id: 'quiz-consent-pd', name: 'consentPd', required: true, children: html`Даю <a href="${site.legal.consentPd}" target="_blank" rel="noopener">Согласие</a> на обработку персональных данных в соответствии с <a href="${site.legal.policy}" target="_blank" rel="noopener">Политикой</a>` })}
      ${checkbox({ id: 'quiz-consent-ads', name: 'consentAds', required: false, children: html`Даю <a href="${site.legal.consentAds}" target="_blank" rel="noopener">Согласие</a> на получение информационной и рекламной рассылки` })}
    </fieldset>

    <div class="quiz-nav">
      <button type="button" class="btn btn-ghost btn-m quiz-back" data-action="back" hidden>Назад</button>
      <button type="button" class="btn btn-accent btn-l quiz-next" data-action="next">Далее</button>
      <button type="submit" class="btn btn-accent btn-l quiz-submit" data-action="submit" hidden>Закрепить урок</button>
    </div>
    <p class="quiz-status" role="status" aria-live="polite" data-status hidden></p>
  </form>
  <div class="ticket" data-ticket tabindex="-1" hidden></div>
</div>
</div>
</section>`;
}

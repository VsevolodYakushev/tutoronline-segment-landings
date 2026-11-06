import { html } from '../html.mjs';

const rub = value => `${Number(value).toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;
const TEXT = {
  parent: { title: 'Что вы получаете', lead: 'Одно предложение в три шага', next: 'Если после пробного решите продолжить.' },
  student: { title: 'Что ты получаешь', lead: 'Одно предложение в три шага', next: 'Если после пробного решишь продолжить.' },
};

// Offer stack (FR-008, ТЗ §3): free trial → 100% promo code → −1500 ₽ on the first paid lesson, tied to the timer.
export function offer({ segment, content }) {
  const { offer: o } = content;
  const text = TEXT[segment.audience] || TEXT.parent;
  return html`<section id="offer" class="sec offer-sec" aria-labelledby="offer-title">
<div class="wrap">
  <div class="sec-head"><h2 class="h2" id="offer-title">${text.title}</h2><p class="lead">${text.lead}</p></div>
  <ol class="ladder">
    <li class="ladder-step">
      <span class="ladder-num" aria-hidden="true">1</span>
      <div class="ladder-body">
        <h3 class="ladder-title">Бесплатный пробный урок</h3>
        <p class="ladder-text">45 минут с репетитором: диагностика пробелов и план занятий.</p>
        <p class="ladder-price"><s>${rub(o.trialPrice)}</s> <b>${rub(o.trialFinal)}</b></p>
      </div>
      <span class="sticker" aria-hidden="true">0 ₽</span>
    </li>
    <li class="ladder-step">
      <span class="ladder-num" aria-hidden="true">2</span>
      <div class="ladder-body">
        <h3 class="ladder-title">Промокод на 100%</h3>
        <p class="ladder-text">Код закрепляется за бронью и применяется автоматически — платить за пробный урок не нужно.</p>
      </div>
    </li>
    <li class="ladder-step is-discount" data-timer-bound>
      <span class="ladder-num" aria-hidden="true">3</span>
      <div class="ladder-body">
        <h3 class="ladder-title">−${o.discount} ₽ на первое платное занятие</h3>
        <p class="ladder-text">${text.next}</p>
        ${o.lessonPrice ? html`<p class="ladder-price"><s>${rub(o.lessonPrice)}</s> <b>${rub(o.lessonPrice - o.discount)}</b></p>` : ''}
        <p class="ladder-timer needs-js"><span class="ladder-timer-live">Действует ещё <b data-timer>15:00</b></span><span class="burned-label">Скидка сгорела — бесплатный пробный урок по-прежнему доступен</span></p>
      </div>
      <span class="sticker is-discount" aria-hidden="true">−${o.discount} ₽</span>
    </li>
  </ol>
  <a class="btn btn-accent btn-l offer-cta" href="#form" data-cta="offer">Забронировать бесплатный урок</a>
</div>
</section>`;
}

// Quiz DOM controller (T035): 3 steps, slot hold, validation on blur, submission, ticket.
import { createInitialState, reduce, stepErrors, tutorsForStep, isStepValid, SUBJECTS } from './quiz-state.mjs';
import { buildSlots } from './lib/slots.mjs';
import { attachPhoneMask } from './lib/phone-mask.mjs';
import { addToCalendar } from './lib/calendar.mjs';

const SUBMIT_TIMEOUT_MS = 22000;
const FIELD_IDS = { name: 'quiz-name', phone: 'quiz-phone', email: 'quiz-email', commitment: 'quiz-commitment', consentPd: 'quiz-consent-pd', consentAds: 'quiz-consent-ads' };
const SERVER_FIELD_ERRORS = {
  invalid_phone: ['phone', 'Проверьте номер телефона'],
  invalid_email: ['email', 'Проверьте адрес почты'],
  commitment_required: ['commitment', 'Отметьте, что придёте на урок'],
  consent_required: ['consentPd', 'Нужно согласие на обработку данных'],
};
const WORDS = {
  parent: { wait: 'будет ждать вас', got: 'вашу бронь', you: 'вами' },
  student: { wait: 'будет ждать тебя', got: 'твою бронь', you: 'тобой' },
};

const pad = value => String(value).padStart(2, '0');
const mmss = ms => { const total = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`; };
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(child => child != null && child !== false));
  return node;
};

function picture(tutor, sizes = '72px') {
  if (!tutor.photo) return el('span', { class: 'tutor-pick-avatar is-empty', 'aria-hidden': 'true' }, el('span', { class: 'ico ico-profile' }));
  const base = `/assets/tutors/${tutor.photo.webp}`;
  const set = ext => [160, 320].map(width => `${base}-${width}.${ext} ${width}w`).join(', ');
  return el('picture', { class: 'tutor-pick-avatar' },
    el('source', { type: 'image/avif', srcset: set('avif'), sizes }),
    el('source', { type: 'image/webp', srcset: set('webp'), sizes }),
    el('img', { src: `${base}-160.webp`, alt: '', width: 160, height: 160, loading: 'lazy', decoding: 'async', class: tutor.photo.focal === 'center 18%' ? 'is-portrait' : null }));
}

export function init(ctx) {
  const root = document.querySelector('[data-quiz]');
  if (!root) return;
  const { config, visitor, analytics } = ctx;
  const { segment, offer, schedule, site } = config;
  const words = WORDS[segment.audience] || WORDS.parent;
  const tutorsById = Object.fromEntries(config.tutors.map(tutor => [tutor.id, tutor]));
  const draftKey = `tquiz_${offer.storageVersion}_${segment.id}`;
  const node = {
    steps: [...root.querySelectorAll('fieldset[data-step]')],
    progress: root.querySelector('[data-progress]'),
    stepNow: root.querySelector('[data-step-now]'),
    fill: root.querySelector('[data-step-fill]'),
    tutorList: root.querySelector('[data-tutor-list]'),
    slotList: root.querySelector('[data-slot-list]'),
    wait: root.querySelector('[data-wait]'),
    hold: root.querySelector('[data-hold]'),
    holdLeft: root.querySelector('[data-hold-left]'),
    step2Error: root.querySelector('[data-step2-error]'),
    back: root.querySelector('[data-action="back"]'),
    next: root.querySelector('[data-action="next"]'),
    submit: root.querySelector('[data-action="submit"]'),
    status: root.querySelector('[data-status]'),
    discountTitle: root.querySelector('[data-discount-title]'),
    discountHint: root.querySelector('[data-discount-hint]'),
    ticket: document.querySelector('[data-ticket]'),
    head: document.querySelector('.quiz-head'),
  };
  const fields = Object.fromEntries(Object.entries(FIELD_IDS).map(([name, id]) => [name, document.getElementById(id)]));
  attachPhoneMask(fields.phone);

  let state = createInitialState({ segment, params: new URLSearchParams(location.search), tutorsById });
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if (draft && typeof draft === 'object') {
      state = { ...state, ...draft, status: draft.status === 'ticket' ? 'ticket' : 'editing', errorCode: null };
      if (state.holdExpiresAt && Date.now() >= state.holdExpiresAt) state = reduce(state, { type: 'holdExpired' });
    }
  } catch { /* no draft */ }
  for (const [name, input] of Object.entries(fields)) {
    if (input.type === 'checkbox') input.checked = Boolean(state[name]);
    else input.value = state[name] || '';
  }

  const touched = new Set();
  let shownStep = 0;
  let renderedTutorKey = '';
  let renderedSlotKey = '';
  let submissionKey = null;
  let submissionSignature = null;
  let holdTimer = null;
  let started = false;

  const offerExpired = () => document.documentElement.dataset.offer === 'expired';
  let seen = false;
  const trackStep = () => {
    if (!seen) return; // the first step event fires when the form is actually seen
    analytics?.track(`lp_step_${state.step}`, state.step === 2 ? { step: 2, subject: state.subject, grade: state.grade } : { step: state.step });
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !seen) { seen = true; observer.disconnect(); if (state.status !== 'ticket') trackStep(); }
    }, { threshold: 0.3 });
    observer.observe(root);
  } else seen = true;
  const currentTutor = () => (state.tutorId ? tutorsById[state.tutorId] : null);
  const track = (event, params) => analytics?.track(event, params);

  function save() {
    try {
      const { status, errorCode, ...rest } = state;
      sessionStorage.setItem(draftKey, JSON.stringify({ ...rest, status: status === 'ticket' ? 'ticket' : 'editing' }));
    } catch { /* storage unavailable */ }
  }

  function dispatch(action) {
    const before = state;
    state = reduce(state, action);
    if (state !== before) { save(); render(); }
  }

  function markStarted(source = 'form') {
    if (started) return;
    started = true;
    document.dispatchEvent(new CustomEvent('lp:form-start', { detail: { source } }));
  }

  function showFieldError(name, message) {
    const input = fields[name];
    const box = input.closest('[data-field]');
    const error = document.getElementById(`${FIELD_IDS[name]}-error`);
    box.classList.toggle('is-error', Boolean(message));
    box.classList.toggle('is-valid', !message && Boolean(input.type === 'checkbox' ? input.checked : input.value.trim()));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) { error.textContent = message || ''; error.hidden = !message; }
  }

  function renderTutors() {
    const list = tutorsForStep({ segment, subject: state.subject, tutorsById, preferredId: state.preferredTutorId });
    const key = `${state.subject}|${list.map(tutor => tutor.id).join(',')}|${state.tutorId}`;
    if (key === renderedTutorKey) return;
    renderedTutorKey = key;
    node.tutorList.replaceChildren(...list.map(tutor => {
      const meta = tutor.placeholder ? 'Менеджер подберёт и подтвердит урок' : [tutor.subjectsLabel, tutor.experienceYears != null ? `стаж ${tutor.experienceYears} ${tutor.experienceYears % 10 === 1 && tutor.experienceYears % 100 !== 11 ? 'год' : [2, 3, 4].includes(tutor.experienceYears % 10) && ![12, 13, 14].includes(tutor.experienceYears % 100) ? 'года' : 'лет'}` : null].filter(Boolean).join(' · ');
      const button = el('button', { type: 'button', class: 'tutor-pick', 'data-tutor-id': tutor.id, 'aria-pressed': String(tutor.id === state.tutorId) },
        picture(tutor),
        el('span', { class: 'tutor-pick-text' }, el('span', { class: 'tutor-pick-name', text: tutor.name }), el('span', { class: 'tutor-pick-meta', text: meta })));
      button.addEventListener('click', () => {
        markStarted();
        dispatch({ type: 'tutor', tutorId: tutor.id });
        track('lp_tutor_select', { tutor_id: tutor.id, origin: 'form' });
      });
      return button;
    }));
  }

  function renderSlots() {
    const tutor = currentTutor();
    const key = `${state.tutorId}|${state.slot?.startsAt || ''}|${new Date().getUTCHours()}`;
    if (key === renderedSlotKey) return;
    renderedSlotKey = key;
    if (!tutor) {
      node.slotList.replaceChildren(el('p', { class: 'slot-hint', text: 'Сначала выберите репетитора — покажем его свободное время.' }));
      return;
    }
    const days = buildSlots({ weekly: schedule.weekly, tutorId: tutor.id, now: Date.now(), leadHours: schedule.leadHours, daysToShow: schedule.daysToShow });
    node.slotList.replaceChildren(...days.map(day => el('div', { class: 'slot-day' },
      el('p', { class: 'slot-day-label', text: day.label }),
      el('div', { class: 'slot-grid' }, ...day.slots.map(slot => {
        const button = el('button', { type: 'button', class: 'slot', 'data-starts-at': slot.startsAt, 'aria-pressed': String(slot.startsAt === state.slot?.startsAt), 'aria-label': slot.label, text: slot.time });
        button.addEventListener('click', () => {
          markStarted();
          dispatch({ type: 'slot', slot: { startsAt: slot.startsAt, label: slot.label, short: slot.short }, now: Date.now(), holdMinutes: schedule.holdMinutes });
        });
        return button;
      })))));
  }

  function tickHold() {
    if (!state.holdExpiresAt || state.status === 'ticket') { node.hold.hidden = true; return; }
    const left = state.holdExpiresAt - Date.now();
    if (left <= 0) { dispatch({ type: 'holdExpired' }); return; }
    node.hold.hidden = false;
    node.holdLeft.textContent = mmss(left);
  }

  function syncHoldTimer() {
    const needed = Boolean(state.holdExpiresAt) && state.status !== 'ticket';
    if (needed && !holdTimer) holdTimer = setInterval(tickHold, 1000);
    if (!needed && holdTimer) { clearInterval(holdTimer); holdTimer = null; }
    tickHold();
  }

  function submitLabel() {
    const tutor = currentTutor();
    return tutor && !tutor.placeholder && tutor.nameGenitive ? `Закрепить урок у ${tutor.nameGenitive}` : 'Закрепить пробный урок';
  }

  function render() {
    // Steps & progress
    node.steps.forEach(step => { step.hidden = Number(step.dataset.step) !== state.step || state.status === 'ticket'; });
    node.progress.setAttribute('aria-valuenow', String(state.step));
    node.stepNow.textContent = String(state.step);
    node.fill.dataset.fillStep = String(state.step);
    if (shownStep !== state.step && state.status !== 'ticket') {
      const direction = state.step > shownStep ? 'is-forward' : 'is-back';
      const current = node.steps[state.step - 1];
      current.classList.remove('is-forward', 'is-back');
      void current.offsetWidth; // restart the slide animation
      if (shownStep) current.classList.add(direction);
      if (shownStep) {
        current.querySelector('legend')?.focus({ preventScroll: true });
        trackStep();
      }
      shownStep = state.step;
    }

    // Step 1 chips
    root.querySelectorAll('[data-grade]').forEach(chip => chip.setAttribute('aria-pressed', String(Number(chip.dataset.grade) === state.grade)));
    root.querySelectorAll('[data-subject]').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.subject === state.subject)));

    // Step 2
    renderTutors();
    renderSlots();
    root.querySelectorAll('.tutor-pick').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tutorId === state.tutorId)));
    root.querySelectorAll('.slot').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.startsAt === state.slot?.startsAt)));
    const tutor = currentTutor();
    if (tutor && state.slot) {
      node.wait.hidden = false;
      node.wait.textContent = tutor.placeholder ? `Подберём репетитора к уроку: ${state.slot.short} (МСК)` : `${tutor.name} ${words.wait} в ${state.slot.short} (МСК)`;
    } else node.wait.hidden = true;
    node.hold.querySelector('span:last-child').firstChild.textContent = `Место закреплено за ${words.you} `;
    if (state.notice === 'hold-expired') {
      node.step2Error.hidden = false;
      node.step2Error.textContent = 'Время брони истекло — место освобождено, выберите время снова';
    } else if (state.step !== 2 || node.step2Error.dataset.forced !== '1') node.step2Error.hidden = true;
    syncHoldTimer();

    // Step 3: discount depends on the offer timer (A1)
    const expired = offerExpired();
    node.discountTitle.textContent = expired ? 'Email (необязательно)' : 'Заполните также для получения скидки';
    node.discountHint.hidden = expired;
    const ready = state.step === 3 && isStepValid(state, 3);
    node.submit.classList.toggle('is-ready', ready && state.status !== 'submitting');

    // Navigation
    const ticket = state.status === 'ticket';
    node.back.hidden = state.step === 1 || ticket;
    node.next.hidden = state.step === 3 || ticket;
    node.submit.hidden = state.step !== 3 || ticket;
    node.submit.disabled = state.status === 'submitting';
    // Fields wait with the form: no edits while the booking is being confirmed (FR-021)
    const busy = state.status === 'submitting';
    for (const input of Object.values(fields)) {
      input.closest('[data-field]')?.classList.toggle('is-loading', busy);
      if (input.type === 'checkbox') input.disabled = busy;
      else input.readOnly = busy;
    }
    node.submit.textContent = state.status === 'submitting' ? 'Закрепляем…' : submitLabel();
    root.setAttribute('aria-busy', String(state.status === 'submitting'));
    node.progress.hidden = ticket;

    // Status
    if (state.status === 'error') {
      node.status.hidden = false;
      node.status.dataset.error = 'true';
      node.status.replaceChildren(statusMessage(state.errorCode));
    } else if (state.status !== 'submitting') node.status.hidden = true;

    if (ticket) renderTicket();
  }

  function statusMessage(code) {
    const phone = el('a', { href: site.phoneHref, text: site.phone });
    const fragment = document.createDocumentFragment();
    if (code === 'upstream_unconfirmed' || code === 'upstream_timeout') fragment.append('Не удалось подтвердить бронь. Чтобы не создать дубль, уточните запись по телефону: ', phone);
    else if (code === 'invalid_slot') fragment.append('Это время уже недоступно — выберите другое на шаге 2.');
    else if (code === 'invalid_form') fragment.append('Проверьте данные формы. Если ошибка повторится, позвоните: ', phone);
    else fragment.append('Не удалось отправить бронь. Попробуйте ещё раз или позвоните: ', phone);
    return fragment;
  }

  function renderTicket() {
    const tutor = currentTutor() || {};
    const promo = state.promoCode || offer.promoCode;
    const expired = offerExpired();
    const verb = tutor.gender === 'f' ? 'получила' : 'получил';
    node.ticket.replaceChildren(
      el('p', { class: 'ticket-kicker' }, el('span', { class: 'ico ico-ticket', 'aria-hidden': 'true' }), 'Бронь подтверждена'),
      el('p', { class: 'ticket-number' }, 'Номер брони ', el('b', { text: state.bookingId })),
      el('div', { class: 'ticket-tutor' },
        tutor.photo ? picture(tutor, '72px') : el('span', { class: 'tutor-pick-avatar is-empty', 'aria-hidden': 'true' }, el('span', { class: 'ico ico-profile' })),
        el('div', {}, el('p', { class: 'ticket-name', text: tutor.placeholder ? 'Репетитор по русскому языку' : tutor.name }), el('p', { class: 'ticket-when', text: state.slot ? state.slot.label : '' }))),
      el('dl', { class: 'ticket-rows' },
        el('dt', { text: 'Пробный урок' }), el('dd', {}, el('s', { text: `${offer.trialPrice.toLocaleString('ru-RU').replace(/ /g, ' ')} ₽` }), ' ', el('b', { text: '0 ₽' })),
        promo ? el('dt', { text: 'Промокод' }) : null, promo ? el('dd', {}, el('code', { class: 'promo-code', text: promo })) : null,
        !expired ? el('dt', { text: 'Скидка' }) : null, !expired ? el('dd', { text: `−${offer.discount} ₽ на первое платное занятие` }) : null),
      el('p', { class: 'ticket-note', text: tutor.placeholder ? 'Менеджер подберёт репетитора и подтвердит урок.' : `${tutor.name} ${verb} ${words.got} и готовит урок.` }),
      (() => {
        const button = el('button', { type: 'button', class: 'btn btn-primary btn-m ticket-calendar' }, el('span', { class: 'ico ico-calendar', 'aria-hidden': 'true' }), 'Добавить в календарь');
        const fallback = el('p', { class: 'ticket-fallback', hidden: true, text: `Сохраните дату: ${state.slot?.label || ''}` });
        button.addEventListener('click', () => {
          const result = state.slot && addToCalendar({ bookingId: state.bookingId, tutorName: tutor.placeholder ? '' : tutor.name, startsAt: state.slot.startsAt, durationMin: schedule.lessonMinutes, phone: site.phone });
          if (!result) fallback.hidden = false;
        });
        const wrap = el('div', { class: 'ticket-actions' }, button, fallback);
        return wrap;
      })(),
    );
    node.ticket.hidden = false;
    root.hidden = true;
    if (node.head) node.head.hidden = true;
  }

  function validateField(name) {
    const errors = stepErrors(state, 3);
    showFieldError(name, errors[name] || '');
  }

  function showStepErrors(step) {
    const errors = stepErrors(state, step, Date.now());
    if (step === 2) {
      const message = errors.tutor || errors.slot;
      node.step2Error.hidden = !message;
      node.step2Error.textContent = message || '';
      node.step2Error.dataset.forced = message ? '1' : '';
    }
    if (step === 3) {
      for (const name of Object.keys(FIELD_IDS)) if (name !== 'consentAds') showFieldError(name, errors[name] || '');
      const first = Object.keys(FIELD_IDS).find(name => errors[name]);
      if (first) fields[first].focus();
    }
    return Object.keys(errors).length === 0;
  }

  // Step 1
  root.querySelectorAll('[data-grade]').forEach(chip => chip.addEventListener('click', () => { markStarted(); dispatch({ type: 'grade', grade: Number(chip.dataset.grade) }); }));
  root.querySelectorAll('[data-subject]').forEach(chip => chip.addEventListener('click', () => { markStarted(); dispatch({ type: 'subject', subject: chip.dataset.subject, tutors: tutorsById }); }));

  // Fields: validate on blur, never wipe data on error
  for (const [name, input] of Object.entries(fields)) {
    const isCheck = input.type === 'checkbox';
    input.addEventListener(isCheck ? 'change' : 'input', () => {
      markStarted();
      dispatch({ type: 'field', name, value: isCheck ? input.checked : input.value });
      if (touched.has(name) || isCheck) validateField(name);
    });
    input.addEventListener('focus', () => input.closest('[data-field]')?.classList.add('is-focus'));
    input.addEventListener('blur', () => {
      input.closest('[data-field]')?.classList.remove('is-focus');
      if (isCheck) return;
      if (input.value.trim() || name !== 'email') touched.add(name);
      validateField(name);
    });
  }

  node.next.addEventListener('click', () => {
    markStarted();
    if (!showStepErrors(state.step)) return;
    node.step2Error.dataset.forced = '';
    dispatch({ type: 'next', now: Date.now() });
  });
  node.back.addEventListener('click', () => { node.step2Error.dataset.forced = ''; dispatch({ type: 'back' }); });

  root.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.status === 'submitting') return;
    if (!showStepErrors(3)) return;
    if (!isStepValid(state, 2, Date.now())) { dispatch({ type: 'goto', step: 2 }); showStepErrors(2); return; }
    track('lp_submit');
    const tutor = currentTutor();
    const email = state.email.trim();
    const payload = {
      segment: segment.id, variant: ctx.variant, grade: state.grade, subject: state.subject,
      tutor: { id: tutor.id, name: tutor.name }, slot: state.slot.startsAt,
      name: state.name.trim(), phone: state.phone, email, discountRequested: Boolean(email) && !offerExpired(),
      commitment: state.commitment, consent_pd: state.consentPd, consent_ads: state.consentAds,
      landing: location.origin + location.pathname,
      attribution: Object.fromEntries(Object.entries(visitor.state.firstTouch || {}).filter(([key]) => key.startsWith('utm_'))),
    };
    const signature = JSON.stringify(payload);
    if (signature !== submissionSignature) {
      submissionSignature = signature;
      submissionKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
    dispatch({ type: 'submitting' });
    const result = await send(payload, submissionKey);
    if (result.code === 'submission_changed') {
      submissionKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      Object.assign(result, await send(payload, submissionKey));
    }
    if (result.success) {
      dispatch({ type: 'success', bookingId: result.bookingId, promoCode: result.promoCode });
      visitor.markBooked();
      document.dispatchEvent(new CustomEvent('lp:booked', { detail: { bookingId: result.bookingId } }));
      analytics?.trackOnce?.(`success:${result.bookingId}`, 'lp_success', { booking_id: result.bookingId });
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'landing_lead_success' });
      node.ticket.focus({ preventScroll: false });
      return;
    }
    const fieldError = SERVER_FIELD_ERRORS[result.code];
    if (fieldError) showFieldError(fieldError[0], fieldError[1]);
    dispatch({ type: 'failure', code: result.code });
  });

  async function send(payload, key) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const response = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload), signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.success === true) return { success: true, bookingId: body.bookingId, promoCode: body.promoCode };
      return { success: false, code: body.code || `http_${response.status}` };
    } catch (error) {
      return { success: false, code: controller.signal.aborted ? 'upstream_timeout' : 'network' };
    } finally { clearTimeout(timeout); }
  }

  // "Хочу к этому репетитору" in the tutors block (and any [data-tutor] link)
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-tutor]');
    if (!link) return;
    const tutorId = link.dataset.tutor;
    if (!tutorsById[tutorId] || state.status === 'ticket') return;
    track('lp_tutor_select', { tutor_id: tutorId, origin: 'tutors_block' });
    markStarted('tutor_card');
    state = { ...reduce(reduce(state, { type: 'subject', subject: 'math', tutors: tutorsById }), { type: 'tutor', tutorId }), preferredTutorId: tutorId, step: 2 };
    save();
    render();
  });

  document.addEventListener('lp:expired', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderedSlotKey = ''; render(); } });
  render();
  return { getState: () => state };
}

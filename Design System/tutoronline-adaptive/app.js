'use strict';
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 720px)');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-menu');
  function closeMenu(restoreFocus = false) {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  });
  menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('click', event => { if (!event.target.closest('.landing-header')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) closeMenu(true); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  const portraits = [...document.querySelectorAll('.portrait-person')];
  let portraitIndex = 0;
  let portraitTimer;
  function schedulePortraits() {
    clearInterval(portraitTimer);
    if (reduced.matches || document.hidden || portraits.length < 2) return;
    portraitTimer = setInterval(() => {
      portraits[portraitIndex].classList.remove('is-active');
      portraits[portraitIndex].setAttribute('aria-hidden', 'true');
      portraitIndex = (portraitIndex + 1) % portraits.length;
      portraits[portraitIndex].classList.add('is-active');
      portraits[portraitIndex].setAttribute('aria-hidden', 'false');
    }, 4000);
  }
  schedulePortraits();
  reduced.addEventListener('change', schedulePortraits);
  document.addEventListener('visibilitychange', schedulePortraits);

  document.querySelectorAll('[data-sym]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-sym]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      document.querySelectorAll('.roots-screen [data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== button.dataset.sym; });
    });
  });

  const stage = document.querySelector('.tut-stage');
  const cards = [...stage.querySelectorAll('.tut-cf')];
  const controls = document.createElement('div');
  controls.className = 'tutor-controls';
  const previous = stage.querySelector('[data-direction="-1"]');
  const next = stage.querySelector('[data-direction="1"]');
  const count = document.createElement('span'); count.className = 'tutor-count'; count.setAttribute('aria-live', 'polite');
  controls.append(previous, count, next); stage.after(controls);
  stage.setAttribute('aria-label', 'Преподаватели математики'); stage.tabIndex = 0;
  function activeIndex() {
    return cards.reduce((best, card, index) => Math.abs(card.offsetLeft - stage.scrollLeft) < Math.abs(cards[best].offsetLeft - stage.scrollLeft) ? index : best, 0);
  }
  function updateCount() { count.textContent = `${activeIndex() + 1} / ${cards.length}`; }
  function move(direction) {
    const index = (activeIndex() + direction + cards.length) % cards.length;
    stage.scrollTo({ left: cards[index].offsetLeft - cards[0].offsetLeft, behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
  stage.addEventListener('scroll', updateCount, { passive: true });
  stage.addEventListener('keydown', event => {
    if (event.target !== stage) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
  });
  updateCount();

  // Progressive enhancement: content stays readable without JavaScript.
  const watched = document.querySelectorAll('.tk-fill,.dg4-watch');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('go'); observer.unobserve(entry.target); }
    }), { threshold: .2 });
    watched.forEach(element => observer.observe(element));
  } else watched.forEach(element => element.classList.add('go'));

  const sticky = document.querySelector('.m-sticky');
  let heroVisible = true; let formVisible = false; let footerVisible = false;
  const updateSticky = () => { sticky.hidden = !mobile.matches || heroVisible || formVisible || footerVisible; };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target.id === 'top') heroVisible = entry.isIntersecting;
        if (entry.target.id === 'form') formVisible = entry.isIntersecting;
        if (entry.target.matches('footer')) footerVisible = entry.isIntersecting;
      });
      updateSticky();
    });
    [document.querySelector('#top'),document.querySelector('#form'),document.querySelector('footer')].forEach(element => observer.observe(element));
  }
  mobile.addEventListener('change', updateSticky);

  const form = document.querySelector('.cf-form');
  const status = form.querySelector('.form-status');
  const phone = form.elements.phone;
  let submissionKey = null;
  let submissionSignature = null;
  phone.addEventListener('input', () => phone.setCustomValidity(''));
  function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); status.hidden = false; }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const digits = phone.value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) { phone.setCustomValidity('Укажите телефон с кодом страны, от 10 до 15 цифр'); phone.reportValidity(); return; }
    phone.setCustomValidity('');
    if (!form.reportValidity()) return;
    const endpoint = window.LANDING_CONFIG?.leadEndpoint;
    if (!endpoint) {
      status.replaceChildren(document.createTextNode('Онлайн-запись пока недоступна. Позвоните нам: '));
      const link = document.createElement('a'); link.href = 'tel:+74997041212'; link.textContent = '+7 (499) 704-12-12'; status.append(link);
      status.dataset.error = 'true'; status.hidden = false; return;
    }
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true; button.textContent = 'Отправляем…'; form.setAttribute('aria-busy', 'true');
    const fields = new FormData(form);
    const payload = { name: fields.get('name'), email: fields.get('email'), phone: phone.value, consent_pd: fields.has('consent_pd'), consent_ads: fields.has('consent_ads'), landing: location.origin + location.pathname, attribution: Object.fromEntries([...new URLSearchParams(location.search)].filter(([key]) => /^utm_/.test(key))) };
    const signature = JSON.stringify(payload);
    if (signature !== submissionSignature) {
      submissionSignature = signature;
      submissionKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionKey }, body: JSON.stringify(payload), signal: controller.signal });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        if (result.code === 'upstream_unconfirmed' || result.code === 'upstream_timeout') {
          message('Не удалось подтвердить приём заявки. Чтобы не оставить дубль, уточните запись по телефону: +7 (499) 704-12-12.', true);
          return;
        }
        throw new Error('Lead not confirmed');
      }
      form.querySelector('div').hidden = true;
      message('Заявка отправлена. Менеджер свяжется с вами в ближайшее рабочее время.');
      window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'landing_lead_success' });
    } catch {
      message('Не удалось отправить заявку. Попробуйте ещё раз или позвоните: +7 (499) 704-12-12.', true);
    } finally {
      clearTimeout(timeout); button.disabled = false; button.textContent = 'Оставить заявку'; form.removeAttribute('aria-busy');
    }
  });
})();

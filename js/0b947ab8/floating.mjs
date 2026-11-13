// Floating elements (FR-026…FR-029): mobile bottom CTA and keyboard handling.
const MOBILE = '(max-width: 720px)';

export function init() {
  const sticky = document.querySelector('[data-sticky]');
  const topbar = document.querySelector('[data-topbar]');
  const mobile = window.matchMedia(MOBILE);
  const seen = { hero: true, form: false, footer: false };
  let keyboard = false;

  const update = () => {
    if (sticky) sticky.hidden = !mobile.matches || seen.hero || seen.form || seen.footer || keyboard;
    if (topbar) topbar.classList.toggle('is-keyboard', keyboard);
  };

  if ('IntersectionObserver' in window) {
    const targets = { hero: document.querySelector('#top'), form: document.querySelector('#form'), footer: document.querySelector('footer') };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const key = Object.keys(targets).find(name => targets[name] === entry.target);
        if (key) seen[key] = entry.isIntersecting;
      }
      update();
    });
    Object.values(targets).filter(Boolean).forEach(target => observer.observe(target));
  } else {
    seen.hero = false;
  }

  // Open keyboard: hide the bottom CTA and unpin the top bar so neither covers the focused field.
  const isField = node => node && node.matches?.('input:not([type="checkbox"]):not([type="radio"]), textarea, select');
  document.addEventListener('focusin', event => { if (isField(event.target)) { keyboard = true; update(); } });
  document.addEventListener('focusout', () => { setTimeout(() => { keyboard = isField(document.activeElement); update(); }, 50); });
  const viewport = window.visualViewport;
  if (viewport) {
    const baseline = () => window.innerHeight;
    viewport.addEventListener('resize', () => {
      const shrunk = baseline() - viewport.height > 150;
      if (shrunk !== keyboard && (shrunk || !isField(document.activeElement))) { keyboard = shrunk; update(); }
    });
  }
  mobile.addEventListener?.('change', update);
  update();
}

import { test, expect } from '@playwright/test';

const SEGMENTS = ['1-4', '5-9', '10-11'];
const ORDER = ['top', 'pains', 'trial', 'tutors', 'reviews', 'offer', 'form', 'faq', 'final'];

async function inViewport(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  const viewport = page.viewportSize();
  return Boolean(box) && box.y >= 0 && box.y + box.height <= viewport.height && box.x >= 0 && box.x + box.width <= viewport.width;
}

for (const id of SEGMENTS) {
  test(`Q1 ${id}: first screen sells the booking without scrolling (360×560)`, async ({ page }, info) => {
    test.skip(!info.project.name.endsWith('-360'), 'checked on the 360 px project only');
    await page.setViewportSize({ width: 360, height: 560 });
    await page.goto(`/${id}/`);
    await expect(page.locator('[data-seats-badge]')).toBeVisible();
    for (const selector of ['h1', '.hero-sub', '.hero-avatars', '[data-seats-badge]', '.hero-cta']) {
      expect(await inViewport(page, selector), `${selector} must be visible without scrolling`).toBe(true);
    }
    await expect(page.locator('.hero-avatar')).toHaveCount(3);
  });

  test(`skeleton order and segment blocks: ${id}`, async ({ page }) => {
    await page.goto(`/${id}/`);
    const ids = await page.locator('main section[id]').evaluateAll(nodes => nodes.map(node => node.id));
    const order = ids.filter(sectionId => ORDER.includes(sectionId));
    expect(order).toEqual(ORDER);
    await expect(page.locator('#oge')).toHaveCount(id === '5-9' ? 1 : 0);
    await expect(page.locator('#parents')).toHaveCount(id === '10-11' ? 1 : 0);
    await expect(page.locator('.pain-card')).toHaveCount(3);
    expect(await page.locator('.faq-item').count()).toBeGreaterThanOrEqual(4);
  });

  test(`Q17 ${id}: no horizontal scroll, tap targets ≥ 44 px`, async ({ page }) => {
    await page.goto(`/${id}/`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const small = await page.locator('a.btn, button.btn, .chip, .tut-btn, .header-phone').evaluateAll(nodes => nodes
      .filter(node => node.offsetParent !== null)
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.height < 44 || rect.width < 44).length);
    expect(small).toBe(0);
  });
}

test('Q17: layout per breakpoint (768: tutors 2 per row; 1024: hero in 2 columns; 1440: sticky form, container ≤ 1200)', async ({ page }, info) => {
  const width = page.viewportSize().width;
  await page.goto('/5-9/');
  if (width >= 768 && width < 1024) {
    const tops = await page.locator('.tut-card').evaluateAll(nodes => nodes.slice(0, 2).map(node => Math.round(node.getBoundingClientRect().top)));
    expect(tops[0]).toBe(tops[1]);
  }
  if (width >= 1024) {
    const copy = await page.locator('.hero-copy').boundingBox();
    const tutors = await page.locator('.hero-tutors').boundingBox();
    expect(tutors.x).toBeGreaterThan(copy.x + copy.width - 1);
  }
  if (width >= 1280) {
    const position = await page.locator('#form').evaluate(node => getComputedStyle(node).position);
    expect(position).toBe('sticky');
    const grid = await page.locator('.lp-grid').boundingBox();
    expect(grid.width).toBeLessThanOrEqual(1200);
    const form = await page.locator('#form').boundingBox();
    const pains = await page.locator('#pains').boundingBox();
    expect(form.x).toBeGreaterThan(pains.x + pains.width - 1);
  }
  test.skip(width < 768, 'breakpoint-specific checks start at 768 px');
});

test('Q19: without JavaScript the content is readable and the phone replaces the form', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/5-9/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.pain-card').first()).toBeVisible();
  await expect(page.locator('.quiz-nojs a[href^="tel:"]')).toBeVisible();
  await expect(page.locator('[data-quiz]')).toBeHidden();
  await context.close();
});

test('the extra offer step is only on the 1-4 landing (FR-036)', async ({ page }) => {
  await page.goto('/1-4/');
  await expect(page.locator('.ladder-step.is-extra')).toHaveCount(1);
  await expect(page.locator('.ladder-step.is-extra')).toContainText('Игровой формат');
  for (const path of ['/5-9/', '/10-11/']) {
    await page.goto(path);
    await expect(page.locator('.ladder-step.is-extra')).toHaveCount(0);
  }
});

test('the discount badge is bigger than the body text and does not sit on the accent button (FR-027)', async ({ page }) => {
  await page.goto('/5-9/');
  const badge = page.locator('.hero-sticker.is-discount');
  const size = await badge.evaluate(node => {
    const style = getComputedStyle(node);
    return { font: parseFloat(style.fontSize), background: style.backgroundColor, border: style.borderTopWidth, color: style.color };
  });
  expect(size.font).toBeGreaterThanOrEqual(16);
  expect(size.background).not.toBe('rgb(255, 82, 71)'); // not accent-on-accent any more
  expect(parseFloat(size.border)).toBeGreaterThan(0);
});

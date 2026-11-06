import { test, expect } from '@playwright/test';

const seatsText = async page => {
  await page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });
  return page.locator('.topbar [data-seats]').textContent();
};
const seatsNumber = text => Number(/Осталось (\d+)/.exec(text)[1]);
const timerSeconds = async page => {
  const [mm, ss] = (await page.locator('.topbar [data-timer]').textContent()).split(':').map(Number);
  return mm * 60 + ss;
};

test('Q2: seats and deadline survive reload and a new visit with the same cookies', async ({ page, context }) => {
  await page.goto('/5-9/');
  const seats = await seatsText(page);
  expect(seats).toMatch(/^Осталось (\d+) (место|места|мест) на этой неделе$/);
  expect(seatsNumber(seats)).toBeGreaterThanOrEqual(3);
  expect(seatsNumber(seats)).toBeLessThanOrEqual(10);
  const before = await timerSeconds(page);
  await page.waitForTimeout(2100);
  await page.reload();
  expect(await seatsText(page)).toBe(seats);
  expect(await timerSeconds(page)).toBeLessThan(before);
  // Same number everywhere on the page
  for (const text of await page.locator('[data-seats]').allTextContents()) expect(text).toBe(seats);
  // New tab, same cookie jar (= repeat visit)
  const second = await context.newPage();
  await second.goto('/5-9/');
  expect(await seatsText(second)).toBe(seats);
});

test('Q3: segments keep independent counters and timers', async ({ page, context }) => {
  await page.goto('/1-4/');
  await page.goto('/10-11/');
  const cookies = await context.cookies();
  const names = cookies.map(cookie => cookie.name).filter(name => name.startsWith('tst_v1_'));
  expect(names.sort()).toEqual(['tst_v1_1-4', 'tst_v1_10-11']);
});

test('Q4: last minute turns accent, expiry burns the discount once, booking stays available', async ({ page, context, baseURL }) => {
  const deadline = Date.now() + 63000;
  await context.addCookies([{ name: 'tst_v1_5-9', value: `5.${deadline}.a`, url: baseURL }]);
  await page.clock.install({ time: new Date() });
  await page.goto('/5-9/');
  await page.clock.runFor(5000);
  await expect(page.locator('.topbar [data-timer]')).toHaveClass(/is-urgent/);
  await page.clock.runFor(60000);
  await expect(page.locator('html')).toHaveAttribute('data-offer', 'expired');
  await expect(page.locator('.topbar')).toContainText('сгорела');
  await expect(page.locator('.ladder-step.is-discount')).toHaveClass(/is-burned/);
  await expect(page.locator('.hero-cta')).toBeVisible();
  await page.clock.runFor(5000);
  const expiredEvents = await page.evaluate(() => (window.dataLayer || []).filter(event => event.event === 'lp_timer_expired').length);
  expect(expiredEvents).toBe(1);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-offer', 'expired');
  const afterReload = await page.evaluate(() => (window.dataLayer || []).filter(event => event.event === 'lp_timer_expired').length);
  expect(afterReload).toBe(0);
});

test('Q5: blocked localStorage — page works, seats stable between reloads', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await page.goto('/5-9/');
  const first = await seatsText(page);
  await page.reload();
  expect(await seatsText(page)).toBe(first);
  await expect(page.locator('h1')).toBeVisible();
});

test('after a successful booking the counter drops by 1 (not below 1)', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tst_v1_5-9', value: `4.${Date.now() + 900000}.a`, url: baseURL }]);
  await page.route('**/api/lead', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, bookingId: 'TO-ABC234', promoCode: '' }) }));
  await page.goto('/5-9/');
  expect(await seatsText(page)).toBe('Осталось 4 места на этой неделе');
  await page.locator('#form').scrollIntoViewIfNeeded();
  await page.click('[data-action="next"]');
  await page.locator('.tutor-pick').first().click();
  await page.locator('.slot').first().click();
  await page.click('[data-action="next"]');
  await page.fill('#quiz-name', 'Мария');
  await page.locator('#quiz-phone').pressSequentially('9123456789');
  await page.check('#quiz-commitment', { force: true });
  await page.check('#quiz-consent-pd', { force: true });
  await page.click('[data-action="submit"]');
  await expect(page.locator('[data-ticket]')).toBeVisible();
  expect(await seatsText(page)).toBe('Осталось 3 места на этой неделе');
});

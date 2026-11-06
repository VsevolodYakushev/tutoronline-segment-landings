import { test, expect } from '@playwright/test';
import segment59 from '../../src/content/segments/5-9.json' with { type: 'json' };

const events = page => page.evaluate(() => (window.dataLayer || []).map(event => ({ ...event })));
const ready = page => page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });

test('Q14: the whole funnel lands in dataLayer with UTM and without personal data', async ({ page }) => {
  const requests = [];
  await page.route('**/api/lead', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, bookingId: 'TO-ABC234', promoCode: '' }) });
  });
  await page.goto('/5-9/?utm_source=avito&utm_content=TEST1');
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.hero-cta');
  await page.locator('#form').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await events(page)).some(event => event.event === 'lp_step_1')).toBe(true);
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

  const list = await events(page);
  const names = list.map(event => event.event);
  for (const name of ['lp_view', 'lp_scroll_50', 'lp_form_start', 'lp_step_1', 'lp_step_2', 'lp_step_3', 'lp_tutor_select', 'lp_submit', 'lp_success', 'landing_lead_success']) {
    expect(names, name).toContain(name);
  }
  expect(names.filter(name => name === 'lp_view')).toHaveLength(1);
  expect(names.filter(name => name === 'lp_form_start')).toHaveLength(1);
  const byName = name => list.find(event => event.event === name);
  expect(byName('lp_form_start').source).toBe('hero');
  expect(byName('lp_step_2')).toMatchObject({ step: 2, subject: 'math', grade: 7 });
  expect(byName('lp_tutor_select')).toMatchObject({ origin: 'form' });
  expect(byName('lp_success').booking_id).toBe('TO-ABC234');
  for (const event of list.filter(item => item.event.startsWith('lp_'))) {
    expect(event).toMatchObject({ segment: '5-9', utm_source: 'avito', utm_content: 'TEST1' });
    expect(['a', 'b']).toContain(event.variant);
  }
  const serialized = JSON.stringify(list);
  expect(serialized).not.toContain('Мария');
  expect(serialized).not.toContain('912');
  expect(requests[0].attribution).toEqual({ utm_source: 'avito', utm_content: 'TEST1' });
  expect(['a', 'b']).toContain(requests[0].variant);
});

test('Q15: ?v=b shows variant b before first paint; without it the stored variant stays', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tst_v1_5-9', value: `6.${Date.now() + 900000}.a`, url: baseURL }]);
  // Before any script runs on DOMContentLoaded, the variant attribute must already be set by the head script.
  await page.goto('/5-9/?v=b', { waitUntil: 'commit' });
  await page.waitForSelector('h1');
  expect(await page.locator('html').getAttribute('data-variant')).toBe('b');
  expect(await page.locator('h1').innerText()).toBe(segment59.hero.b.title);
  await ready(page);
  const request = page.waitForRequest('**/api/lead');
  await page.route('**/api/lead', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"bookingId":"TO-ABC234"}' }));
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
  expect((await request).postDataJSON().variant).toBe('b');

  await page.goto('/5-9/');
  expect(await page.locator('h1').innerText()).toBe(segment59.hero.a.title);
  expect(await page.locator('html').getAttribute('data-variant')).toBe('a');
});

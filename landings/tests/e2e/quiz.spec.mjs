import { test, expect } from '@playwright/test';

const OK = { success: true, bookingId: 'TO-ABC234', promoCode: 'PROMO100' };

async function mockLead(page, respond = () => ({ status: 200, body: OK })) {
  const requests = [];
  await page.route('**/api/lead', async route => {
    requests.push(route.request().postDataJSON());
    const { status, body, delay = 0 } = respond(requests.length);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return requests;
}

async function openForm(page, query = '') {
  await page.goto(`/5-9/${query}`);
  await page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });
  await page.locator('#form').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-quiz]')).toBeVisible();
}

async function toStep3(page) {
  await page.click('[data-action="next"]');
  await page.locator('.tutor-pick').first().click();
  await page.locator('.slot').first().click();
  await page.click('[data-action="next"]');
  await expect(page.locator('fieldset[data-step="3"]')).toBeVisible();
}

async function fillContacts(page, { email = 'maria@example.com', commitment = true } = {}) {
  await page.fill('#quiz-name', 'Мария');
  await page.locator('#quiz-phone').pressSequentially('9123456789');
  if (email) await page.fill('#quiz-email', email);
  if (commitment) await page.check('#quiz-commitment', { force: true });
  await page.check('#quiz-consent-pd', { force: true });
}

test('Q6: full booking — default grade, hold, wait caption, promo, ticket, payload', async ({ page }) => {
  const requests = await mockLead(page);
  await openForm(page, '?utm_source=avito&utm_content=TEST1');
  await expect(page.locator('.quiz-progress-label')).toHaveText('Шаг 1 из 3');
  await expect(page.locator('[data-grade="7"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-subject="math"]')).toHaveAttribute('aria-pressed', 'true');

  await page.click('[data-action="next"]');
  await expect(page.locator('.quiz-progress-label')).toHaveText('Шаг 2 из 3');
  await expect(page.locator('.tutor-pick')).toHaveCount(3);
  await page.locator('.tutor-pick').nth(1).click();
  await expect(page.locator('.tutor-pick').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.slot').first().click();
  await expect(page.locator('[data-wait]')).toContainText('Амет Меметович будет ждать вас в');
  await expect(page.locator('[data-hold]')).toBeVisible();
  await expect(page.locator('[data-hold-left]')).toHaveText(/^(10:00|09:5\d)$/);

  await page.click('[data-action="next"]');
  await fillContacts(page);
  await expect(page.locator('.promo-plate')).toContainText('Промокод на 100% уже применён');
  await expect(page.locator('[data-action="submit"]')).toHaveText('Закрепить урок у Амета Меметовича');
  await expect(page.locator('[data-action="submit"]')).toHaveClass(/is-ready/);
  await page.click('[data-action="submit"]');

  const ticket = page.locator('[data-ticket]');
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText('TO-ABC234');
  await expect(ticket).toContainText('Амет Меметович получил вашу бронь и готовит урок');
  await expect(ticket).toContainText('PROMO100');
  await expect(ticket.getByRole('button', { name: 'Добавить в календарь' })).toBeVisible();
  await expect(page.locator('[data-quiz]')).toBeHidden();

  expect(requests).toHaveLength(1);
  const body = requests[0];
  expect(body).toMatchObject({
    segment: '5-9', grade: 7, subject: 'math', tutor: { id: 'amet-memetovich' }, name: 'Мария',
    phone: '+7 (912) 345-67-89', email: 'maria@example.com', discountRequested: true, commitment: true, consent_pd: true,
    attribution: { utm_source: 'avito', utm_content: 'TEST1' },
  });
  expect(body.slot).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\+03:00$/);
  expect(['a', 'b']).toContain(body.variant);
});

test('Q7: phone error on blur, data kept after Back', async ({ page }) => {
  await mockLead(page);
  await openForm(page);
  await toStep3(page);
  await page.fill('#quiz-name', 'Мария');
  await page.locator('#quiz-phone').pressSequentially('91234');
  await page.locator('#quiz-name').focus();
  await expect(page.locator('#quiz-phone-error')).toBeVisible();
  await expect(page.locator('#quiz-phone-error')).toContainText('+7 (XXX) XXX-XX-XX');
  await expect(page.locator('#quiz-phone')).toHaveValue('+7 (912) 34');
  await page.click('[data-action="back"]');
  await expect(page.locator('fieldset[data-step="2"]')).toBeVisible();
  await expect(page.locator('.slot[aria-pressed="true"]')).toHaveCount(1);
  await page.click('[data-action="next"]');
  await expect(page.locator('#quiz-name')).toHaveValue('Мария');
  await expect(page.locator('#quiz-phone')).toHaveValue('+7 (912) 34');
});

test('Q8: commitment checkbox is required', async ({ page }) => {
  const requests = await mockLead(page);
  await openForm(page);
  await toStep3(page);
  await fillContacts(page, { commitment: false });
  await page.click('[data-action="submit"]');
  await expect(page.locator('#quiz-commitment-error')).toHaveText('Отметьте, что придёте на урок');
  expect(requests).toHaveLength(0);
});

test('Q10: "Хочу к этому репетитору" opens step 2 with that tutor first', async ({ page }) => {
  await mockLead(page);
  await page.goto('/5-9/');
  const fifth = page.locator('.tut-btn[data-tutor="rustam-ravilevich"]');
  await fifth.scrollIntoViewIfNeeded();
  await fifth.click();
  await expect(page.locator('fieldset[data-step="2"]')).toBeVisible();
  await expect(page.locator('.tutor-pick').first()).toHaveAttribute('data-tutor-id', 'rustam-ravilevich');
  await expect(page.locator('.tutor-pick').first()).toHaveAttribute('aria-pressed', 'true');
});

test('Q11: Russian shows the placeholder tutor and a neutral button', async ({ page }) => {
  await mockLead(page);
  await openForm(page);
  await page.click('[data-subject="russian"]');
  await page.click('[data-action="next"]');
  await expect(page.locator('.tutor-pick')).toHaveCount(1);
  await expect(page.locator('.tutor-pick')).toContainText('Подберём репетитора по русскому');
  await page.locator('.tutor-pick').click();
  await page.locator('.slot').first().click();
  await page.click('[data-action="next"]');
  await expect(page.locator('[data-action="submit"]')).toHaveText('Закрепить пробный урок');
});

test('Q12: double click sends one request; unconfirmed CRM shows phone, no ticket', async ({ page }) => {
  const requests = await mockLead(page, () => ({ status: 502, body: { success: false, code: 'upstream_unconfirmed' }, delay: 400 }));
  await openForm(page);
  await toStep3(page);
  await fillContacts(page);
  await page.locator('[data-action="submit"]').dblclick();
  await expect(page.locator('[data-status]')).toContainText('уточните запись по телефону');
  await expect(page.locator('[data-status] a[href^="tel:"]')).toBeVisible();
  await expect(page.locator('[data-ticket]')).toBeHidden();
  expect(requests).toHaveLength(1);
});

test('Q9: the hold runs out — the slot is released, the message shows, contacts stay (FR-018)', async ({ page }) => {
  // A controllable clock: the hold is 10 real minutes, so the test moves Date.now() past it.
  await page.addInitScript(() => {
    const real = Date.now;
    window.__skewMs = 0;
    Date.now = () => real() + window.__skewMs;
  });
  const requests = await mockLead(page);
  await openForm(page);

  await page.click('[data-action="next"]');
  await page.locator('.tutor-pick').first().click();
  await page.locator('.slot').first().click();
  await expect(page.locator('[data-hold]')).toBeVisible();

  // contacts are filled in before the hold runs out
  await page.click('[data-action="next"]');
  await fillContacts(page);

  // 11 minutes later the hold (10 min) is over
  await page.evaluate(() => { window.__skewMs = 11 * 60 * 1000; });

  // submitting now bounces back to step 2 with the message instead of sending the lead
  await page.click('[data-action="submit"]');
  await expect(page.locator('fieldset[data-step="2"]')).toBeVisible();
  await expect(page.locator('[data-step2-error]')).toContainText('Место освобождено');
  await expect(page.locator('.slot[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-hold]')).toBeHidden();
  await expect(page.locator('[data-ticket]')).toBeHidden();
  expect(requests).toHaveLength(0);

  // the visitor picks a time again — contacts survived, the booking goes through
  await page.locator('.slot').first().click();
  await expect(page.locator('[data-hold]')).toBeVisible();
  await page.click('[data-action="next"]');
  await expect(page.locator('#quiz-name')).toHaveValue('Мария');
  await expect(page.locator('#quiz-phone')).toHaveValue('+7 (912) 345-67-89');
  await expect(page.locator('#quiz-commitment')).toBeChecked();
  await page.click('[data-action="submit"]');
  await expect(page.locator('[data-ticket]')).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('fields wait with the form while the booking is being confirmed (FR-021)', async ({ page }) => {
  await mockLead(page, () => ({ status: 200, body: OK, delay: 1500 }));
  await openForm(page);
  await toStep3(page);
  await fillContacts(page);
  await page.click('[data-action="submit"]');
  await expect(page.locator('[data-field="name"]')).toHaveClass(/is-loading/);
  await expect(page.locator('#quiz-name')).toHaveAttribute('readonly', '');
  await expect(page.locator('#quiz-commitment')).toBeDisabled();
  await expect(page.locator('[data-ticket]')).toBeVisible();
});

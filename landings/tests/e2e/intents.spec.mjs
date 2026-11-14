// Phase 10: страница интента открывается на обещанном в объявлении и даёт сменить предмет и класс.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const CONTENT = path.resolve('src', 'content');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const intents = readdirSync(path.join(CONTENT, 'intents')).filter(name => name.endsWith('.json'))
  .map(name => readJson(path.join(CONTENT, 'intents', name)));
const site = readJson(path.join(CONTENT, 'site.json'));
const keywords = readJson(path.join(CONTENT, 'keywords.json')).keywords;

const byKey = key => intents.find(intent => intent.key === key);
const SAMPLE = ['oge-geometriya', 'ege-matematika', 'oge-biologiya'];

async function setChecked(page, selector) {
  await expect(async () => {
    await page.locator(selector).check({ force: true });
    await expect(page.locator(selector)).toBeChecked();
  }).toPass({ timeout: 10_000 });
}

for (const key of SAMPLE) {
  const intent = byKey(key);

  test(`${key}: заголовок и фильтры совпадают с ключевым словом`, async ({ page }) => {
    await page.goto(`/${key}/`);
    await expect(page.locator('h1')).toHaveText(intent.hero.title);
    await expect(page.locator('.hero-sub')).toHaveText(intent.hero.subtitle);
    await expect(page.locator('html')).toHaveAttribute('data-intent', key);

    const subject = intent.defaultSubjects[0];
    await expect(page.locator(`[data-subject="${subject}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-grade="${intent.defaultGrade}"]`)).toHaveAttribute('aria-pressed', 'true');
    // ровно один предмет выбран по умолчанию
    await expect(page.locator('[data-subject][aria-pressed="true"]')).toHaveCount(intent.defaultSubjects.length);
  });

  test(`${key}: можно выбрать другой предмет и другой класс`, async ({ page }) => {
    await page.goto(`/${key}/`);
    const cluster = readJson(path.join(CONTENT, 'segments', `${intent.cluster}.json`));
    const other = cluster.subjects.find(subject => !intent.defaultSubjects.includes(subject));

    // добавляем второй предмет — основной остаётся первым выбранным
    await page.locator(`[data-subject="${other}"]`).click();
    await expect(page.locator(`[data-subject="${other}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-subject="${intent.defaultSubjects[0]}"]`)).toHaveAttribute('aria-pressed', 'true');

    // и снимаем предмет интента: основным становится выбранный вручную
    await page.locator(`[data-subject="${intent.defaultSubjects[0]}"]`).click();
    await expect(page.locator(`[data-subject="${intent.defaultSubjects[0]}"]`)).toHaveAttribute('aria-pressed', 'false');

    // другой класс из того же кластера
    const otherGrade = cluster.grades.find(grade => grade !== intent.defaultGrade);
    await page.locator(`[data-grade="${otherGrade}"]`).click();
    await expect(page.locator(`[data-grade="${otherGrade}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-grade="${intent.defaultGrade}"]`)).toHaveAttribute('aria-pressed', 'false');

    // класс за пределами кластера — за кнопкой «Другой класс»
    await page.locator('[data-grades-toggle]').click();
    const outside = site.grades.find(grade => !cluster.grades.includes(grade));
    await page.locator(`[data-grades-other] [data-grade="${outside}"]`).click();
    await expect(page.locator(`[data-grades-other] [data-grade="${outside}"]`)).toHaveAttribute('aria-pressed', 'true');
  });
}

test('первый экран интента держится без прокрутки на 360×560', async ({ page }, info) => {
  test.skip(!info.project.name.endsWith('-360'), 'проверяется только на проекте 360 px');
  await page.setViewportSize({ width: 360, height: 560 });
  for (const key of SAMPLE) {
    await page.goto(`/${key}/`);
    const viewport = page.viewportSize();
    for (const selector of ['h1', '.hero-sub', '.hero-cta']) {
      const box = await page.locator(selector).first().boundingBox();
      expect(Boolean(box) && box.y + box.height <= viewport.height, `${key}: ${selector} уехал за экран`).toBe(true);
    }
  }
});

test('метка в адресе уводит на страницу своего направления и уточняет класс', async ({ page }) => {
  await page.goto('/?utm_source=avito&utm_term=repetitor-po-geometrii-8-klass');
  await expect(page).toHaveURL(/\/oge-geometriya\//);
  await expect(page.locator('h1')).toHaveText(byKey('oge-geometriya').hero.title);
  await expect(page.locator('[data-grade="8"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-source-note]')).toHaveText('Специально для пользователей Авито');
});

test('неизвестная метка оставляет кластерную страницу без интента', async ({ page }) => {
  await page.goto('/5-9/?utm_term=net-takogo-klyucha');
  await expect(page).toHaveURL(/\/5-9\//);
  await expect(page.locator('html')).toHaveAttribute('data-intent', '');
});

test('под заголовком без своего репетитора имена не называются', async ({ page }) => {
  await page.goto('/oge-biologiya/');
  await expect(page.locator('.hero-tutors-caption')).toContainText('преподаватели');
  await page.goto('/oge-matematika/');
  await expect(page.locator('.hero-tutors-caption b')).not.toHaveText(/преподаватели/);
});

test('параметр адреса перекрывает умолчания интента', async ({ page }) => {
  await page.goto('/oge-geometriya/?grade=5&subject=russian');
  await expect(page.locator('[data-grade="5"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-subject="russian"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-subject="geometry"]')).toHaveAttribute('aria-pressed', 'false');
});

test('бронь с интента доходит до билета, в заявке — направление, ключ и предмет интента', async ({ page }) => {
  const slug = 'repetitor-po-geometrii';
  const requests = [];
  await page.route('**/api/lead', async route => {
    requests.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, bookingId: 'TO-TEST01', promoCode: 'PROMO100' }),
    });
  });

  await page.goto(`/oge-geometriya/?utm_source=avito&utm_term=${slug}`);
  await page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });
  await page.locator('#form').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-subject="geometry"]')).toHaveAttribute('aria-pressed', 'true');

  await page.click('[data-action="next"]');
  await page.locator('.tutor-pick').first().click();
  await page.locator('.slot').first().click();
  await page.click('[data-action="next"]');
  await expect(page.locator('fieldset[data-step="3"]')).toBeVisible();

  await page.fill('#quiz-name', 'Мария');
  await page.locator('#quiz-phone').pressSequentially('9123456789');
  await setChecked(page, '#quiz-commitment');
  await setChecked(page, '#quiz-consent-pd');

  // Сначала фиксируем, что форма действительно заполнена: иначе падение выглядит
  // как «нет билета», а причина в сброшенных полях и найти её по логу невозможно.
  await expect(page.locator('#quiz-phone')).toHaveValue('+7 (912) 345-67-89');
  await expect(page.locator('#quiz-commitment')).toBeChecked();
  await expect(page.locator('#quiz-consent-pd')).toBeChecked();

  // Клик по «Забронировать» иногда приходится на перерисовку шага и теряется.
  // Повтор безопасен: приложение блокирует повторную отправку, и ниже проверяется ровно один запрос.
  await expect(async () => {
    await page.click('[data-action="submit"]');
    await expect(page.locator('[data-ticket]')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 15_000 });

  await expect(page.locator('[data-ticket]')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].intent).toBe('oge-geometriya');
  expect(requests[0].keyword).toBe(slug);
  expect(requests[0].subjects[0]).toBe('geometry');
  expect(requests[0].grade).toBe(9);
});

test('все ключевые слова ведут на существующие страницы', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('chromium-360'), 'сквозная проверка карты — один прогон');
  for (const [slug, entry] of Object.entries(keywords)) {
    const response = await page.goto(`/?utm_term=${slug}`);
    expect(response.status(), slug).toBeLessThan(400);
    await expect(page, slug).toHaveURL(new RegExp(`/${entry.intent}/`));
  }
});

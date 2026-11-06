// Dev helper: screenshots of a page section at given widths.
// Usage: node tools/shoot.mjs <path> <selector|full> <outDir> <width>x<height> [...]
//        optional env STEPS=2|3 walks the quiz to that step before the shot.
import { chromium } from '@playwright/test';

const [, , pagePath = '/5-9/', selector = 'full', outDir = '.', ...sizes] = process.argv;
const browser = await chromium.launch();
for (const size of sizes.length ? sizes : ['360x640']) {
  const [width, height] = size.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width, height }, locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
  await page.goto(`http://127.0.0.1:8765${pagePath}`, { waitUntil: 'networkidle' });
  const steps = Number(process.env.STEPS || 1);
  if (steps >= 2) {
    await page.click('[data-action="next"]');
    await page.locator('.tutor-pick').first().click();
    await page.locator('.slot').nth(1).click();
  }
  if (steps >= 3) {
    await page.click('[data-action="next"]');
    await page.fill('#quiz-name', 'Мария');
  }
  const name = `${outDir}/${pagePath.replace(/\W+/g, '_')}${selector === 'full' ? 'full' : selector.replace(/\W+/g, '')}-s${steps}-${width}.png`;
  if (selector === 'full') await page.screenshot({ path: name, fullPage: true });
  else if (selector === 'viewport') await page.screenshot({ path: name });
  else await page.locator(selector).first().screenshot({ path: name });
  console.log(name);
  await page.close();
}
await browser.close();

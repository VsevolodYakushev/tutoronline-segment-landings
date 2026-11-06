// Dev helper: lists elements wider than the viewport. Usage: node tools/overflow.mjs <segment> <width>
import { chromium } from '@playwright/test';

const [, , segment = '5-9', width = '768'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto(`http://127.0.0.1:8765/${segment}/`, { waitUntil: 'networkidle' });
const result = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const node of document.querySelectorAll('body *')) {
    const rect = node.getBoundingClientRect();
    if (rect.right > vw + 0.5 && rect.width > 0) out.push(`${node.tagName.toLowerCase()}.${[...node.classList].join('.')} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`);
  }
  return { vw, scroll: document.documentElement.scrollWidth, out: out.slice(0, 15) };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();

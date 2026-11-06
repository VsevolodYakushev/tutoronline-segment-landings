// Budget check after build (T066): CSS ≤ 40 KB and JS ≤ 30 KB gzip per page.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BUDGET = { css: 40 * 1024, js: 30 * 1024 };

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const gz = file => gzipSync(fs.readFileSync(file)).length;
const css = gz(path.join(DIST, manifest.css));
const jsDir = path.join(DIST, path.dirname(manifest.js));
// Walk explicitly: readdirSync({recursive:true}) silently ignores the option before Node 18.17
// and would leave lib/*.mjs out of the budget.
const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
const js = walk(jsDir).filter(file => file.endsWith('.mjs')).reduce((sum, file) => sum + gz(file), 0);
const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
const failures = [];
if (css > BUDGET.css) failures.push(`CSS ${kb(css)} > ${kb(BUDGET.css)}`);
if (js > BUDGET.js) failures.push(`JS ${kb(js)} > ${kb(BUDGET.js)}`);
for (const [id, page] of Object.entries(manifest.pages)) {
  const html = gz(path.join(DIST, id, 'index.html'));
  console.log(`  ${page.path.padEnd(8)} HTML ${kb(html)} gzip`);
}
console.log(`Size: CSS ${kb(css)} / ${kb(BUDGET.css)}, JS ${kb(js)} / ${kb(BUDGET.js)} (gzip)`);
if (failures.length) { console.error(`Budget exceeded: ${failures.join('; ')}`); process.exit(1); }

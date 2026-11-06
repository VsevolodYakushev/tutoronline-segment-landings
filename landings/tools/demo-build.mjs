// Demo build for a static host (GitHub Pages): the same pages, but every absolute asset path is
// prefixed with the base path the host serves them from, plus an index page and `noindex` headers.
// The production build (`npm run build` → dist/) is not touched and keeps root-absolute paths.
// Usage: node tools/demo-build.mjs /<repo-name> [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `/${String(process.argv[2] || '').replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '');
const OUT = path.resolve(ROOT, process.argv[3] || 'demo');
const NOINDEX = '<meta name="robots" content="noindex, nofollow">';

const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));

const manifest = await build({ outDir: OUT, log: () => {} });

// Absolute paths exist in HTML (/assets, /css, /js) and in one template literal in quiz.mjs.
// Stylesheets reference ../assets/… relatively and need no rewrite.
let rewritten = 0;
for (const file of walk(OUT).filter(name => /\.(html|mjs)$/.test(name))) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const dir of ['assets', 'css', 'js']) after = after.replaceAll(`/${dir}/`, `${BASE}/${dir}/`);
  if (file.endsWith('.html')) after = after.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${NOINDEX}`);
  if (after !== before) { fs.writeFileSync(file, after); rewritten++; }
}

const pages = Object.entries(manifest.pages).sort(([a], [b]) => a.localeCompare(b));
const titles = { '1-4': '1–4 класс', '5-9': '5–9 класс', '10-11': '10–11 класс' };
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
${NOINDEX}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Сегментные лендинги — превью</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;padding:40px 20px;background:#f6f7fb;color:#333;font:400 16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:640px;margin:0 auto}
  h1{margin:0 0 8px;font-size:28px;line-height:1.2}
  p{margin:0 0 16px;color:#4f4f4f}
  ul{list-style:none;margin:24px 0;padding:0;display:grid;gap:12px}
  a.card{display:block;padding:18px 20px;border-radius:16px;background:#fff;box-shadow:0 2px 10px rgba(51,51,51,.08);color:#5756b3;font-weight:500;text-decoration:none}
  a.card:hover{box-shadow:0 4px 16px rgba(51,51,51,.14)}
  a.card span{display:block;margin-top:4px;color:#828282;font-weight:400;font-size:14px}
  .note{padding:16px 18px;border-radius:14px;background:#fff8d6;font-size:14px;color:#333}
  .note b{display:block;margin-bottom:6px}
  footer{margin-top:28px;font-size:13px;color:#828282}
  @media (prefers-color-scheme:dark){
    body{background:#1b1c22;color:#e8e8ef}p{color:#b8b8c6}
    a.card{background:#24252d;color:#a9a8ee}.note{background:#2e2a1c;color:#e8e8ef}
  }
</style>
</head>
<body>
<main>
  <h1>Сегментные лендинги: превью вёрстки</h1>
  <p>Три страницы под холодный трафик маркетплейсов. Открывайте с телефона — вёрстка mobile-first, эталон 360×640.</p>
  <ul>
${pages.map(([id]) => `    <li><a class="card" href="${BASE}/${id}/">${titles[id] || id}<span>${BASE}/${id}/</span></a></li>`).join('\n')}
  </ul>
  <div class="note">
    <b>Это статическое превью, а не рабочий сайт</b>
    Вёрстка, квиз, таймер скидки и счётчик мест работают. Отправка заявки — нет: за неё отвечает Node-сервер, которого на статическом хостинге нет, поэтому на последнем шаге формы появится сообщение с телефоном вместо экрана брони. Полная версия поднимается локально через <code>npm start</code>.
  </div>
  <footer>Собрано из исходников репозитория: <code>node tools/demo-build.mjs</code></footer>
</main>
</body>
</html>
`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(`Demo build → ${path.relative(ROOT, OUT)} (base "${BASE}"), ${pages.length} pages, ${rewritten} files rewritten`);

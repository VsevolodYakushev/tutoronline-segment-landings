import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, BuildError, robotsTxt } from '../../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT = path.join(ROOT, 'src', 'content');

function tempContent(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-content-'));
  fs.cpSync(CONTENT, dir, { recursive: true });
  mutate(dir);
  return dir;
}
const editSegment = (dir, id, change) => {
  const file = path.join(dir, 'segments', `${id}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(data);
  fs.writeFileSync(file, JSON.stringify(data));
};
async function run(contentDir, strict = false) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  try { await build({ root: ROOT, contentDir, outDir, strict, log: () => {} }); return null; }
  catch (error) { if (error instanceof BuildError) return error.errors.join('\n'); throw error; }
  finally { fs.rmSync(outDir, { recursive: true, force: true }); }
}

test('Q21: a result promise ("исправим") fails the build', async () => {
  const dir = tempContent(d => editSegment(d, '5-9', s => { s.final.text = 'Исправим оценки за месяц'; }));
  assert.match(await run(dir), /стоп-слово «исправим»/);
});

test('pains of 2 items fail only in strict mode', async () => {
  const dir = tempContent(d => editSegment(d, '1-4', s => { s.pains.items = s.pains.items.slice(0, 2); }));
  assert.equal(await run(dir, false), null);
  assert.match(await run(dir, true), /pains\.items — ровно 3/);
});

test('unknown tutor id fails always', async () => {
  const dir = tempContent(d => editSegment(d, '10-11', s => { s.tutorIds.math.push('ghost-tutor'); }));
  assert.match(await run(dir), /неизвестного репетитора «ghost-tutor»/);
});

test('defaultGrade must be one of the segment grades', async () => {
  const dir = tempContent(d => editSegment(d, '5-9', s => { s.defaultGrade = 11; }));
  assert.match(await run(dir), /defaultGrade/);
});

test('a style= attribute in rendered HTML fails the build (CSP)', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  const render = () => '<!doctype html><html><body><section class="x" style="color:red"></section></body></html>';
  try {
    await assert.rejects(build({ root: ROOT, contentDir: CONTENT, outDir, log: () => {}, render }), error => /атрибут style=/.test(error.errors.join('\n')));
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('strict build passes with full content and a promo code', async () => {
  const dir = tempContent(d => {
    const file = path.join(d, 'offer.json');
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), promoCode: 'PROMO100' }));
  });
  assert.equal(await run(dir, true), null);
});

// --- Phase 10: интенты и карта ключевых слов ---

const editIntent = (dir, key, change) => {
  const file = path.join(dir, 'intents', `${key}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(data);
  fs.writeFileSync(file, JSON.stringify(data));
};
const editKeywords = (dir, change) => {
  const file = path.join(dir, 'keywords.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(data.keywords);
  fs.writeFileSync(file, JSON.stringify(data));
};

test('интент с неизвестным кластером не собирается', async () => {
  const dir = tempContent(d => editIntent(d, 'oge-geometriya', i => { i.cluster = '7-8'; }));
  assert.match(await run(dir), /неизвестный кластер «7-8»/);
});

test('предмет интента должен быть в фильтре кластера', async () => {
  const dir = tempContent(d => editIntent(d, 'oge-geometriya', i => { i.defaultSubjects = ['highermath']; }));
  assert.match(await run(dir), /не входит в subjects кластера/);
});

test('предмет без репетитора не собирается', async () => {
  const dir = tempContent(d => editSegment(d, '5-9', s => { s.tutorIds.biology = []; }));
  assert.match(await run(dir), /для предмета «biology»/);
});

test('стоп-слово в заголовке интента не собирается (FR-007)', async () => {
  const dir = tempContent(d => editIntent(d, 'ege-fizika', i => { i.hero.title = 'Гарантируем результат на ЕГЭ по физике'; }));
  assert.match(await run(dir), /стоп-слово «гарантируем» в hero\.title/);
});

test('класс интента вне 1–11 не собирается', async () => {
  const dir = tempContent(d => editIntent(d, 'ege-fizika', i => { i.defaultGrade = 12; }));
  assert.match(await run(dir), /defaultGrade 12 вне site\.json/);
});

test('ключ интента не может совпасть с адресом кластера', async () => {
  const dir = tempContent(d => {
    const file = path.join(d, 'intents', 'oge-geometriya.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.key = '5-9';
    fs.rmSync(file);
    fs.writeFileSync(path.join(d, 'intents', '5-9.json'), JSON.stringify(data));
  });
  assert.match(await run(dir), /занят сегментом/);
});

test('карта ключевых слов не может ссылаться в никуда', async () => {
  const dir = tempContent(d => editKeywords(d, k => { k['repetitor-po-geometrii'].intent = 'oge-astronomiya'; }));
  assert.match(await run(dir), /неизвестный интент «oge-astronomiya»/);
});

test('класс в карте ключевых слов проверяется', async () => {
  const dir = tempContent(d => editKeywords(d, k => { k['repetitor-po-geometrii-8-klass'].grade = 14; }));
  assert.match(await run(dir), /grade 14 вне site\.json/);
});

test('дубль заголовка между интентами ловится только в строгом режиме', async () => {
  const dir = tempContent(d => {
    const donor = JSON.parse(fs.readFileSync(path.join(d, 'intents', 'oge-fizika.json'), 'utf8'));
    editIntent(d, 'oge-himiya', i => { i.hero.title = donor.hero.title; });
    const file = path.join(d, 'offer.json');
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), promoCode: 'PROMO100' }));
  });
  assert.equal(await run(dir, false), null);
  assert.match(await run(dir, true), /дословно повторяет/);
});

test('сборка разворачивает один шаблон в кластерные страницы и страницы интентов', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  try {
    const manifest = await build({ root: ROOT, contentDir: CONTENT, outDir, log: () => {} });
    const ids = Object.keys(manifest.pages);
    const intents = fs.readdirSync(path.join(CONTENT, 'intents')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    for (const id of ['1-4', '5-9', '10-11', ...intents]) {
      assert.ok(ids.includes(id), `в манифесте нет страницы ${id}`);
      assert.ok(fs.existsSync(path.join(outDir, id, 'index.html')), `не собран ${id}/index.html`);
    }
    // у каждой страницы интента свой кластер и свои хеши инлайн-скриптов для CSP
    const page = manifest.pages['oge-geometriya'];
    assert.equal(page.cluster, '5-9');
    assert.equal(page.intent, 'oge-geometriya');
    assert.ok(page.inline.scripts.length >= 1);
    // карта ключевых слов в манифест не попадает: сервер читает её на лету
    assert.equal(manifest.keywords, undefined);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('страница интента несёт его заголовок и предвыбранные фильтры', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  try {
    await build({ root: ROOT, contentDir: CONTENT, outDir, log: () => {} });
    const html = fs.readFileSync(path.join(outDir, 'oge-geometriya', 'index.html'), 'utf8');
    const intent = JSON.parse(fs.readFileSync(path.join(CONTENT, 'intents', 'oge-geometriya.json'), 'utf8'));
    assert.ok(html.includes(intent.hero.title), 'заголовок интента на первом экране');
    assert.match(html, /data-intent="oge-geometriya"/);
    assert.match(html, /data-subject="geometry" aria-pressed="true"/);
    assert.match(html, /data-grade="9" aria-pressed="true"/);
    // чужой предмет не предвыбран
    assert.match(html, /data-subject="math" aria-pressed="false"/);

    // кластерная страница остаётся на своих текстах и ничего не знает об интенте
    const cluster = fs.readFileSync(path.join(outDir, '5-9', 'index.html'), 'utf8');
    assert.match(cluster, /data-intent=""/);
    assert.ok(!cluster.includes(intent.hero.title));
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('под заголовком без своего репетитора имена не называются', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  try {
    await build({ root: ROOT, contentDir: CONTENT, outDir, log: () => {} });
    const biology = fs.readFileSync(path.join(outDir, 'oge-biologiya', 'index.html'), 'utf8');
    assert.match(biology, /Пробные онлайн-уроки ведут <b>преподаватели/);
    assert.ok(!/Пробные онлайн-уроки ведут <b>Роман/.test(biology), 'математики не выдаются за биологов');
    // и кнопка «хочу к этому репетитору» не подменяет предмет брони
    assert.ok(!/data-tutor="roman-yurievich"/.test(biology));

    const math = fs.readFileSync(path.join(outDir, 'oge-matematika', 'index.html'), 'utf8');
    assert.match(math, /Пробные онлайн-уроки ведут <b>[А-ЯЁ]/, 'по своему предмету имена называем');
    assert.match(math, /data-tutor="roman-yurievich"/);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

// Закрытость от индексации: страницы под платный трафик не должны попадать в поиск:
// 19 почти одинаковых страниц — это дубли, и они конкурируют с основным сайтом бренда.
test('каждая страница несёт метатег robots из site.json, в корне лежит robots.txt', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  try {
    const manifest = await build({ root: ROOT, contentDir: CONTENT, outDir, log: () => {} });
    const ids = Object.keys(manifest.pages);
    assert.equal(ids.length, 22);
    for (const id of ids) {
      const page = fs.readFileSync(path.join(outDir, id, 'index.html'), 'utf8');
      assert.match(page, /<meta name="robots" content="noindex, nofollow">/, `${id}: нет метатега robots`);
    }
    const txt = fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
    assert.match(txt, /^User-agent: \*$/m);
    assert.match(txt, /^Disallow: \/api\/$/m);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('пустой robots в site.json открывает индексацию, нестрока ломает сборку', async () => {
  const open = tempContent(d => {
    const file = path.join(d, 'site.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.robots = '';
    fs.writeFileSync(file, JSON.stringify(data));
  });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-dist-'));
  try {
    await build({ root: ROOT, contentDir: open, outDir, log: () => {} });
    const page = fs.readFileSync(path.join(outDir, '5-9', 'index.html'), 'utf8');
    assert.doesNotMatch(page, /<meta name="robots"/);
    assert.match(fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf8'), /Индексация разрешена/);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }

  const broken = tempContent(d => {
    const file = path.join(d, 'site.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.robots = true;
    fs.writeFileSync(file, JSON.stringify(data));
  });
  assert.match(await run(broken), /site\.json: robots/);
});

test('robotsTxt разрешает обход даже при запрете индексации', () => {
  // Disallow вместо noindex оставил бы адреса в выдаче: робот не скачал бы
  // страницу и не увидел запрет, а по внешним ссылкам адрес в индекс всё равно попадает.
  const closed = robotsTxt('noindex, nofollow');
  assert.match(closed, /^Allow: \/$/m);
  assert.doesNotMatch(closed, /^Disallow: \/$/m);
  assert.match(closed, /noindex, nofollow/);
});

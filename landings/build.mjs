// Build: content JSON + templates → dist/<segment>/index.html, hashed CSS/JS, assets, manifest.
// Only Node built-ins. Usage: node build.mjs [--strict]   (strict is also on with NODE_ENV=production)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CSS_ORDER = ['tokens.css', 'base.css', 'components.css', 'themes.css'];
const SEGMENT_ID = /^\d+-\d+$/;
const TUTOR_ID = /^[a-z0-9-]+$/;
const SLUG = /^[a-z0-9-]+$/;

export class BuildError extends Error {
  constructor(errors) { super(`Build failed:\n - ${errors.join('\n - ')}`); this.errors = errors; }
}

const sha256 = data => createHash('sha256').update(data).digest();
const shortHash = data => sha256(data).toString('hex').slice(0, 8);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new BuildError([`${path.basename(file)}: ${error.message}`]); }
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(file => file.endsWith('.json')).sort()
    .map(file => ({ file, ...readJson(path.join(dir, file)) }));
}

export function loadContent(contentDir) {
  const keywordsFile = path.join(contentDir, 'keywords.json');
  return {
    offer: readJson(path.join(contentDir, 'offer.json')),
    schedule: readJson(path.join(contentDir, 'schedule.json')),
    site: readJson(path.join(contentDir, 'site.json')),
    tutors: readJson(path.join(contentDir, 'tutors.json')),
    stopwords: readJson(path.join(contentDir, 'stopwords.json')),
    segments: readDir(path.join(contentDir, 'segments')),
    intents: readDir(path.join(contentDir, 'intents')),
    keywords: fs.existsSync(keywordsFile) ? (readJson(keywordsFile).keywords || {}) : {},
  };
}

// Страницы сборки: кластер без интента (прямой трафик) и по одной на каждый интент.
export function pagesOf(content) {
  const byCluster = new Map(content.segments.map(segment => [segment.id, segment]));
  return [
    ...content.segments.map(segment => ({ id: segment.id, path: segment.path, segment, intent: null })),
    ...(content.intents || []).map(intent => ({
      id: intent.key, path: `/${intent.key}/`, intent, segment: byCluster.get(intent.cluster),
    })).filter(page => page.segment),
  ];
}

function collectStrings(value, trail, out) {
  if (typeof value === 'string') out.push([trail, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, `${trail}[${index}]`, out));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) collectStrings(item, trail ? `${trail}.${key}` : key, out);
  return out;
}

export function validate(content, { strict = false } = {}) {
  const errors = [];
  const { offer, tutors, segments, stopwords } = content;
  if (!(Number.isInteger(offer.seatsMin) && Number.isInteger(offer.seatsMax) && offer.seatsMin <= offer.seatsMax)) errors.push('offer.json: seatsMin ≤ seatsMax (целые числа)');
  if (!(offer.timerMinutes > 0)) errors.push('offer.json: timerMinutes > 0');
  if (offer.lessonPrice !== null && !(Number.isInteger(offer.lessonPrice) && offer.lessonPrice > offer.discount)) errors.push('offer.json: lessonPrice — null или целое больше discount');
  if (strict && !String(offer.promoCode || '').trim()) errors.push('offer.json: promoCode обязателен в строгом режиме (production)');

  const byId = new Map();
  for (const tutor of tutors) {
    if (!TUTOR_ID.test(tutor.id || '')) errors.push(`tutors.json: неверный id «${tutor.id}» (нужно [a-z0-9-]+)`);
    if (byId.has(tutor.id)) errors.push(`tutors.json: повторяющийся id «${tutor.id}»`);
    if (!tutor.subjects?.some(subject => content.site.subjects?.[subject])) errors.push(`tutors.json: «${tutor.id}» должен вести хотя бы один предмет из site.json → subjects`);
    byId.set(tutor.id, tutor);
  }

  for (const segment of segments) {
    const where = `segments/${segment.file}`;
    if (!SEGMENT_ID.test(segment.id || '')) errors.push(`${where}: неверный id`);
    if (!Array.isArray(segment.grades) || !segment.grades.length) errors.push(`${where}: grades — непустой массив`);
    else if (!segment.grades.includes(segment.defaultGrade)) errors.push(`${where}: defaultGrade должен входить в grades`);
    for (const subject of Object.keys(segment.tutorIds || {})) {
      if (!content.site.subjects?.[subject]) errors.push(`${where}: tutorIds.${subject} — неизвестный предмет (нет в site.json → subjects)`);
      for (const id of segment.tutorIds?.[subject] || []) {
        const tutor = byId.get(id);
        if (!tutor) errors.push(`${where}: tutorIds.${subject} ссылается на неизвестного репетитора «${id}»`);
        else if (!tutor.subjects.includes(subject)) errors.push(`${where}: «${id}» не ведёт ${subject}`);
      }
    }
    for (const id of segment.heroTutorIds || []) if (!byId.has(id)) errors.push(`${where}: heroTutorIds ссылается на неизвестного репетитора «${id}»`);
    // FR-016, FR-037: the subject list of a segment must be known and have tutors behind it
    if (!segment.subjects?.length) errors.push(`${where}: subjects — непустой массив предметов`);
    for (const subject of segment.subjects || []) {
      if (!content.site.subjects?.[subject]) errors.push(`${where}: subjects содержит неизвестный предмет «${subject}»`);
      else if (!(segment.tutorIds?.[subject] || []).length) errors.push(`${where}: для предмета «${subject}» не задан ни один репетитор в tutorIds`);
    }
    for (const [trail, text] of collectStrings(segment, '', [])) {
      const lower = text.toLowerCase();
      for (const word of stopwords) if (lower.includes(word)) errors.push(`${where}: стоп-слово «${word}» в ${trail} — тексты не обещают результат (FR-007)`);
    }
    if (strict) {
      if (segment.pains?.items?.length !== 3) errors.push(`${where}: pains.items — ровно 3`);
      const steps = segment.trialSteps?.items?.length || 0;
      if (steps < 3 || steps > 4) errors.push(`${where}: trialSteps.items — 3–4`);
      if ((segment.faq?.length || 0) < 4) errors.push(`${where}: faq — не меньше 4 вопросов`);
      if (!segment.hero?.a?.subtitle) errors.push(`${where}: hero.a.subtitle обязателен`);
    }
  }

  // Интенты: заголовок и фильтры под ключевое слово (FR-039…FR-042)
  const byCluster = new Map(segments.map(segment => [segment.id, segment]));
  const intentKeys = new Set();
  const titles = new Map();
  for (const intent of content.intents || []) {
    const where = `intents/${intent.file}`;
    if (!SLUG.test(intent.key || '')) errors.push(`${where}: key — слаг [a-z0-9-]+`);
    else if (intent.file !== `${intent.key}.json`) errors.push(`${where}: имя файла должно совпадать с key «${intent.key}»`);
    if (intentKeys.has(intent.key)) errors.push(`${where}: повторяющийся key «${intent.key}»`);
    if (byCluster.has(intent.key)) errors.push(`${where}: key «${intent.key}» занят сегментом — адреса столкнутся`);
    intentKeys.add(intent.key);

    const cluster = byCluster.get(intent.cluster);
    if (!cluster) { errors.push(`${where}: неизвестный кластер «${intent.cluster}»`); continue; }
    const grades = content.site.grades?.length ? content.site.grades : cluster.grades;
    if (!grades.includes(intent.defaultGrade)) errors.push(`${where}: defaultGrade ${intent.defaultGrade} вне site.json → grades`);
    if (!intent.defaultSubjects?.length) errors.push(`${where}: defaultSubjects — непустой массив`);
    for (const subject of intent.defaultSubjects || []) {
      if (!(cluster.subjects || []).includes(subject)) errors.push(`${where}: предмет «${subject}» не входит в subjects кластера ${cluster.id} — фильтр не совпадёт с заголовком`);
      else if (!(cluster.tutorIds?.[subject] || []).length) errors.push(`${where}: для предмета «${subject}» нет ни одного репетитора в tutorIds кластера ${cluster.id}`);
    }
    for (const id of intent.heroTutorIds || []) if (!byId.has(id)) errors.push(`${where}: heroTutorIds ссылается на неизвестного репетитора «${id}»`);
    if (!intent.hero?.title) errors.push(`${where}: hero.title обязателен`);
    if (!intent.hero?.subtitle) errors.push(`${where}: hero.subtitle обязателен`);
    if (!intent.meta?.title) errors.push(`${where}: meta.title обязателен`);
    for (const [trail, text] of collectStrings(intent, '', [])) {
      const lower = text.toLowerCase();
      for (const word of stopwords) if (lower.includes(word)) errors.push(`${where}: стоп-слово «${word}» в ${trail} — тексты не обещают результат (FR-007)`);
    }
    if (strict && intent.hero?.title) {
      const owner = titles.get(intent.hero.title);
      if (owner) errors.push(`${where}: заголовок дословно повторяет ${owner} — интенты должны различаться`);
      else titles.set(intent.hero.title, where);
    }
  }

  // Карта ключевых слов: только идентификаторы, текста в ней нет (FR-043)
  for (const [slug, entry] of Object.entries(content.keywords || {})) {
    const where = `keywords.json → ${slug}`;
    if (!SLUG.test(slug)) errors.push(`${where}: ключ — слаг [a-z0-9-]+`);
    if (!entry || typeof entry !== 'object') { errors.push(`${where}: значение — объект { intent, grade? }`); continue; }
    if (!intentKeys.has(entry.intent)) errors.push(`${where}: неизвестный интент «${entry.intent}»`);
    if (entry.grade !== undefined && !(content.site.grades || []).includes(entry.grade)) errors.push(`${where}: grade ${entry.grade} вне site.json → grades`);
  }

  return errors;
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  }).sort();
}

function inlineHashes(html) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => `'sha256-${sha256(match[1]).toString('base64')}'`);
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => `'sha256-${sha256(match[1]).toString('base64')}'`);
  return { scripts, styles };
}

export async function build({ root = ROOT, contentDir = path.join(root, 'src', 'content'), outDir = path.join(root, 'dist'), strict = false, log = console.log, render = null } = {}) {
  const content = loadContent(contentDir);
  const errors = validate(content, { strict });
  if (errors.length) throw new BuildError(errors);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const cssDir = path.join(root, 'src', 'css');
  const css = CSS_ORDER.filter(name => fs.existsSync(path.join(cssDir, name)))
    .map(name => `/* ${name} */\n${fs.readFileSync(path.join(cssDir, name), 'utf8')}`).join('\n');
  const cssFile = `css/landing.${shortHash(css)}.css`;
  fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });
  fs.writeFileSync(path.join(outDir, cssFile), css);

  const jsDir = path.join(root, 'src', 'js');
  const jsFiles = listFiles(jsDir);
  const jsHash = shortHash(jsFiles.map(file => file + fs.readFileSync(path.join(jsDir, file), 'utf8')).join('\n'));
  for (const file of jsFiles) {
    const target = path.join(outDir, 'js', jsHash, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(jsDir, file), target);
  }
  const jsEntry = `js/${jsHash}/main.mjs`;

  fs.cpSync(path.join(root, 'assets'), path.join(outDir, 'assets'), { recursive: true });

  const renderPage = render || (await import(pathToFileURL(path.join(root, 'src', 'templates', 'page.mjs')).href)).renderPage;
  const tutorsById = Object.fromEntries(content.tutors.map(tutor => [tutor.id, tutor]));
  const manifest = { css: `/${cssFile}`, js: `/${jsEntry}`, strict, pages: {} };
  const renderErrors = [];
  const pages = pagesOf(content);
  for (const { id, path: pagePath, segment, intent } of pages) {
    const page = String(renderPage({ segment, intent, content, tutorsById, assets: { css: `/${cssFile}`, js: `/${jsEntry}` } }));
    const where = intent ? `intents/${intent.file}` : `segments/${segment.file}`;
    if (/<[^>]+\sstyle=/i.test(page)) renderErrors.push(`${where}: шаблон выдаёт атрибут style= (запрещён CSP)`);
    const target = path.join(outDir, id, 'index.html');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, page);
    manifest.pages[id] = {
      path: pagePath, cluster: segment.id, intent: intent?.key || null,
      bytes: Buffer.byteLength(page), inline: inlineHashes(page),
    };
  }
  // Карта ключевых слов в манифест не попадает: сервер читает её из src/content на лету,
  // иначе правка связки ключ→интент требовала бы пересборки.
  if (renderErrors.length) throw new BuildError(renderErrors);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const intentCount = pages.filter(page => page.intent).length;
  log(`Built ${pages.length} pages${strict ? ' (strict)' : ''}: ${content.segments.length} кластерных + ${intentCount} интентов → ${path.relative(root, outDir) || outDir}`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes('--strict') || process.env.NODE_ENV === 'production';
  build({ strict }).catch(error => {
    console.error(error instanceof BuildError ? error.message : error);
    process.exit(1);
  });
}

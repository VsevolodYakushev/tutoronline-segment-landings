import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, BuildError } from '../../build.mjs';

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

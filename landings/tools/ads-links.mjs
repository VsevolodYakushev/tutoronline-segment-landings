// Собирает ads-links.csv: по строке на ключевое слово с готовым адресом для объявления.
// Запуск: node tools/ads-links.mjs [--origin https://lp.example.ru] [--source avito] [--out ads-links.csv]
//
// utm_content (идентификатор объявления) не подставляется: его добавляет кабинет или
// маркетолог вручную — именно по нему потом сверяется атрибуция.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../build.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function arg(name, fallback) {
  const hit = process.argv.find(value => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[index + 1] : fallback;
}

// CSV для Excel: разделитель — точка с запятой, кавычки удваиваются, BOM для кириллицы.
const cell = value => {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function adsRows({ content, origin, source }) {
  const rows = [];
  for (const [slug, entry] of Object.entries(content.keywords || {})) {
    const intent = (content.intents || []).find(item => item.key === entry.intent);
    if (!intent) continue;
    const query = new URLSearchParams({ utm_source: source, utm_campaign: intent.key, utm_term: slug });
    if (entry.grade) query.set('grade', String(entry.grade));
    rows.push({
      cluster: intent.cluster,
      intent: intent.label,
      key: intent.key,
      phrase: entry.phrase || slug,
      slug,
      grade: entry.grade || intent.defaultGrade,
      subject: intent.defaultSubjects.join(', '),
      capacity: entry.capacity ?? '',
      title: intent.hero.title,
      url: `${origin.replace(/\/+$/, '')}/${intent.key}/?${query}`,
    });
  }
  // по кластеру, затем по убыванию ёмкости: сверху то, с чего стоит начинать
  const order = { '10-11': 0, '5-9': 1, '1-4': 2 };
  rows.sort((a, b) => (order[a.cluster] ?? 9) - (order[b.cluster] ?? 9) || (Number(b.capacity) || 0) - (Number(a.capacity) || 0));
  return rows;
}

export function toCsv(rows) {
  const head = ['Кластер', 'Направление', 'Ключ интента', 'Ключевое слово', 'utm_term', 'Класс', 'Предмет', 'Пользователей', 'Заголовок первого экрана', 'Адрес для объявления'];
  const body = rows.map(row => [row.cluster, row.intent, row.key, row.phrase, row.slug, row.grade, row.subject, row.capacity, row.title, row.url]);
  return '﻿' + [head, ...body].map(line => line.map(cell).join(';')).join('\r\n') + '\r\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const origin = arg('origin', process.env.PUBLIC_ORIGIN || 'https://example.ru');
  const source = arg('source', 'avito');
  const out = path.resolve(ROOT, arg('out', 'ads-links.csv'));
  const content = loadContent(path.join(ROOT, 'src', 'content'));
  const rows = adsRows({ content, origin, source });
  fs.writeFileSync(out, toCsv(rows));
  const capacity = rows.reduce((sum, row) => sum + (Number(row.capacity) || 0), 0);
  console.log(`${rows.length} ссылок на ${new Set(rows.map(row => row.key)).size} направлений, ёмкость ${capacity.toLocaleString('ru-RU')} чел. → ${path.relative(ROOT, out)}`);
  if (origin.includes('example.ru')) console.log('Адрес-заглушка: перед выдачей в кабинет укажите --origin с реальным доменом.');
}

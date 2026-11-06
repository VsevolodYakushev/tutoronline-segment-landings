# Data Model: Три сегментных лендинга с квиз-формой брони

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md) | **Date**: 2026-11-05

Постоянной базы данных нет. Данные бывают трёх видов:
- **контент и настройки** — JSON в `landings/src/content/`, попадают в HTML при сборке;
- **состояние посетителя** — cookie и `localStorage`/`sessionStorage`;
- **заявка** — JSON-запрос к `/api/lead`, который передаётся в вебхук CRM и на сервере не сохраняется.

---

## 1. Segment (контент, сборка)

Файл: `src/content/segments/<id>.json`.

| Поле | Тип | Правила |
|------|-----|---------|
| `id` | `"1-4" \| "5-9" \| "10-11"` | Уникален; совпадает с путём URL и суффиксом ключей хранилища |
| `path` | string | `/1-4/`, `/5-9/`, `/10-11/` |
| `grades` | int[] | `1-4` → [1,2,3,4]; `5-9` → [5…9]; `10-11` → [10,11] |
| `defaultGrade` | int | ∈ `grades`; `1-4` → 2, `5-9` → 7, `10-11` → 11; предвыбор на шаге 1, если в ссылке нет `grade` |
| `audience` | `"parent" \| "student"` | `10-11` → `student` (обращение на «ты») |
| `tone` | string | Подсказка для текстов; на рендер не влияет |
| `meta` | `{ title, description }` | `title` ≤ 60 символов |
| `topbar` | `{ timerLabel, seatsTemplate }` | `seatsTemplate` содержит `{n}` и `{seats}` (слово в нужном склонении); по умолчанию `"Осталось {n} {seats} на этой неделе"`; единственный источник фразы о местах (плашка, первый экран, форма) |
| `hero` | `{ a: HeroCopy, b: HeroCopy }` | Два варианта для A/B; `HeroCopy = { title, subtitle, offerBadge }` |
| `pains` | `{ title, items: [{ icon, title, text }] }` | Ровно 3 элемента |
| `trialSteps` | `{ title, items: [{ title, text }] }` | 3–4 элемента |
| `tutorIds` | `{ math: string[], russian: string[] }` | Ссылки на `Tutor.id`; для блока «Репетиторы» и шага 2 |
| `extraBlocks` | `("oge" \| "parents")[]` | `5-9` → `["oge"]`, `10-11` → `["parents"]`, `1-4` → `[]` |
| `faq` | `[{ q, a }]` | ≥ 4: почему бесплатно, что после пробного, нужно ли платить, можно ли перенести; у `10-11` — ещё вопросы родителя |
| `final` | `{ title, text }` | Повтор оффера |
| `quizVariant` | `{ a: QuizCopy, b: QuizCopy }` | Тексты заголовков шагов для A/B |
| `theme` | `"light" \| "contrast"` | `10-11` → `contrast` (светлая тема с усиленными акцентами) |

**Правило валидации на сборке**: тексты не содержат обещаний результата. Сборка падает, если встречает стоп-слова из `src/content/stopwords.json` («исправим», «гарантируем», «сдашь на» и т.п.).

## 2. Tutor (контент, сборка)

Файл: `src/content/tutors.json`.

| Поле | Тип | Правила |
|------|-----|---------|
| `id` | string (slug) | Уникален, `[a-z0-9-]+` |
| `name` | string | Имя-отчество, как в базовом лендинге |
| `nameGenitive` | string | Родительный падеж для кнопки «Закрепить урок у {nameGenitive}»: «Анны Сергеевны» |
| `gender` | `"f" \| "m"` | Для «получила / получил вашу бронь» |
| `photo` | `{ webp, avif, focal }` | Из `assets/tutors/` (файлы `<id>-<w>.webp/.avif`) |
| `subjects` | `("math" \| "russian" \| "physics" \| "chemistry" \| "highermath")[]` | Минимум один из `math` или `russian`, чтобы попасть в форму |
| `subjectsLabel` | string | «Математика, физика» — как в базовом лендинге |
| `experienceYears` | int | > 0 |
| `lessonsCount` | int \| null | Из базового лендинга, если есть |
| `rating` | number \| null | 0–5, из базового лендинга |
| `verified` | bool | Значок «Проверка пройдена» |
| `placeholder` | bool | `true` — карточка «Подберём репетитора по русскому» без человека (D1) |

**Исходный набор** (из базового лендинга):
- со статистикой: Роман Юрьевич (15 лет, 5,0), Амет Меметович (4 года, 5,0), Галина Владимировна (39 лет, 4,7), Евгения Николаевна (22 года, 4,6), Рустам Равилевич (7 лет, 4,6);
- первый экран, без статистики: Павел Степанович, Инна Ивановна, Екатерина Олеговна.

Для `russian` до получения D1 используется одна запись с `placeholder: true`.

## 3. Schedule template (контент, сборка → клиент)

Файл: `src/content/schedule.json`.

| Поле | Тип | Правила |
|------|-----|---------|
| `timezone` | `"Europe/Moscow"` | Отображение с пометкой «МСК» |
| `leadHours` | int | 3 — первый слот не раньше чем через 3 ч |
| `daysToShow` | int | 3 — ближайшие дни, в которых есть слоты |
| `weekly` | `{ [tutorId \| "default"]: { mon…sun: "HH:MM"[] } }` | По умолчанию будни `16:00–20:00`, выходные `11:00–15:00`, шаг 1 ч |
| `holdMinutes` | int | 10 |

### Slot (вычисляется на клиенте)

| Поле | Тип |
|------|-----|
| `tutorId` | string |
| `startsAt` | ISO 8601 с `+03:00` |
| `label` | «ср, 12 нояб., 18:00 МСК» |

**Переходы состояния слота** (только на клиенте):

```text
available ──select──▶ held(expiresAt = now + holdMinutes)
held ──submit success──▶ booked
held ──expiresAt passed──▶ released ──▶ available (выбор сброшен, сообщение)
held ──select another──▶ available (старый) + held (новый, таймер холда заново)
```

## 4. Offer (контент, сборка)

Файл: `src/content/offer.json`.

| Поле | Тип | Правила |
|------|-----|---------|
| `trialPrice` | int (₽) | 1500 — перечёркнутая сумма (решение заказчика, D5) |
| `trialFinal` | int (₽) | 0 |
| `discount` | int (₽) | 1500 — «−1500 ₽ на первое платное занятие» |
| `lessonPrice` | int (₽) \| null | Реальная цена занятия; `null`, пока заказчик не подтвердил (D5) — тогда цена после скидки не выводится |
| `timerMinutes` | int | 15; значение > 0 |
| `seatsMin` / `seatsMax` | int | 3 / 10; `min ≤ max` |
| `promoCode` | string | Обязателен в production (D3) |
| `storageVersion` | string | `v1`; смена версии сбрасывает состояние у всех посетителей |
| `ttlDays` | int | 30 |

## 5. VisitorSegmentState (cookie + localStorage)

- Ключ: `tst_v1_<segmentId>`.
- Cookie: значение `<seats>.<deadlineMs>.<variant>`, `Max-Age=2592000; Path=/; SameSite=Lax; Secure`.
- `localStorage`: полный JSON.

| Поле | Тип | Правила |
|------|-----|---------|
| `seats` | int | 3–10, задаётся один раз |
| `deadline` | int (ms UTC) | Время первого визита + `timerMinutes` |
| `variant` | `"a" \| "b"` | Назначается вместе с `seats` |
| `booked` | int | ≥ 0; +1 после успешной брони |
| `expired` | bool | `true` после отправки `lp_timer_expired` |
| `firstTouch` | `{ utm_source, utm_medium, utm_campaign, utm_content, utm_term, ts }` | Только из первого визита с метками; позже не перезаписывается |
| `createdAt` | int (ms) | Для TTL 30 дней |

**Производные значения**: `seatsShown = max(1, seats − booked)`; `timerState = now < deadline ? (deadline − now ≤ 60 000 ? "urgent" : "running") : "expired"`.

**Порядок разрешения**: cookie → `localStorage` → генерация на клиенте → хэш-фолбэк от `visitorId` (если оба хранилища недоступны).

`visitorId` = clientID Яндекс Метрики, если доступен; иначе отпечаток `fnv1a(userAgent + language + screen.width + "x" + screen.height + timeZone)`. В режиме фолбэка `seats` стабилен между перезагрузками, `deadline` живёт до закрытия вкладки.

## 6. QuizState (sessionStorage `tquiz_v1_<segmentId>`)

| Поле | Тип | Правила |
|------|-----|---------|
| `step` | `1 \| 2 \| 3` | |
| `grade` | int \| null | ∈ `Segment.grades`; начальное значение — `grade` из ссылки (если в диапазоне), иначе `Segment.defaultGrade`; обязателен для перехода 1 → 2 |
| `subject` | `"math" \| "russian"` | По умолчанию `math` |
| `tutorId` | string \| null | Обязателен для перехода 2 → 3; репетитор должен вести `subject` |
| `slot` | `{ startsAt, label }` \| null | Обязателен для перехода 2 → 3 |
| `holdExpiresAt` | int \| null | |
| `name` | string | 2–150 символов, буквы, пробел и дефис |
| `phone` | string | `+7 (XXX) XXX-XX-XX`, 10 цифр после +7 |
| `email` | string | Необязателен; если заполнен — валиден по `x@y.z`, ≤ 254 символов |
| `commitment` | bool | Обязателен (`true`) |
| `consentPd` | bool | Обязателен (`true`) |
| `consentAds` | bool | Необязателен |

**Переходы**:

```text
step1 ──[grade && subject]──▶ step2 ──[tutorId && slot && hold активен]──▶ step3
step3 ──Назад──▶ step2 ──Назад──▶ step1          (данные сохраняются)
step3 ──[валидно]──▶ submitting ──confirmed──▶ ticket
                               └─unconfirmed/timeout/error──▶ step3 + сообщение (данные сохраняются)
```

## 7. Booking / Lead (запрос `/api/lead` → вебхук)

Контракт — [contracts/lead-api.md](contracts/lead-api.md).

| Поле | Источник | Правила (сервер) |
|------|----------|------------------|
| `bookingId` | Сервер | `TO-` + 6 символов base32 из SHA-256 `Idempotency-Key` |
| `segment` | Страница | ∈ {`1-4`, `5-9`, `10-11`} |
| `variant` | Состояние | ∈ {`a`, `b`} |
| `grade` | Квиз | Целое, в диапазоне сегмента |
| `subject` | Квиз | ∈ {`math`, `russian`} |
| `tutor` | Квиз | `{ id, name }`; `id` из белого списка репетиторов сегмента (или `placeholder`) |
| `slot` | Квиз | ISO 8601 в будущем, не дальше 7 дней |
| `name`, `phone`, `email` | Квиз | Как в QuizState; телефон 10–15 цифр (совместимость с базовым сервером) |
| `commitment`, `consent_pd` | Квиз | Оба `true`, иначе 400 |
| `consent_ads` | Квиз | bool |
| `discountRequested` | Квиз | `true`, только если email заполнен и таймер скидки не истёк |
| `promoCode` | Конфиг | Подставляется сервером, клиент не передаёт |
| `landing` | Страница | URL без query, сервер добавляет 5 UTM |
| `attribution` | `firstTouch` | Только `utm_*`, каждое ≤ 300 символов |

**Статусы**: `received → confirmed` (вебхук подтвердил) или `unconfirmed` (таймаут или неясный ответ — повтор с тем же ключом возвращает тот же результат в течение 10 минут).

## 8. AnalyticsEvent (dataLayer / Яндекс Метрика)

Контракт — [contracts/analytics-events.md](contracts/analytics-events.md).

| Поле | Тип |
|------|-----|
| `event` | Одно из 10 имён `lp_*` |
| `segment`, `variant` | string |
| `utm_source`, `utm_content` | string \| null |
| `step` | 1–3 (только для шагов) |
| `tutor_id` | string (только для `lp_tutor_select`) |
| `ts` | int (ms) |

Персональные данные (имя, телефон, email) в события не попадают.

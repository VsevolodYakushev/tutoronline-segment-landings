---

description: "Task list for feature 001-segment-landings-quiz"
---

# Tasks: Три сегментных лендинга с квиз-формой брони пробного урока

**Input**: Design documents from `/specs/001-segment-landings-quiz/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Включены — plan.md (Technical Context «Testing», research R14, Complexity Tracking) определяет `node --test` для чистых модулей и сервера и `@playwright/test` для E2E по сценариям quickstart.md.

**Organization**: Задачи сгруппированы по пользовательским историям из spec.md (US1–US4), чтобы каждую можно было реализовать и проверить отдельно.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно выполнять параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: К какой истории относится задача (US1, US2, US3, US4)
- В описании указаны точные пути файлов

## Path Conventions

- Сайт целиком — в `landings/` в корне репозитория (plan.md → Structure Decision).
- Источник ассетов и базового кода — `Design System/tutoronline-adaptive/` (далее **BASE**). BASE и `Design System/` **не изменяются**.
- Пути ниже указаны относительно корня репозитория `F:\Claude\TutorSpecKit`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Инициализация папки `landings/`, ассеты, инструменты

- [X] T001 Создать структуру каталогов из plan.md: `landings/src/content/segments/`, `landings/src/templates/blocks/`, `landings/src/css/`, `landings/src/js/lib/`, `landings/assets/{fonts,tutors,icons,logo,reviews}/`, `landings/tests/{unit,server,e2e}/`, `landings/tools/`; создать `landings/.gitignore` со строками `dist/`, `node_modules/`, `test-results/`, `playwright-report/`
- [X] T002 Создать `landings/package.json`: `"name": "tutoronline-segment-landings"`, `"private": true`, `"type": "module"`, `"engines": {"node": ">=22"}`, scripts `build` = `node build.mjs`, `build:strict` = `node build.mjs --strict`, `start` = `node server.mjs`, `test` = `node --test tests/unit tests/server`, `test:e2e` = `playwright test`; devDependencies `@playwright/test` (последняя стабильная); выполнить `npm install` в `landings/`
- [X] T003 [P] Создать `landings/playwright.config.mjs`: `testDir: 'tests/e2e'`, projects `chromium` и `webkit`; для каждого — 5 viewport-проектов 360×640, 390×844, 768×1024, 1024×768, 1440×900 (имена `chromium-360` … `webkit-1440`); `webServer: { command: 'npm run build && node server.mjs', url: 'http://127.0.0.1:8765/5-9/', env: { LEAD_WEBHOOK_URL: 'https://example.invalid/hook' } }`, `use.baseURL: 'http://127.0.0.1:8765'`
- [X] T004 [P] Скопировать `Design System/tutoronline-adaptive/server.mjs` в `landings/server.mjs` без изменений (исходная точка для расширения в T015, T016, T034)
- [X] T005 [P] Сконвертировать шрифт Graphik в WOFF2 скриптом `landings/tools/convert-fonts.py` (`pip install fonttools brotli`; `fontTools.ttLib.TTFont(...).flavor='woff2'`): `BASE/assets/4992573dec4f6a8276d34864e1353d54.ttf` → `landings/assets/fonts/graphik-400.woff2`, `BASE/assets/da73dcae762abfd8bab78fa597a5bf12.ttf` → `landings/assets/fonts/graphik-500.woff2`
- [X] T006 [P] Сконвертировать фото репетиторов скриптом `landings/tools/convert-images.py` (Pillow ≥ 11.2 с AVIF): для каждого файла создать `landings/assets/tutors/<id>-<w>.webp` и `.avif` для `w` ∈ {160, 320, 500, 640} (без апскейла сверх исходной ширины). Соответствие: `roman-yurievich` ← `BASE/assets/754ff25f1ef0dfcda810fa24054075ca.jpg`; `amet-memetovich` ← `90384372b5bf63caff9218e6f7edfd97.jpg`; `galina-vladimirovna` ← `c85036e15b776c226936397210041fe3.jpg`; `evgenia-nikolaevna` ← `3fc880345ec02d1e591f47bb318e99a7.jpg`; `rustam-ravilevich` ← `5565c44c6df69d1d34027fa8c3734ee1.jpg`; `pavel-stepanovich` ← `6ed1be156fbedf6fd5e5f4e369b702fa.webp`; `inna-ivanovna` ← `6669d86ffbc4f90f53f4762d4381736c.webp`; `ekaterina-olegovna` ← `fef4129c2c0cf78e0fdb37cbd8e3ce59.webp`
- [X] T007 [P] Скопировать иконки и логотипы с kebab-case-именами: из `Design System/icons/` файлы `Ticket.svg`, `Ticket Star.svg`, `Calendar.svg`, `Time Circle.svg`, `Discount.svg`, `Lock.svg`, `Tick Square.svg`, `Shield Done.svg`, `Danger Circle.svg`, `Star.svg`, `Call.svg`, `Profile.svg`, `Chat.svg`, `Game.svg`, `Graph.svg`, `Document.svg` → `landings/assets/icons/<kebab>.svg`; `Design System/logo_big.svg`, `logo_small.svg`, `logo_big_white.svg`, `logo_small_white.svg` → `landings/assets/logo/`; звезду рейтинга `BASE/assets/e97bd60a6f72429a6a5478acf645b192.png` → `landings/assets/icons/star-rating.png`; логотипы площадок, на которые ссылается секция `#reviews` в `BASE/index.html`, → `landings/assets/reviews/` (по атрибутам `src` внутри `<section id="reviews">`)
- [X] T008 [P] Создать `landings/src/content/stopwords.json` — массив подстрок в нижнем регистре, запрещённых в текстах (FR-007): `"исправим"`, `"гарантируем"`, `"гарантия результата"`, `"сдашь на"`, `"сдадите на"`, `"100% результат"`, `"точно поступишь"`, `"подтянем до пятёрки"`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Токены, сборка, сервер страниц, состояние посетителя — всё, без чего ни одна история не работает

**⚠️ CRITICAL**: Работы по историям не начинаются до завершения этой фазы

- [X] T009 Создать `landings/src/css/tokens.css`: скопировать блок `:root{…}` из `BASE/styles.css` дословно; добавить `@font-face` для `Graphik` 400 и 500 из `../assets/fonts/graphik-400.woff2` и `graphik-500.woff2` с `font-display: swap`; добавить токены `--topbar-h: 44px; --container-max: 1200px; --gutter: 16px; --motion-step: 240ms; --tap-min: 44px`
- [X] T010 [P] Создать `landings/src/css/base.css`: reset; `body { font: var(--text-mobile-t1); color: var(--text-1); background: var(--surface); padding-top: var(--topbar-h) }`; `.wrap { max-width: var(--container-max); margin-inline: auto; padding-inline: var(--gutter) }`; `[id] { scroll-margin-top: calc(var(--topbar-h) + 12px) }`; `:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px }`; `input, select, textarea { font-size: 16px }`; кнопки и ссылки-кнопки `min-height: var(--tap-min)`; в `@media (prefers-reduced-motion: reduce)` — отключение `animation` и `transition`; типографика h1–h3: mobile-токены по умолчанию, desktop-токены с `@media (min-width: 1024px)`
- [X] T011 [P] Создать `landings/src/css/components.css` с переносом из `BASE/styles.css` классов `.btn`, `.btn-l`, `.btn-accent`, `.hx-glass`, `.tut-card`, `.tut-photo`, `.tut-img`, `.tut-meta`, `.tut-m`, `.tut-mv`, `.tut-ml`, `.tut-ver`, `.tut-tip`, `.tut-btn` и стилей FAQ (`details/summary` из `#faq`), заменяя литералы цветов на токены (`#5756b3` → `var(--primary)`, `#ff5247` → `var(--accent)`, `#27ae60` → `var(--success)`, `#333333` → `var(--text-1)`, `#4f4f4f` → `var(--text-2)`, `#828282` → `var(--text-3)`, `#f6f7fb` → `var(--background)`, `#f1f3ff` → `var(--secondary)`); встроенные атрибуты `style="…"` из разметки BASE (у `tut-card`, `tut-photo`, заголовков и др.) перенести в классы — в шаблонах новых лендингов атрибутов `style` нет (CSP, T069)
- [X] T012 [P] Создать `landings/src/templates/html.mjs`: тег `` html`…` ``, экранирующий `& < > " '` во всех подстановках; `raw(str)` — пометка безопасной строки; массивы в подстановке склеиваются без разделителя; `null`/`undefined`/`false` → пустая строка
- [X] T013 [P] Создать контент `landings/src/content/offer.json` — `{ "trialPrice": 1500, "trialFinal": 0, "discount": 1500, "lessonPrice": null, "timerMinutes": 15, "seatsMin": 3, "seatsMax": 10, "promoCode": "", "storageVersion": "v1", "ttlDays": 30 }`; `landings/src/content/schedule.json` — `{ "timezone": "Europe/Moscow", "leadHours": 3, "daysToShow": 3, "holdMinutes": 10, "weekly": { "default": { "mon": W, "tue": W, "wed": W, "thu": W, "fri": W, "sat": E, "sun": E } } }`, где `W` = `["16:00","17:00","18:00","19:00","20:00"]`, `E` = `["11:00","12:00","13:00","14:00","15:00"]` (массивы записать полностью); `landings/src/content/site.json` — `{ "phone": "+7 (499) 704-12-12", "phoneHref": "tel:+74997041212", "ymCounterId": null, "legal": {…ссылки на политику и согласия из футера и формы BASE/index.html…}, "reviewPlatforms": […рейтинги и названия площадок из секции #reviews BASE/index.html…] }`; заготовки `landings/src/content/segments/1-4.json`, `5-9.json`, `10-11.json` с валидными полями data-model §1 — `id`, `path`, `grades`, `defaultGrade` (1–4 → 2, 5–9 → 7, 10–11 → 11), `audience` (`10-11` → `student`, остальные `parent`), `theme` (`10-11` → `contrast`, остальные `light`), `meta`, `topbar.seatsTemplate` = `"Осталось {n} {seats} на этой неделе"`, `tutorIds` (`math` — 5 репетиторов со статистикой, `russian` — `["russian-match"]`), `extraBlocks` (`5-9` → `["oge"]`, `10-11` → `["parents"]`, `1-4` → `[]`), `hero.a.title` из ТЗ; содержательные блоки (`pains`, `trialSteps`, `faq`, `final`) пока пустые — их заполняют T044–T046
- [X] T014 [P] Создать `landings/src/content/tutors.json` по data-model §2 (поля `id`, `name`, `nameGenitive`, `gender`, `photo {webp, avif, focal}`, `subjects`, `subjectsLabel`, `experienceYears`, `lessonsCount`, `rating`, `verified`, `placeholder`) с данными из BASE дословно: Роман Юрьевич (`math, physics, highermath`, «Математика, физика, высшая математика», 15 лет, 13 678 уроков, 5,0, m); Амет Меметович (`math, physics`, 4 года, 6 415, 5,0, m); Галина Владимировна (`math`, 39 лет, 1 217, 4,7, f); Евгения Николаевна (`math, highermath`, 22 года, 1 059, 4,6, f); Рустам Равилевич (`math, physics, chemistry`, 7 лет, 2 331, 4,6, m); Павел Степанович, Инна Ивановна, Екатерина Олеговна (`math`, «Преподаватель математики», `experienceYears`/`lessonsCount`/`rating` = null, `verified: true`); плюс `{ "id": "russian-match", "name": "Подберём репетитора по русскому", "subjects": ["russian"], "placeholder": true }`. Правило: «`id` уникален, `[a-z0-9-]+`»; «минимум один из `math` или `russian`»
- [X] T015 Расширить `landings/server.mjs` по contracts/page-urls.md: раздача из `dist/`; `/1-4/`, `/5-9/`, `/10-11/` → `dist/<seg>/index.html`; `/` → `302` на `/5-9/` с сохранением query; `/5-9` (без слеша) → `301` на `/5-9/`; белый список `/assets/…`, `/css/…`, `/js/…` (расширения `woff2|webp|avif|png|jpg|svg|css|mjs|js|ics`) с `Cache-Control: public, max-age=31536000, immutable` для файлов с хэшем в имени; всё прочее — `404` JSON как в BASE; сохранить поддержку `HEAD` и заголовков безопасности BASE
- [X] T016 Добавить в `landings/server.mjs` выдачу cookie посетителя (research R5): при отдаче страницы сегмента без cookie `tst_v1_<seg>` — `Set-Cookie: tst_v1_<seg>=<seats>.<deadlineMs>.<variant>; Max-Age=2592000; Path=/; SameSite=Lax` + `; Secure`, если `PUBLIC_ORIGIN` начинается с `https:`; `seats = crypto.randomInt(offer.seatsMin, offer.seatsMax + 1)`, `deadline = Date.now() + offer.timerMinutes * 60000`, `variant = crypto.randomInt(2) ? 'b' : 'a'`; значения offer читать из `src/content/offer.json` при старте
- [X] T017 Создать `landings/build.mjs` (только встроенные модули Node): загрузка всех JSON из `src/content/`; валидация с понятной ошибкой и `process.exit(1)` — `seatsMin ≤ seatsMax`, `timerMinutes > 0`, уникальность и формат `Tutor.id` (`[a-z0-9-]+`), все `Segment.tutorIds` ссылаются на существующих репетиторов, `defaultGrade` ∈ `grades`, ни один текст сегмента не содержит подстрок из `stopwords.json` (регистронезависимо, всегда), ни один шаблон не выдаёт атрибут `style=`; в строгом режиме (`--strict` или `NODE_ENV=production`) дополнительно — `pains.items` ровно 3, `trialSteps.items` 3–4, `faq` ≥ 4, `offer.promoCode` не пуст; без строгого режима отсутствующие содержательные блоки рендерятся пустыми (это позволяет собрать MVP до US2); рендер `src/templates/page.mjs` для каждого сегмента в `dist/<seg>/index.html`; копирование `src/css/*.css` (склейка в `dist/css/landing.<hash>.css` в порядке tokens → base → components → themes), `src/js/**` → `dist/js/` (имя `main.<hash>.mjs`, импорты lib — относительные без хэша), `assets/` → `dist/assets/`; хэш = первые 8 hex SHA-256 содержимого
- [X] T018 Создать `landings/src/templates/page.mjs` — каркас страницы: `<html lang="ru" data-segment="<id>" data-theme="<theme>">`; `<head>`: charset, viewport `width=device-width, initial-scale=1, viewport-fit=cover`, `<title>`/description из `segment.meta`, `preload` `graphik-500.woff2` (`as=font crossorigin`), ссылка на CSS, inline-скрипт (≤ 1 КБ), который до отрисовки ставит `document.documentElement.dataset.variant` из `?v=a|b`, иначе из cookie `tst_v1_<seg>` (третья часть значения), иначе `a`; `<script type="application/json" id="lp-config">` с `{ segment, offer (включая promoCode — код не секретен, ТЗ §3), schedule, tutors (только нужные сегменту), site }`; `<body>` с вызовами блоков по порядку каркаса ТЗ (topbar, hero, pains, trial, tutors, reviews, offer, quiz, faq, final), вставкой `extraBlocks` после trial (`oge`) или после faq (`parents`), footer; `<noscript>` с телефоном `site.phone` вместо формы; `<script type="module" src="/js/main.<hash>.mjs">`. Пока блоков нет — каждый вызов возвращает пустую строку из `src/templates/blocks/index.mjs`
- [X] T019 [P] Создать `landings/src/js/lib/plural.mjs`: `plural(n, ['место','места','мест'])` по правилам русского языка (1, 21 → «место»; 2–4, 22–24 → «места»; 0, 5–20, 25+ → «мест»); `seatsPhrase(n, template)` подставляет в `segment.topbar.seatsTemplate` число `{n}` и форму слова `{seats}` (для шаблона по умолчанию n = 1 → «Осталось 1 место на этой неделе»); сама фраза в коде не зашивается
- [X] T020 [P] Создать `landings/src/js/lib/visitor-state.mjs` по data-model §5: ключ `tst_v1_<segmentId>`; `parseCookie(str)` → `{seats, deadline, variant}`; `serializeCookie(state)` → `<seats>.<deadlineMs>.<variant>`; `load(segmentId, offer, now)` с порядком разрешения «cookie → `localStorage` → генерация на клиенте → хэш-фолбэк от `visitorId`»; каждое обращение к `localStorage`/`document.cookie` — в `try/catch`; зеркалирование cookie ↔ `localStorage` в обе стороны; запись старше `ttlDays` (30) по `createdAt` пересоздаётся; `visitorId` = clientID Яндекс Метрики, если доступен, иначе `fnv1a(navigator.userAgent + navigator.language + screen.width + 'x' + screen.height + Intl.DateTimeFormat().resolvedOptions().timeZone)`; `hashSeats(visitorId, segmentId) = 3 + fnv1a(visitorId + segmentId) % 8`; дедлайн в режиме фолбэка хранится в памяти вкладки; `seatsShown = max(1, seats − booked)`; `timerState(now) = now < deadline ? (deadline − now ≤ 60000 ? 'urgent' : 'running') : 'expired'`; `captureFirstTouch(searchParams)` — пять `utm_*` (каждое ≤ 300 символов) + `ts`, записываются только если `firstTouch` ещё нет; `markBooked()`, `markExpired()`; функции чистые там, где возможно, DOM/хранилища инъецируются для тестов
- [X] T021 [P] Создать `landings/src/js/analytics.mjs` (ядро): `track(event, params)` пушит `{ event, segment, variant, utm_source, utm_content, ts, ...params }` в `window.dataLayer` и, если `site.ymCounterId` задан и `window.ym` есть, вызывает `ym(id, 'reachGoal', event, params)`; перед отправкой удаляет ключи `name`, `phone`, `email` (защита от ПДн); `init({ segment, variant, firstTouch, ymCounterId })`
- [X] T022 Создать `landings/src/js/main.mjs`: чтение `#lp-config`, `visitorState.load(...)`, `captureFirstTouch(location.search)`, `analytics.init(...)`, экспорт контекста `{ config, state }` для модулей историй; безопасная инициализация модулей (ошибка одного не ломает остальные)
- [X] T023 [P] Unit-тесты `landings/tests/unit/plural.test.mjs` (n = 1, 2, 4, 5, 10, 11, 21, 22, 25) и `landings/tests/unit/visitor-state.test.mjs` (парсинг и сериализация cookie; порядок разрешения; недоступный `localStorage` бросает исключение — состояние берётся из cookie; оба хранилища недоступны — `hashSeats` стабилен для одного `visitorId` и ∈ [3, 10]; TTL 30 дней; `seatsShown` не ниже 1; `firstTouch` не перезаписывается)

**Checkpoint**: `npm run build` собирает три каркаса из заготовок сегментов (T013), `npm start` отдаёт `/1-4/`, `/5-9/`, `/10-11/` с cookie `tst_v1_<seg>`, `npm test` зелёный

---

## Phase 3: User Story 1 — Бронь бесплатного пробного урока через 3-шаговую квиз-форму (Priority: P1) 🎯 MVP

**Goal**: Посетитель проходит 3 шага, получает «билет», заявка со всеми полями попадает в CRM

**Independent Test**: На `/5-9/?utm_source=avito&utm_content=TEST1` пройти форму до «билета» с тестовым номером; в тестовом приёмнике — 6 полей вебхука, `info` содержит номер брони, сегмент, класс, предмет, репетитора, слот МСК, промокод, вариант, `avito`, `TEST1` (quickstart Q6–Q13)

### Tests for User Story 1

- [X] T024 [P] [US1] Серверные тесты `landings/tests/server/lead.test.mjs` с подменой `upstreamFetch`: таблица валидации из contracts/lead-api.md (каждый код ошибки: `invalid_form`, `invalid_slot`, `invalid_phone`, `invalid_email`, `commitment_required`, `consent_required`, `invalid_landing`); `tutor.name` перезаписывается из `tutors.json`; `discountRequested = true` только при непустом валидном email; `promoCode` подставляется сервером; формат `info` из contracts/crm-webhook.md (порядок пар, `—` для пустых, `Репетитор: подобрать (русский язык)` для placeholder, ≤ 1000 символов, значения ≤ 120); `bookingId` детерминирован для одного `Idempotency-Key` и соответствует `^TO-[A-HJ-NP-Z2-9]{6}$`; повтор с тем же ключом не вызывает вебхук повторно и возвращает тот же `bookingId`; `isConfirmed` — те же кейсы, что в BASE
- [X] T025 [P] [US1] Unit-тесты `landings/tests/unit/slots.test.mjs`: только ближайшие 3 дня, где есть слоты; первый слот не раньше `now + 3 ч`; время в МСК независимо от часового пояса процесса (`TZ=Asia/Vladivostok` и `TZ=UTC` дают одинаковые `startsAt`); метка «ср, 12 нояб., 18:00 МСК»
- [X] T026 [P] [US1] Unit-тесты `landings/tests/unit/phone-mask.test.mjs`: ввод `9123456789` → `+7 (912) 345-67-89`; вставка `89123456789`, `79123456789`, `+7 912 345 67 89` → тот же результат; `isValid` ровно при 10 цифрах после +7
- [X] T027 [P] [US1] Unit-тесты `landings/tests/unit/quiz-state.test.mjs`: начальный `grade` = `?grade` в диапазоне сегмента, иначе `segment.defaultGrade` (для `5-9` без параметра — 7, с `?grade=12` — 7); порядок репетиторов на шаге 2 — предвыбранный первым, всего не больше 3; переходы из data-model §6 (`step1 →[grade && subject]→ step2 →[tutorId && slot && hold активен]→ step3`, «Назад» сохраняет все поля, `submitting → ticket | step3 + сообщение`); смена предмета сбрасывает репетитора, который не ведёт новый предмет; истечение холда сбрасывает `slot` и `holdExpiresAt`, но не контакты
- [X] T028 [P] [US1] E2E `landings/tests/e2e/quiz.spec.mjs` (перехват `/api/lead` через `page.route`): Q6 полный проход до «билета»; Q7 ошибка телефона при `blur` и сохранение после «Назад»; Q8 блокировка без обязательства; Q10 «Хочу к этому репетитору» открывает шаг 2 с выбранным репетитором первым в списке (проверить и для 5-го репетитора блока); Q6 дополнительно — на шаге 1 класс 7 предвыбран, на шаге 3 код промокода виден до отправки; Q11 «Русский язык» показывает placeholder и кнопку без имени; Q12 двойной клик → один запрос, ответ `502 upstream_unconfirmed` → сообщение с телефоном, без «билета»

### Implementation for User Story 1

- [X] T029 [P] [US1] Создать `landings/src/js/lib/slots.mjs`: `buildSlots({ weekly, tutorId, now, leadHours: 3, daysToShow: 3, timezone: 'Europe/Moscow' })` → `[{ date, label, slots: [{ tutorId, startsAt: ISO с +03:00, label }] }]`; вычисление МСК через смещение `+03:00` (без DST) независимо от пояса устройства; `weekly[tutorId] ?? weekly.default`; дни без слотов пропускаются; метка через `Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' })` + « МСК»
- [X] T030 [P] [US1] Создать `landings/src/js/lib/phone-mask.mjs`: `attachPhoneMask(input)` — маска `+7 (XXX) XXX-XX-XX`, нормализация вставки `8…`/`7…`/`+7…`, корректная работа Backspace на разделителях, `inputmode="tel"`, `autocomplete="tel"`; `isValidPhone(value)` — «10 цифр после +7»
- [X] T031 [P] [US1] Создать `landings/src/js/lib/calendar.mjs`: `icsBlob({ bookingId, tutorName, startsAt, durationMin: 45, phone })` (VCALENDAR/VEVENT, `DTSTART`/`DTEND` в UTC, `SUMMARY: Пробный урок TutorOnline — <репетитор>`, `UID: <bookingId>@tutoronline`); `googleCalendarUrl(...)`; `addToCalendar(...)` — скачивание `.ics` через `URL.createObjectURL`, при ошибке (встроенные браузеры) — открыть ссылку Google Calendar, при ошибке и этого — вернуть `false` для показа даты текстом
- [X] T032 [P] [US1] Создать `landings/src/js/quiz-state.mjs` — чистый автомат по data-model §6 без DOM: состояние `{ step, grade, subject: 'math', tutorId, slot, holdExpiresAt, name, phone, email, commitment, consentPd, consentAds }`; валидаторы — `name`: «2–150 символов, буквы, пробел и дефис»; `phone`: «`+7 (XXX) XXX-XX-XX`, 10 цифр после +7»; `email`: «Необязателен; если заполнен — валиден по `x@y.z`, ≤ 254 символов»; `commitment` и `consentPd` обязательны (`true`); `grade` ∈ `Segment.grades`, начальное значение — `?grade` (если в диапазоне), иначе `Segment.defaultGrade`; `subject` ∈ {`math`, `russian`}; `tutorId` должен вести `subject`; сериализация в `sessionStorage` под ключом `tquiz_v1_<segmentId>` (в `try/catch`)
- [X] T033 [US1] Создать блок `landings/src/templates/blocks/quiz.mjs` (`<section id="form">`):
  - прогресс-бар `Шаг N из 3` (`role="progressbar"`, `aria-valuenow`);
  - **шаг 1** — чипы классов `segment.grades` (кнопки `aria-pressed`, один тап; класс по умолчанию уже выбран — T032) и предметов «Математика» (выбран) / «Русский язык»;
  - **шаг 2** — до 3 карточек репетиторов выбранного предмета: предвыбранный (`?tutor` или «Хочу к этому репетитору») первым, остальные по порядку `segment.tutorIds[subject]` (фото `<picture>` AVIF/WebP `srcset` 160/320, имя, предмет, стаж; для placeholder — карточка без фото и стажа с текстом «Подберём репетитора по русскому»), слоты по дням, строка «{Имя} будет ждать вас в {ср, 18:00}», холд «Место закреплено за вами 10:00» (`aria-live="polite"`);
  - **шаг 3** — поля «Имя», «Телефон» (`type="tel"`); блок «Заполните также для получения скидки» с полем Email (после истечения таймера подпись меняется на «Email (необязательно)»); плашка «Промокод на 100% применён» с кодом `offer.promoCode`; итог «Пробный урок ~~1 500 ₽~~ 0 ₽» (суммы из `offer`); чекбокс-обязательство «Я приду на урок. Если планы изменятся — предупрежу за 3 часа, чтобы место получил другой ученик» (required); согласие на обработку ПДн (required, текст и ссылка из BASE); согласие на рекламу (необязательное, текст из BASE);
  - кнопка «Закрепить урок у {nameGenitive}» (для placeholder — «Закрепить пробный урок»), кнопки «Назад» и «Далее»;
  - контейнер ошибок под каждым полем (`aria-describedby`), общий статус (`role="status"`);
  - шаблон «билета» (`<template id="ticket-tpl">`): номер брони, фото и имя репетитора, дата и время МСК, промокод, кнопка «Добавить в календарь», текст «{Имя} получила/получил вашу бронь и готовит урок» по `gender`, для placeholder — «Менеджер подберёт репетитора и подтвердит урок»
- [X] T034 [US1] Расширить `landings/server.mjs` — `leadFields` и `/api/lead` по contracts/lead-api.md и contracts/crm-webhook.md:
  - новые поля: `segment` ∈ {`1-4`,`5-9`,`10-11`}; `variant` ∈ {`a`,`b`}; `grade` — целое в диапазоне сегмента; `subject` ∈ {`math`,`russian`}; `tutor.id` есть в `tutors.json` и ведёт `subject` (или placeholder для `russian`); `slot` — ISO 8601 «от now + 0 ч до now + 7 сут», иначе `invalid_slot`; `name` 2–150 символов; `commitment === true`, иначе `commitment_required`; `consent_pd === true`, иначе `consent_required`;
  - `tutor.name` перезаписывается из `tutors.json`; `promoCode` берётся из `offer.json`, а не от клиента; `discountRequested` остаётся `true`, только если клиент прислал `true` и email непустой и валиден;
  - раскладка в 6 полей вебхука: `subject` — «Математика»/«Русский язык», `email`, `landing` + 5 UTM, `info` — строго в формате crm-webhook.md;
  - `bookingId = 'TO-' + base32(sha256(Idempotency-Key))` (первые 6 символов, алфавит без `0/O/1/I`) в ответе `200 { success: true, bookingId }`, кешируется вместе с результатом идемпотентности;
  - лимиты, `Origin`, 16 КБ, 10 минут идемпотентности и запрет логирования ПДн — без изменений
- [X] T035 [US1] Создать `landings/src/js/quiz.mjs` (DOM-контроллер, использует T029–T033):
  - рендер шагов; переход сдвигом `transform` за `var(--motion-step)`, фокус на заголовок шага;
  - выбор чипа или репетитора — класс `is-selected` (масштаб + обводка `--accent`);
  - предвыбор из `?grade=` (иначе `segment.defaultGrade`), `?subject=`, `?tutor=` (contracts/page-urls.md) и из `data-tutor` кнопок «Хочу к этому репетитору»;
  - холд: при выборе слота `holdExpiresAt = now + holdMinutes·60000`, отсчёт ММ:СС; по истечении — сброс слота и сообщение «Время брони истекло — место освобождено, выберите время снова», контакты сохраняются;
  - валидация на `blur`, ошибка под полем без сброса данных; состояния полей `is-focus`, `is-error`, `is-loading`, `is-valid`;
  - кнопка отправки получает класс `is-ready` (пульсация), когда все обязательные поля валидны;
  - отправка: `Idempotency-Key` создаётся заново только при смене сигнатуры данных (как в `BASE/app.js`), таймаут 22 с, `aria-busy`, текст «Закрепляем…»;
  - ответ 200 — «билет» из шаблона с `bookingId` и промокодом, затем `visitorState.markBooked()`; коды ошибок → тексты, телефон `site.phone` для `upstream_unconfirmed`/`upstream_timeout`/сети;
  - черновик в `sessionStorage` и восстановление после перезагрузки
- [X] T036 [US1] Добавить стили квиза в `landings/src/css/components.css`: `.quiz`, `.quiz-progress`, `.chip` (min 44×44, `aria-pressed`/`.is-selected`: `transform: scale(1.03)` + `box-shadow: 0 0 0 2px var(--accent)`), `.slot-grid`, `.slot`, `.hold-timer`, `.tutor-pick`, `.field` и состояния (`.is-error` — рамка и текст `var(--accent)`, `.is-valid` — `var(--success)`), `.promo-plate`, `.price-total s`, `.btn.is-ready` (мягкая пульсация `@keyframes` 1,6 с), `.ticket` (карточка-«билет» с перфорацией через `radial-gradient`, иконка `ticket.svg`), анимация шагов `transform`/`opacity` за `var(--motion-step)`; всё — на токенах из `tokens.css`. Визуальные ограничения (по итогам ревью формы BASE 2026-11-05):
  - не больше двух уровней вложенности карточек (секция → белая карточка формы);
  - без размытых цветных пятен (`filter: blur`), «стекла» (`backdrop-filter`) и цветных теней у кнопок внутри формы;
  - один акцентный цвет на экран: `--accent` у кнопки, жёлтый — только у бейджа «0 ₽»;
  - на ≤ 720 px поля формы начинаются не ниже 260 px от верха секции, второстепенные списки — под формой;
  - образец — блок «Contact form v3» в конце `BASE/styles.css`
- [X] T037 [US1] Создать блок `landings/src/templates/blocks/tutors.mjs` (`<section id="tutors">`): карточки `tut-card` из T011 для `segment.tutorIds[subject]` (фото `<picture>` с `srcset` 320/500/640 и `sizes`, имя, значок проверки, предметы, стаж, уроки, рейтинг — пустые метрики не выводятся); кнопка «Хочу к этому репетитору» с `href="#form"` и `data-tutor="<id>"`; горизонтальный скролл со `scroll-snap` на мобильном
- [X] T038 [US1] Дополнить заготовку `landings/src/content/segments/5-9.json` (из T013) полем `quizVariant.a` (заголовки трёх шагов) и подключить блоки quiz и tutors в `landings/src/templates/blocks/index.mjs` и `page.mjs`; подключить `quiz.mjs` в `main.mjs`

**Checkpoint**: На `/5-9/` форма проходит все 3 шага до «билета»; `npm test` и `npx playwright test quiz` зелёные — MVP готов

---

## Phase 4: User Story 2 — Лендинг говорит болью своего сегмента (Priority: P1)

**Goal**: Три полноценных лендинга с 10 блоками, текстами сегмента и адаптивом; первый экран продаёт бронь без прокрутки

**Independent Test**: Открыть `/1-4/`, `/5-9/`, `/10-11/` в 360×640 — заголовок-боль, оффер, 3 репетитора, счётчик мест и кнопка видны без прокрутки; все блоки каркаса на месте; на 768/1024/1440 — раскладка из FR-030 (quickstart Q1, Q17, Q19, Q21)

### Tests for User Story 2

- [X] T039 [P] [US2] E2E `landings/tests/e2e/layout.spec.mjs`: Q1 — во viewport 360×560 (360×640 минус панели встроенных браузеров) для каждого сегмента `h1`, подзаголовок оффера, 3 аватара, `.seats-badge` и `.hero .btn` целиком внутри viewport без прокрутки; порядок секций: topbar → hero → pains → trial → tutors → reviews → offer → form → faq → final; наличие `#oge` только у `/5-9/` и `#parents` только у `/10-11/`; Q17 — `document.documentElement.scrollWidth ≤ innerWidth` на всех 5 ширинах; на 768 — две карточки репетиторов в ряд; на 1024 — hero в 2 колонки; на 1440 — `#form` с `position: sticky` справа и контейнер ≤ 1200 px; Q19 — с `javaScriptEnabled: false` контент виден и показан телефон; все ссылки-кнопки ≥ 44×44
- [X] T040 [P] [US2] Unit-тест сборки `landings/tests/unit/build.test.mjs`: временный контент со словом «исправим» → `build.mjs` завершается с кодом 1 и сообщением о стоп-слове (Q21); `pains.items` из 2 элементов → ошибка только с `--strict`, без него сборка проходит; неизвестный `tutorIds` → ошибка всегда; шаблон с атрибутом `style=` → ошибка

### Implementation for User Story 2

- [X] T041 [P] [US2] Блок `landings/src/templates/blocks/header.mjs` и `footer.mjs`: логотип `assets/logo/logo_small.svg` (мобильный) / `logo_big.svg` (≥ 1024), телефон `site.phone`; футер — юридические ссылки и реквизиты из футера BASE (`<footer class="ft">`) дословно, белый логотип
- [X] T042 [P] [US2] Блок `landings/src/templates/blocks/hero.mjs` (`<section id="top" class="hero">`): бейдж оффера, `h1` = `hero.<variant>.title`, подзаголовок, кнопка «Забронировать бесплатный урок» (`href="#form"`, `data-cta="hero"`), 3 аватара репетиторов первого экрана (`pavel-stepanovich`, `inna-ivanovna`, `ekaterina-olegovna`; первое изображение `fetchpriority="high"`, остальные `loading="lazy"`, `<picture>` AVIF/WebP `srcset` 160/320/500) с подписями имён, контейнер `.seats-badge` у аватаров (число заполняет US3, до этого скрыт), строка «После урока вы решаете, продолжать занятия или нет» из BASE; разметка обоих вариантов `a` и `b` с атрибутом `data-variant-only`
- [X] T043 [P] [US2] Блоки `landings/src/templates/blocks/pains.mjs` («Если это про вас…», 3 карточки с иконкой из `assets/icons/`), `trial.mjs` («Как проходит пробный урок», 3–4 нумерованных шага), `reviews.mjs` (рейтинги независимых площадок из `site.reviewPlatforms` с логотипами из `assets/reviews/`; без вымышленных отзывов), `faq.mjs` (`<details>`/`<summary>`, первый открыт), `final.mjs` (повтор оффера и кнопка `data-cta="final"`), `oge.mjs` (`id="oge"`), `parents.mjs` (`id="parents"`)
- [X] T044 [US2] Дописать `landings/src/content/segments/5-9.json` до полного: `hero.a.title` «Тройка в четверти? Найдём пробел за 1 бесплатный урок», `hero.a.subtitle` с оффером (бесплатный пробный, диагностика пробелов, план к концу четверти); `pains` — тройки и пробелы, ОГЭ в 9 классе, конфликты из-за оценок; `trialSteps` — знакомство, диагностика пробелов, план к концу четверти, решение без обязательств; блок `oge`; `faq` ≥ 4 (почему бесплатно, что после пробного, нужно ли платить, можно ли перенести) + ответы из FAQ BASE, где применимо (термин «урок-диагностика» заменить на «бесплатный пробный урок»); `final`; тон — деловой, конкретный; без стоп-слов
- [X] T045 [P] [US2] Дописать заготовку `landings/src/content/segments/1-4.json` (из T013): `grades` [1,2,3,4], `audience: "parent"`, `theme: "light"`, `hero.a.title` «Домашка без слёз — первый урок бесплатно»; `pains` — слёзы над домашкой, читает по слогам или отстаёт в счёте, вечера уходят на уроки; `trialSteps` — игровой формат, короткие задания, внимание ребёнка, план; `faq` ≥ 4 + «Подойдёт ли онлайн младшему школьнику?» из FAQ BASE (с заменой «диагностика» → «пробный урок»); `tutorIds.math` и `russian`; `extraBlocks: []`; тон — тёплый, заботливый
- [X] T046 [P] [US2] Дописать заготовку `landings/src/content/segments/10-11.json` (из T013): `grades` [10,11], `audience: "student"` (обращение на «ты»), `theme: "contrast"`, `hero.a.title` «Сколько баллов тебе не хватает до бюджета?»; `pains` — баллы ЕГЭ, нет времени, страх не поступить; `trialSteps` — диагностика по заданиям ЕГЭ, план по баллам; `extraBlocks: ["parents"]` с текстом для оплачивающего родителя; `faq` ≥ 4 + минимум 2 вопроса родителя (оплата, рассрочка/маткапитал/налоговый вычет — из блока цен BASE); без обещаний баллов
- [X] T047 [US2] Создать `landings/src/css/themes.css`: `[data-theme="light"]` — токены по умолчанию; `[data-theme="contrast"]` для 10–11 — тёмный hero (`--primary` фон, белый текст), усиленные акценты `--accent`; более мягкие радиусы и игровые акценты для `[data-segment="1-4"]` (иконки `game.svg`); контраст текста ≥ 4.5:1
- [X] T048 [US2] Адаптив в `landings/src/css/components.css` (mobile-first, FR-030): база 360; `@media (min-width: 390px)` — отступы и safe-area; `@media (min-width: 768px)` — репетиторы 2 в ряд, форма по центру (`max-width: 560px`); `@media (min-width: 1024px)` — hero в 2 колонки (текст + аватары); `@media (min-width: 1280px)` — `main` как сетка `minmax(0,1fr) 420px`, `#form` в правой колонке с `position: sticky; top: calc(var(--topbar-h) + 16px)` через `grid-row: 1 / span 99`, контейнер ≤ 1200 px; нет горизонтальной прокрутки ни на одной ширине
- [X] T049 [US2] Создать `landings/src/js/floating.mjs` (часть, не зависящая от таймера): нижняя кнопка `.m-sticky` (`position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom)`) показывается только на ширине ≤ 720 px после ухода `#top` из вьюпорта и скрывается, когда видны `#form` или `footer` (`IntersectionObserver`, как в `BASE/app.js`); при `focusin` на `input`/`textarea` и при уменьшении `visualViewport.height` более чем на 150 px нижняя кнопка скрывается; добавить разметку `.m-sticky` (кнопка «Забронировать бесплатный урок», `data-cta="sticky"`) в `page.mjs`; подключить в `main.mjs`
- [X] T050 [US2] Подключить все блоки в `landings/src/templates/blocks/index.mjs` и `page.mjs` в порядке каркаса ТЗ, с `extraBlocks` из контента; пересобрать три страницы и убедиться, что `npm run build` проходит валидацию T017

**Checkpoint**: Три лендинга полностью свёрстаны, форма US1 работает на каждом; `npx playwright test layout` зелёный

---

## Phase 5: User Story 3 — Ограниченный оффер, который виден и не «прыгает» (Priority: P2)

**Goal**: Лестница выгоды, sticky-таймер скидки 15 минут и счётчик мест 3–10, устойчивые к перезагрузке; после истечения таймера пробный остаётся доступным

**Independent Test**: Записать N и таймер → F5 → повторный визит через 2 минуты: N тот же, таймер продолжил отсчёт; после истечения скидка «сгорела», бронь работает (quickstart Q2–Q5)

### Tests for User Story 3

- [X] T051 [P] [US3] Unit-тест `landings/tests/unit/timer.test.mjs`: формат ММ:СС; `running → urgent` за 60 000 мс до дедлайна; `expired` после; колбэк истечения вызывается ровно один раз, даже если вкладка «проспала» дедлайн (`now` перескочил)
- [X] T052 [P] [US3] E2E `landings/tests/e2e/scarcity.spec.mjs`: Q2 — N и дедлайн одинаковы после `reload()` и после нового контекста с теми же cookie; таймер уменьшился; N совпадает в `.topbar`, `.seats-badge` и форме; Q3 — `/1-4/` и `/10-11/` имеют независимые cookie; Q4 — cookie с `deadline = now + 65 с` → через 6 с класс `is-urgent`, после 0 — «сгорела», кнопка брони видна, ровно одно событие `lp_timer_expired` в `dataLayer`; Q5 — `localStorage` заблокирован (`addInitScript`, переопределение с throw) → страница работает, N стабилен между перезагрузками; после успешной брони (мок `/api/lead`) N уменьшился на 1, но не ниже 1

### Implementation for User Story 3

- [X] T053 [P] [US3] Создать `landings/src/js/lib/timer.mjs`: `createTimer({ deadline, now = Date.now, onTick, onUrgent, onExpire })` — тик раз в 1 с с коррекцией по `now()`, немедленное обновление на `visibilitychange`, `format(ms)` → `ММ:СС`, `onExpire` один раз; `stop()`
- [X] T054 [P] [US3] Блок `landings/src/templates/blocks/topbar.mjs`: `<div class="topbar" role="region" aria-label="Предложение">` с иконкой `time-circle.svg`, текстом «Скидка 1500 ₽ сгорит через» + `<span class="timer" aria-live="off">15:00</span>` и `<span class="seats" data-seats>` (фраза по `segment.topbar.seatsTemplate`, T019); высота `var(--topbar-h)` (44 px ≤ 48 px), `position: fixed; top: 0`; без JS показывает только «Бесплатный пробный урок» без таймера
- [X] T055 [P] [US3] Блок `landings/src/templates/blocks/offer.mjs` (`<section id="offer">`, оффер-стек): лестница из трёх ступеней — 1) «Бесплатный пробный урок»: диагностика пробелов, план занятий; 2) «Промокод на 100%»: код закрепляется за бронью; 3) «−1500 ₽ на первое платное занятие» с бейджем «−1500 ₽»; цена после скидки (`~~lessonPrice~~ → lessonPrice − discount`) выводится, только если `offer.lessonPrice` не `null` — до ответа заказчика (D5) не выводится; перечёркнутая сумма `offer.trialPrice` (1 500 ₽ → 0 ₽) относится к ступени 1; стикер `.sticker` («−1500 ₽» / «0 ₽», `position: absolute` в углу карточки); привязка к таймеру (`data-timer-bound`); кнопка `data-cta="offer"`
- [X] T056 [US3] Стили дефицита в `landings/src/css/components.css`: `.topbar` (фон `var(--primary)`, белый текст, `.timer.is-urgent` — цвет `var(--accent)`); `.sticker` — `@keyframes sway` (покачивание ±4°, 0,6 с) в цикле 4,5 с (`animation: sway 4.5s infinite`, движение в первые 13% цикла); `.seats-badge::before` — пульсирующая точка `var(--success)` (`@keyframes pulse` 1,5 с); `.is-burned` — перечёркивание и подпись «сгорела» серым `var(--text-3)`; всё отключается в `prefers-reduced-motion`
- [X] T057 [US3] Создать `landings/src/js/scarcity.mjs`: из `visitorState` заполняет все `[data-seats]` фразой `seatsPhrase(seatsShown)` (plural.mjs) и `.seats-badge`; запускает `timer.mjs` от `state.deadline`: обновляет `.timer`, на `urgent` ставит `is-urgent`, на `expire` — `is-burned` всем `[data-timer-bound]`, заменяет текст плашки на «Скидка 1500 ₽ сгорела — бесплатный пробный урок по-прежнему доступен», вызывает `visitorState.markExpired()` и `analytics.track('lp_timer_expired')` только если `state.expired === false`; если дедлайн уже прошёл при загрузке — сразу состояние «сгорела» без события; подписывается на событие `lp:booked` (из `quiz.mjs`) для пересчёта N; подключить в `main.mjs`
- [X] T058 [US3] Интеграция с формой в `landings/src/js/quiz.mjs` и `blocks/quiz.mjs`: на шаге 3 показывать плашку «Промокод на 100% уже применён» с кодом `offer.promoCode` из `#lp-config` (код не секретен, ТЗ §3), итог «~~1 500 ₽~~ 0 ₽»; в теле заявки `discountRequested` = email заполнен и таймер не истёк; если таймер истёк — строка скидки «−1500 ₽ на первое занятие — сгорела», бронь не прерывается; в «билете» — пробный 0 ₽, скидка только если не истекла; после успеха — `document.dispatchEvent(new CustomEvent('lp:booked'))`; в `server.mjs` вернуть `promoCode` в ответе 200 вместе с `bookingId`
- [X] T059 [US3] Подключить блоки topbar и offer в `landings/src/templates/blocks/index.mjs`/`page.mjs`; в `floating.mjs` (T049) — при открытой клавиатуре переводить `.topbar` в `position: absolute`, чтобы она не перекрывала поле в фокусе

**Checkpoint**: Таймер и места устойчивы, дефицит виден в плашке, первом экране, оффер-стеке и форме; `npx playwright test scarcity` зелёный

---

## Phase 6: User Story 4 — Маркетолог видит, где теряется конверсия (Priority: P3)

**Goal**: 10 событий воронки с сегментом, вариантом и UTM; варианты A/B первого экрана и формы; метки и вариант доходят до CRM

**Independent Test**: `/5-9/?utm_source=avito&utm_content=TEST1` → пройти форму → в `dataLayer` все события из contracts/analytics-events.md без ПДн; `?v=b` показывает вариант b без мигания (quickstart Q14, Q15)

### Tests for User Story 4

- [X] T060 [P] [US4] Unit-тест `landings/tests/unit/analytics.test.mjs`: `track` добавляет `segment`, `variant`, `utm_source`, `utm_content`, `ts`; удаляет `name`, `phone`, `email`; без `ymCounterId` не вызывает `ym`; с `ymCounterId` вызывает `ym(id, 'reachGoal', event, params)`
- [X] T061 [P] [US4] E2E `landings/tests/e2e/analytics.spec.mjs`: Q14 — после полного прохода формы (мок `/api/lead`) в `window.dataLayer` есть `lp_view`, `lp_scroll_50`, `lp_form_start` (с `source`), `lp_step_1`, `lp_step_2` (с `subject`, `grade`), `lp_step_3`, `lp_tutor_select` (с `tutor_id`, `origin`), `lp_submit`, `lp_success` (с `booking_id`) и `landing_lead_success`; во всех — `utm_source: "avito"`, `utm_content: "TEST1"`; ни в одном нет имени и телефона; Q15 — `/5-9/?v=b` показывает `hero.b.title` с первого кадра (скриншот до `DOMContentLoaded` не содержит текста варианта a), без параметра — сохранённый вариант из cookie; тело запроса `/api/lead` содержит `variant` и `attribution`

### Implementation for User Story 4

- [X] T062 [P] [US4] Добавить в `landings/src/content/segments/{1-4,5-9,10-11}.json` вариант `b` для `hero` (альтернативный заголовок и подзаголовок в тоне сегмента, без стоп-слов) и `quizVariant.b` (альтернативные заголовки шагов); в `landings/src/css/base.css` — `html[data-variant="a"] [data-variant-only="b"], html[data-variant="b"] [data-variant-only="a"] { display: none }`
- [X] T063 [US4] Подключить события в модулях по contracts/analytics-events.md:
  - `landings/src/js/analytics.mjs`: `lp_view` на `DOMContentLoaded`; `lp_scroll_50` один раз при прокрутке ≥ 50% высоты документа (пассивный слушатель с `requestAnimationFrame`);
  - `landings/src/js/main.mjs`: `lp_form_start` один раз при первом клике по любому `[data-cta]` (с `source` = значение `data-cta`: `hero` | `sticky` | `tutor_card` | `offer` | `final`) или первом взаимодействии с формой (`source: "form"`);
  - `landings/src/js/quiz.mjs`: `lp_step_1`…`lp_step_3` при каждом показе шага (`lp_step_2` с `subject`, `grade`), `lp_tutor_select` (`tutor_id`, `origin`: `form` | `tutors_block`), `lp_submit` при каждой валидной попытке, `lp_success` один раз на `bookingId` + `landing_lead_success` для совместимости с BASE;
  - кнопки «Хочу к этому репетитору» в `blocks/tutors.mjs` получают `data-cta="tutor_card"`
- [X] T064 [US4] Передача атрибуции и варианта с заявкой в `landings/src/js/quiz.mjs`: в теле `/api/lead` — `variant` из `document.documentElement.dataset.variant` и `attribution` из `visitorState.firstTouch` (только 5 `utm_*`); проверить, что `info` в `server.mjs` (T034) выводит `Вариант`, `Источник`, `Объявление` из этих полей
- [X] T065 [US4] Подключение Яндекс Метрики в `landings/src/templates/page.mjs`: если `site.ymCounterId` не `null` — стандартный асинхронный сниппет Метрики с этим ID (`clickmap`, `trackLinks`, `accurateTrackBounce`, без `webvisor` до согласования ПДн), `<noscript>`-пиксель; если `null` — сниппет не выводится; в `visitor-state.mjs` использовать `ym(id, 'getClientID', cb)` как `visitorId` для хэш-фолбэка, когда хранилища недоступны

**Checkpoint**: Воронка видна в `dataLayer`/Метрике, вариант и метки доходят до CRM; `npx playwright test analytics` зелёный

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Скорость, доступность, документация, приёмка

- [ ] T066 [P] Производительность: Lighthouse mobile (Slow 4G) для `/1-4/`, `/5-9/`, `/10-11/` — LCP ≤ 2,5 с (SC-004); CSS ≤ 40 КБ и JS ≤ 30 КБ gzip на страницу (проверка скриптом `landings/tools/size-check.mjs`, вызываемым после сборки в `npm run build`); при превышении — инлайнить критический CSS первого экрана в `page.mjs` с хэшем в CSP (T069)
- [ ] T067 [P] Доступность: прогнать `@axe-core/playwright` (dev-зависимость) на трёх страницах в обеих темах — критерий приёмки: 0 нарушений уровней serious и critical; дополнительно проверить вручную: у всех полей есть `<label>`, ошибки связаны через `aria-describedby`, порядок фокуса в квизе, `aria-pressed` у чипов, `aria-live` для холда и статуса, контраст ≥ 4.5:1 в обеих темах; исправления — в `landings/src/templates/blocks/*.mjs` и `landings/src/css/*.css`
- [X] T068 [P] Документация `landings/README.md` (структура, сборка, контент сегментов, как сменить формулировку мест на «мест в этом наборе» только правкой `segments/*.json`, параметры `offer.json`) и `landings/SERVER_SETUP.md` (по образцу `BASE/SERVER_SETUP.md`: `PUBLIC_ORIGIN`, `TRUST_PROXY`, `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_FORMAT`, `NODE_ENV=production`, Nginx-блок, раздача `/1-4/`, `/5-9/`, `/10-11/`, cookie `Secure` за HTTPS)
- [X] T069 Безопасность `landings/server.mjs`: убедиться, что `src/`, `tools/`, `tests/`, `*.json` контента, `server.mjs` и `package.json` не отдаются по HTTP (белый список T015); `Content-Security-Policy` для страниц: `default-src 'self'; script-src 'self' 'sha256-<inline head script>' 'sha256-<сниппет Метрики, если включён>' https://mc.yandex.ru; img-src 'self' data: https://mc.yandex.ru; connect-src 'self' https://mc.yandex.ru; style-src 'self' 'sha256-<критический CSS, если инлайнится>'; font-src 'self'` (хэши всех встроенных `<script>` и `<style>` вычисляются в `build.mjs` и пишутся в `dist/manifest.json`; атрибуты `style=` запрещены — T017); серверный тест на отдачу `404` для `/server.mjs`, `/src/content/offer.json`
- [ ] T070 Прогнать `npm run build:strict` (все блоки сегментов заполнены, промокод задан), полный `npm test` и `npm run test:e2e` (Chromium и WebKit × 5 ширин) в `landings/`; исправить падения
- [ ] T071 Ручная проверка по `specs/001-segment-landings-quiz/quickstart.md` сценариев Q16 (клавиатура на реальном iPhone), Q18 (Lighthouse), Q20 (встроенные браузеры Avito, Wildberries, Ozon на Android и iOS); результаты записать в `landings/README.md` → раздел «Проверка» с датой и устройствами
- [ ] T072 Чек-лист запуска в `landings/README.md` → «Перед запуском»: зависимости D1–D6 из `specs/001-segment-landings-quiz/research.md` (репетиторы по русскому и согласия, реальный `promoCode`, `ymCounterId`, подтверждение суммы 1 500 ₽, допустимость внешних ссылок на площадках); по одной помеченной тестовой заявке на сегмент в реальный CRM (`name` = `ТЕСТ лендинг <seg>`) с проверкой 6 полей и читаемости `info`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: после Setup — БЛОКИРУЕТ все истории
- **US1 (Phase 3)**: после Foundational
- **US2 (Phase 4)**: после Foundational; использует блок tutors (T037) и форму (T033) из US1 для полного каркаса, но проверяется отдельно (layout-тесты не требуют отправки формы)
- **US3 (Phase 5)**: после Foundational; T058 дополняет `quiz.mjs` из US1, T059 — `floating.mjs` из US2
- **US4 (Phase 6)**: после Foundational; события навешиваются на модули US1–US3, поэтому полный Q14 проверяется после них
- **Polish (Phase 7)**: после всех нужных историй

### User Story Dependencies

```text
Setup ─▶ Foundational ─┬─▶ US1 (P1, MVP) ─┬─▶ US3 (P2) ─┐
                       │                  │             ├─▶ US4 (P3) ─▶ Polish
                       └─▶ US2 (P1) ──────┴─────────────┘
```

- **US1**: ни от кого не зависит — MVP на `/5-9/`
- **US2**: независима по коду блоков; для финальной сборки страниц нужны T033 и T037
- **US3**: независимые модули (T053–T057); точки интеграции T058 (US1) и T059 (US2)
- **US4**: независимое ядро (T060, T062, T065); подключение событий T063–T064 — к модулям US1–US3

### Within Each User Story

- Тесты пишутся первыми и должны падать до реализации
- Чистые модули `lib/*` → шаблоны блоков → DOM-контроллеры → серверная часть → подключение в `page.mjs`/`main.mjs`
- История завершается до перехода к следующему приоритету (при работе одного исполнителя)

### Parallel Opportunities

- Setup: T003–T008 параллельно после T001–T002
- Foundational: T010–T014 и T019–T021 параллельно; T015 → T016 последовательно (один файл); T017 → T018 → T022
- US1: тесты T024–T028 параллельно; модули T029–T032 параллельно; затем T033 → T035, T034 (сервер) параллельно с T036–T037
- US2: T041–T043 и T045–T046 параллельно; T047–T049 после блоков
- US3: T051–T055 параллельно; T056 → T057 → T058 → T059
- US4: T060–T062 параллельно; T063 → T064; T065 параллельно с T063
- US1 и US2 могут вестись двумя исполнителями одновременно после Foundational

---

## Parallel Example: User Story 1

```bash
# Тесты US1 одновременно:
Task: "Серверные тесты leadFields/info/bookingId в landings/tests/server/lead.test.mjs"
Task: "Unit-тесты слотов в landings/tests/unit/slots.test.mjs"
Task: "Unit-тесты маски телефона в landings/tests/unit/phone-mask.test.mjs"
Task: "Unit-тесты автомата квиза в landings/tests/unit/quiz-state.test.mjs"
Task: "E2E квиза в landings/tests/e2e/quiz.spec.mjs"

# Чистые модули US1 одновременно:
Task: "slots.mjs в landings/src/js/lib/slots.mjs"
Task: "phone-mask.mjs в landings/src/js/lib/phone-mask.mjs"
Task: "calendar.mjs в landings/src/js/lib/calendar.mjs"
Task: "quiz-state.mjs в landings/src/js/quiz-state.mjs"
```

## Parallel Example: User Story 2

```bash
Task: "header/footer в landings/src/templates/blocks/header.mjs, footer.mjs"
Task: "hero в landings/src/templates/blocks/hero.mjs"
Task: "pains/trial/reviews/faq/final/oge/parents в landings/src/templates/blocks/"
Task: "Контент 1–4 в landings/src/content/segments/1-4.json"
Task: "Контент 10–11 в landings/src/content/segments/10-11.json"
```

## Parallel Example: User Story 3

```bash
Task: "timer.test.mjs в landings/tests/unit/timer.test.mjs"
Task: "scarcity.spec.mjs в landings/tests/e2e/scarcity.spec.mjs"
Task: "timer.mjs в landings/src/js/lib/timer.mjs"
Task: "topbar в landings/src/templates/blocks/topbar.mjs"
Task: "offer-стек в landings/src/templates/blocks/offer.mjs"
```

## Parallel Example: User Story 4

```bash
Task: "analytics.test.mjs в landings/tests/unit/analytics.test.mjs"
Task: "analytics.spec.mjs в landings/tests/e2e/analytics.spec.mjs"
Task: "Варианты b в landings/src/content/segments/*.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (блокирует всё)
3. Phase 3: US1 — квиз на `/5-9/`
4. **STOP and VALIDATE**: quickstart Q6–Q13 + одна тестовая заявка в тестовый приёмник
5. Демонстрация заказчику: форма уже собирает брони с полным набором полей

### Incremental Delivery

1. Setup + Foundational → каркас и сервер
2. US1 → бронь работает (MVP)
3. US2 → три полноценных лендинга с адаптивом — **минимум для запуска трафика**
4. US3 → лимитированность оффера (основной рычаг конверсии после формы)
5. US4 → воронка и A/B для доведения конверсии до 10%
6. Polish → скорость, доступность, документация, приёмка ТЗ

### Parallel Team Strategy

1. Вместе: Setup + Foundational
2. Затем: исполнитель A — US1 (форма и сервер); исполнитель B — US2 (блоки, контент, адаптив)
3. После US1: исполнитель A — US3; исполнитель B — US4
4. Вместе — Polish и приёмка

---

## Notes

- [P] — разные файлы, нет зависимостей от незавершённых задач
- [Story] связывает задачу с историей для трассировки к spec.md
- `Design System/` и BASE только читаются — ни одна задача их не меняет
- Тексты сегментов не обещают результат — сборка проверяет стоп-слова (T017)
- Персональные данные не попадают в логи сервера и в события аналитики
- Коммит после каждой задачи или логической группы

---

## Phase 8: Convergence

- [X] T073 Добавить полям квиза состояние «загрузка» per FR-021 (partial): во время отправки (`status === 'submitting'`) помечать поля шага 3 в `landings/src/js/quiz.mjs` классом `.is-loading` и оформить его в `landings/src/css/components.css` на токенах (недоступность ввода + индикатор ожидания); сейчас у `.field` есть только состояния по умолчанию, `.is-focus`, `.is-error`, `.is-valid`, а ожидание показано лишь на уровне формы (`.quiz[aria-busy="true"] .quiz-submit{cursor:wait}`)
- [X] T074 Покрыть истечение холда в браузере per FR-018 (partial): добавить в `landings/tests/e2e/quiz.spec.mjs` сценарий Q9 из `specs/001-segment-landings-quiz/quickstart.md` — выбрать слот, довести холд до нуля (например, подменив `Date.now` или `schedule.holdMinutes` через `page.addInitScript`), проверить сообщение «Место освобождено», снятый слот и сохранённые контакты; сейчас проверен только редьюсер `holdExpired` в `landings/tests/unit/quiz-state.test.mjs`, а Q9 не входит и в ручной список T071
- [X] T075 Решить судьбу dev-скриптов `landings/tools/overflow.mjs` и `landings/tools/shoot.mjs` per plan: project structure (unrequested): в plan.md в `tools/` названы только `convert-fonts.py`, `convert-images.py` и `size-check.mjs`, ни одна задача эти два файла не создаёт — либо описать их в `landings/README.md` как вспомогательные инструменты разработки (вместе с T068), либо удалить

---

## Phase 9: Правки после показа превью

- [X] T076 [US3] Дополнительная ступень оффер-стека для одного сегмента per FR-036: поле `offerExtra` (`title`, `text`, `badge`) в `landings/src/content/segments/1-4.json`, рендер в `landings/src/templates/blocks/offer.mjs` только при заполненном поле, стили `.ladder-step.is-extra` и `.sticker.is-extra`
- [X] T077 [US1] Выбор нескольких предметов per FR-016, FR-037: список предметов сегмента в `segments/*.json` (`subjects`) и подписи в `site.json` (`subjects`); `tutorIds` по физике, химии и высшей математике; в `quiz-state.mjs` — `state.subjects` с основным первым, `primarySubject`, тоггл с минимумом один и максимумом пять; в `quiz.mjs` — мультивыбор чипов и подсказка «можно выбрать несколько»; в `server.mjs` — массив `subjects`, основной предмет в поле `subject` вебхука, остальные в `info` («Ещё предметы»); контракты `lead-api.md` и `crm-webhook.md` обновлены
- [X] T078 [US2] Строка площадки на первом экране per FR-035: `sourceNotes` в `site.json`, слот `[data-source-note]` в `blocks/hero.mjs`, заполнение из метки первого входа в `main.mjs` (с алиасами `wildberries` → `wb`), стиль `.hero-source`; без известной метки строка не показывается
- [X] T079 [US3] Читаемость бейджа скидки per FR-027: `.sticker.is-discount` — белая подложка, акцентная рамка и текст, 17 px (в герое 16 px вместо 12 px), тень; убрано сочетание «акцент на акценте» с кнопкой брони; состояние «сгорела» перекрывает рамку и цвет
- [X] T080 [US1] Выбор любого класса 1–11 per FR-038: список `grades` в `site.json`, классы сегмента показаны сразу, остальные за кнопкой «Другой класс» (`[data-grades-toggle]`); класс вне сегмента принимается сервером и помечается в `info` как `(вне сегмента)`, на шаге 2 показывается пояснение `[data-grade-note]`

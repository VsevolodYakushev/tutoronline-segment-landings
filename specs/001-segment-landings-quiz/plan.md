# Implementation Plan: Три сегментных лендинга с квиз-формой брони пробного урока

**Branch**: `001-segment-landings-quiz` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-segment-landings-quiz/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Три лендинга TutorOnline (`/1-4/`, `/5-9/`, `/10-11/`) для холодного трафика Avito, Wildberries и Ozon. Цель — около 10% визитов превращать в бронь бесплатного пробного урока.

Технический подход — развить работающий базовый лендинг `Design System/tutoronline-adaptive`, а не начинать заново:
- **Страницы.** Статический HTML без фреймворка собирается скриптом `build.mjs` на встроенных модулях Node из одного шаблона на 10 блоков и JSON-контента сегментов.
- **Дизайн.** Токены и компоненты дизайн-системы переносятся из базового `styles.css`.
- **Форма.** Трёхшаговая квиз-форма — конечный автомат на чистом JS: холд слота, чекбокс-обязательство, экран-«билет».
- **Лимитированность.** Число мест (3–10), дедлайн 15-минутного таймера и A/B-вариант хранятся в одной записи посетителя: серверная cookie на 30 дней плюс зеркало в `localStorage` плюс хэш-фолбэк.
- **Заявка.** Расширенный `server.mjs` раскладывает бронь в 6 полей проверенного вебхука `SaveRegistrationRequest`; дополнительные поля идут в структурированный `info`.
- **Аналитика.** 10 событий воронки уходят в `dataLayer` и Яндекс Метрику.

## Technical Context

**Language/Version**: HTML5, CSS3 (custom properties, container-agnostic media queries), JavaScript ES2020 modules в браузере; Node.js 22+ для сервера и сборки (локально проверено на 24.15)

**Primary Dependencies**: Runtime — нет (встроенные `node:http`, `node:crypto`, `node:fs`). Dev — `@playwright/test` для E2E. Однократная подготовка ассетов — `fonttools` (TTF → WOFF2) и конвертер изображений (WebP/AVIF), результаты коммитятся

**Storage**: Постоянной БД нет. Состояние посетителя — cookie `tst_v1_<seg>` (30 дней) и `localStorage`; черновик квиза — `sessionStorage`; идемпотентность заявок — память процесса сервера (10 мин), как в базовом лендинге

**Testing**: `node --test` (unit и сервер с подменой `upstreamFetch`), `@playwright/test` (Chromium и WebKit × 360/390/768/1024/1440), ручная проверка во встроенных браузерах Avito, WB и Ozon по [quickstart.md](quickstart.md)

**Target Platform**: Мобильные браузеры (Safari iOS 15+, Chrome Android, WebView приложений Avito, Wildberries, Ozon), десктопные Chrome, Safari, Firefox, Edge; сервер — Linux, Node 22+ за Nginx с HTTPS

**Project Type**: Статический веб-сайт (3 страницы) с лёгким Node-обработчиком заявок

**Performance Goals**: LCP ≤ 2,5 с на мобильном 4G (SC-004); CSS ≤ 40 КБ и JS ≤ 30 КБ (gzip) на страницу; шрифты WOFF2 (2 начертания); переход между шагами квиза 200–300 мс без просадки FPS

**Constraints**:
- mobile-first, эталон 360×640;
- зоны нажатия ≥ 44 px, текст в полях ≥ 16 px;
- верхняя плашка ≤ 48 px;
- без обещаний результата в текстах;
- персональные данные не логируются;
- секреты только на сервере;
- контент виден без JS;
- `prefers-reduced-motion` уважается

**Scale/Scope**: 3 страницы × 10 блоков, около 8 репетиторов, 1 endpoint. Ожидаемый трафик — тысячи визитов в сутки (A/B требует ≥ 1000 визитов на вариант); один процесс Node справляется

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` — незаполненный шаблон, ратифицированных принципов нет, поэтому формальных нарушений быть не может. Чтобы гейт не был пустым, применены **временные гейты** из ТЗ и README базового лендинга. Рекомендуется закрепить их через `/speckit-constitution`.

| # | Временный гейт (источник) | До Phase 0 | После Phase 1 | Где обеспечено |
|---|---------------------------|------------|---------------|----------------|
| G1 | Новые лендинги строятся на базе конвертирующего лендинга и дизайн-системы (ТЗ §1) | ✅ | ✅ | R1, R3; структура `landings/` наследует `server.mjs` и токены |
| G2 | Только реальные репетиторы и отзывы; без обещаний результата (ТЗ §4, §8) | ✅ | ✅ | data-model §1–2: `placeholder` вместо вымышленных людей; стоп-слова на сборке (Q21) |
| G3 | Секреты и адрес CRM только на сервере; ПДн не логируются (README базового) | ✅ | ✅ | [lead-api.md](contracts/lead-api.md) «Приватность»; промокод подставляет сервер |
| G4 | Контент доступен без JS, `prefers-reduced-motion` (README базового) | ✅ | ✅ | R1 (HTML на сборке), R8, R13; Q19 |
| G5 | Mobile-first 360×640, LCP ≤ 2,5 с (ТЗ §7) | ✅ | ✅ | R4, Performance Goals; Q17, Q18 |
| G6 | Не создавать дубли заявок, «билет» только после подтверждения CRM (README базового) | ✅ | ✅ | Идемпотентность в [lead-api.md](contracts/lead-api.md); Q12 |
| G7 | Минимум зависимостей (базовый: «React и npm не нужны») | ✅ | ⚠️ обосновано | Одна dev-зависимость `@playwright/test` — см. Complexity Tracking |

**Итог**: гейт пройден, ERROR нет. Юридический риск случайного счётчика мест (ФЗ «О рекламе», ст. 5) принят заказчиком и записан в Clarifications спецификации.

## Project Structure

### Documentation (this feature)

```text
specs/001-segment-landings-quiz/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── lead-api.md
│   ├── crm-webhook.md
│   ├── analytics-events.md
│   └── page-urls.md
├── checklists/
│   └── requirements.md  # /speckit-specify output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
Design System/                      # ИСТОЧНИК, не изменяется
├── icons/*.svg                     # → landings/assets/icons/ (используемые)
├── logo_*.svg                      # → landings/assets/
└── tutoronline-adaptive/           # базовый лендинг: токены, компоненты, фото, server.mjs

landings/                           # НОВЫЙ деплоируемый сайт
├── package.json                    # scripts: build, build:strict, start, test, test:e2e; engines node>=22
├── playwright.config.mjs           # Chromium + WebKit × 360/390/768/1024/1440
├── tools/                          # convert-fonts.py, convert-images.py (однократно), size-check.mjs
├── build.mjs                       # шаблоны + контент → dist/<seg>/index.html, хэши ассетов
├── server.mjs                      # из базового: + страницы сегментов, cookie посетителя, новые поля /api/lead, bookingId
├── src/
│   ├── content/
│   │   ├── segments/1-4.json
│   │   ├── segments/5-9.json
│   │   ├── segments/10-11.json
│   │   ├── tutors.json
│   │   ├── schedule.json
│   │   ├── offer.json              # trialPrice 1500, discount 1500, lessonPrice null (D5), timerMinutes 15, seats 3–10, promoCode
│   │   ├── site.json               # телефон, ymCounterId, юр. ссылки, рейтинги площадок
│   │   └── stopwords.json
│   ├── templates/
│   │   ├── html.mjs                # тег html`` с экранированием
│   │   ├── page.mjs                # каркас 10 блоков, inline head-скрипт варианта
│   │   └── blocks/                 # topbar, hero, pains, trial, tutors, reviews, offer, quiz, faq, final, oge, parents, footer
│   ├── css/
│   │   ├── tokens.css              # :root из базового styles.css
│   │   ├── base.css                # reset, типографика, контейнер ≤ 1200
│   │   ├── components.css          # кнопки, карточки, чипы, слоты, стикеры, плашка, билет
│   │   └── themes.css              # light / contrast (10–11)
│   └── js/
│       ├── main.mjs                # инициализация страницы
│       ├── lib/plural.mjs          # склонение «место/места/мест»
│       ├── lib/visitor-state.mjs   # cookie ↔ localStorage ↔ хэш-фолбэк, firstTouch
│       ├── lib/timer.mjs
│       ├── lib/slots.mjs           # шаблон недели → ближайшие 3 дня, МСК, отступ 3 ч
│       ├── lib/phone-mask.mjs
│       ├── lib/calendar.mjs        # .ics + ссылка Google Calendar, текстовый фолбэк
│       ├── quiz-state.mjs          # чистый автомат шагов и валидаторы (без DOM)
│       ├── quiz.mjs                # DOM-контроллер: шаги, холд, отправка, «билет»
│       ├── scarcity.mjs            # места, таймер, состояние «сгорела»
│       ├── floating.mjs            # нижняя кнопка, клавиатура, стикеры
│       └── analytics.mjs           # dataLayer + Метрика, scroll 50%
├── assets/                         # WOFF2, WebP/AVIF фото, иконки, логотипы
├── dist/                           # артефакт сборки (в .gitignore)
└── tests/
    ├── unit/*.test.mjs             # node --test
    ├── server/*.test.mjs           # leadFields, info, bookingId, isConfirmed, cookie
    └── e2e/*.spec.mjs              # Playwright: сценарии quickstart Q1–Q17
```

**Structure Decision**: Отдельная папка `landings/` в корне репозитория — самостоятельный деплоируемый сайт, как базовый лендинг (одна папка: страницы и `server.mjs`). `Design System/` остаётся неизменным источником; нужные ассеты копируются и оптимизируются в `landings/assets/`. Чистая логика вынесена в `src/js/lib/*.mjs`, чтобы тестироваться в Node и работать в браузере без сборки JS.

## Phase Outputs

| Фаза | Артефакт | Статус |
|------|----------|--------|
| 0 | [research.md](research.md) — 15 решений, 0 NEEDS CLARIFICATION, 6 зависимостей от заказчика | ✅ |
| 1 | [data-model.md](data-model.md) — 8 сущностей, переходы слота и квиза | ✅ |
| 1 | [contracts/](contracts/) — API заявки, раскладка в CRM, события аналитики, адреса и параметры URL | ✅ |
| 1 | [quickstart.md](quickstart.md) — 21 сценарий проверки, привязанный к FR/SC | ✅ |
| 2 | `tasks.md` | ⏭ `/speckit-tasks` |

## Риски и меры

| Риск | Мера |
|------|------|
| 10% на холодном трафике — высокая планка (ТЗ §8) | Промежуточная цель — не хуже базового лендинга; A/B первого экрана и формы с первого дня (R12) |
| Случайный счётчик мест и модерация площадок | Риск принят заказчиком; число задаётся одним параметром `offer.json`, текст — в `segments/*.json`, переключение на «мест в этом наборе» не требует кода |
| Перечёркнутая сумма 1 500 ₽ не совпадает с ценами пакетов базового лендинга (1 300–1 620 ₽) | Значение в настройках; подтверждение заказчика — D5 |
| Нет репетиторов по русскому языку | Карточка-`placeholder` без вымышленного человека (D1) |
| Встроенные браузеры чистят хранилища | Серверная cookie + хэш-фолбэк (R5); проверка Q5, Q20 |
| Формат ответа CRM не подтверждён реальной заявкой (README базового) | Тестовая заявка на каждый сегмент до запуска ([crm-webhook.md](contracts/crm-webhook.md)) |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dev-зависимость `@playwright/test` (временный гейт G7) | Регрессионная проверка критериев приёмки ТЗ: устойчивость мест и таймера к перезагрузке, 3 шага формы, адаптив на 5 ширинах в Chromium и WebKit | Только ручная проверка не повторяема и не покрывает WebKit (ближайший к Safari iOS) на каждой правке; на рантайм и деплой зависимость не влияет |
| Сборочный скрипт `build.mjs` (у базового лендинга сборки нет) | Три страницы из одного каркаса без тройного дублирования разметки; HTML готов до загрузки JS (LCP, без-JS) | Три ручные копии расходятся при правках; рендер в браузере ухудшает LCP и ломает показ без JS |

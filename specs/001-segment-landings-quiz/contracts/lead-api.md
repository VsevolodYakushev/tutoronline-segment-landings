# Contract: `POST /api/lead` — бронь пробного урока

**Владелец**: `landings/server.mjs` (расширение `server.mjs` базового лендинга)
**Потребитель**: `landings/src/js/quiz.mjs`
**Связано**: [data-model.md §7](../data-model.md), [crm-webhook.md](crm-webhook.md)

## Request

```http
POST /api/lead HTTP/1.1
Content-Type: application/json
Idempotency-Key: <uuid или 10–100 символов [a-zA-Z0-9-]>
Origin: https://<PUBLIC_ORIGIN>
```

```json
{
  "segment": "5-9",
  "variant": "a",
  "grade": 7,
  "subjects": ["math", "physics"],
  "tutor": { "id": "roman-yurievich", "name": "Роман Юрьевич" },
  "slot": "2026-11-12T18:00:00+03:00",
  "name": "Мария",
  "phone": "+7 (912) 345-67-89",
  "email": "maria@example.com",
  "discountRequested": true,
  "commitment": true,
  "consent_pd": true,
  "consent_ads": false,
  "landing": "https://example.ru/5-9/",
  "attribution": {
    "utm_source": "avito",
    "utm_medium": "cpc",
    "utm_campaign": "trial-5-9",
    "utm_content": "4128837712",
    "utm_term": ""
  }
}
```

| Поле | Обязательно | Валидация на сервере | Ошибка |
|------|-------------|----------------------|--------|
| `segment` | да | ∈ {`1-4`,`5-9`,`10-11`} | `invalid_form` |
| `variant` | да | ∈ {`a`,`b`} | `invalid_form` |
| `grade` | да | Целое 1–11 из `site.grades`; вне диапазона сегмента допускается (FR-038) | `invalid_form` |
| `subjects` | да | Непустой массив ключей из `site.subjects`, без повторов, ≤ 5; первый — основной (FR-037) | `invalid_form` |
| `tutor.id` | да | Есть в `tutors.json` и ведёт основной предмет (или `placeholder` для него) | `invalid_form` |
| `tutor.name` | да | Сервер перезаписывает именем из `tutors.json` | — |
| `slot` | да | ISO 8601; от now + 0 ч до now + 7 сут | `invalid_slot` |
| `name` | да | 2–150 символов после trim | `invalid_form` |
| `phone` | да | 10–15 цифр, символы `+\d()\s.-` | `invalid_phone` |
| `email` | нет | Пусто или `x@y.z`, ≤ 254 | `invalid_email` |
| `discountRequested` | нет | bool; клиент шлёт `true`, только если таймер скидки не истёк; сервер оставляет `true`, только если ещё и email непустой и валиден | — |
| `commitment` | да | `=== true` | `commitment_required` |
| `consent_pd` | да | `=== true` | `consent_required` |
| `consent_ads` | нет | bool | — |
| `landing` | да | http(s), без учётных данных; query и hash отбрасываются | `invalid_landing` |
| `attribution.*` | нет | Только 5 стандартных `utm_*`, ≤ 300 символов | — |

Ограничения транспорта сохраняются из базового сервера:
- тело ≤ 16 КБ (`413 payload_too_large`);
- `Content-Type: application/json` (`415 json_required`);
- проверка `Origin` по `PUBLIC_ORIGIN` (`403 origin_rejected`);
- ≤ 30 запросов в минуту с IP (`429 too_many_requests`);
- `Idempotency-Key` обязателен (`400 submission_key_required`).

## Responses

| HTTP | Тело | Значение для клиента |
|------|------|----------------------|
| 200 | `{ "success": true, "bookingId": "TO-7KQ2MD", "promoCode": "<PROMO>" }` | Показать «билет» с `bookingId` и `promoCode`, отправить `lp_success`, `booked += 1` |
| 400 | `{ "success": false, "code": "<код из таблицы>" }` | Подсветить поле, данные не сбрасывать |
| 409 | `{ "success": false, "code": "submission_changed" }` | Данные изменились при том же ключе — клиент создаёт новый ключ и повторяет |
| 502 | `{ "success": false, "code": "upstream_unconfirmed" \| "upstream_timeout" }` | Сообщение «Не удалось подтвердить приём заявки…» + телефон; «билет» не показывать; повтор с тем же ключом не создаёт дубль |
| 429 / 413 / 415 / 403 / 503 | `{ "success": false, "code": … }` | Общее сообщение об ошибке + телефон |

## Идемпотентность

- Один и тот же `Idempotency-Key` с тем же содержимым в течение 10 минут возвращает закешированный ответ (включая тот же `bookingId`) без повторного вызова вебхука.
- Клиент создаёт новый ключ только если изменились данные брони (сравнение сигнатуры полезной нагрузки, как в базовом `app.js`).

## Номер брони

`bookingId = "TO-" + base32(sha256(Idempotency-Key))[0..6]`, алфавит без `0/O/1/I`. Детерминирован для ключа, поэтому одинаков в «билете», в CRM и при повторе.

## Приватность

- Персональные данные не логируются (как в базовом сервере).
- Ответ не содержит данных, кроме `success`, `code`, `bookingId` и (только при успехе) `promoCode`.
- Промокод не секретен: по ТЗ §3 он виден в форме до отправки (приходит в `#lp-config`). В CRM сервер всё равно подставляет код из `offer.json` и игнорирует значение от клиента.

// Russian plural forms: [one, few, many] → 1 место, 2 места, 5 мест.
export function plural(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last > 1 && last < 5) return forms[1];
  return forms[2];
}

export const SEAT_FORMS = ['место', 'места', 'мест'];
export const DEFAULT_SEATS_TEMPLATE = 'Осталось {n} {seats} на этой неделе';

// The phrase itself lives in segment content (topbar.seatsTemplate), not in code.
export function seatsPhrase(n, template = DEFAULT_SEATS_TEMPLATE) {
  return String(template || DEFAULT_SEATS_TEMPLATE).replaceAll('{n}', String(n)).replaceAll('{seats}', plural(n, SEAT_FORMS));
}

// Conditional slots from a weekly template (research R7), always in Moscow time (UTC+3, no DST),
// independent of the device time zone: only UTC getters on shifted timestamps are used.
const MSK_OFFSET_MS = 3 * 3600000;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const pad = value => String(value).padStart(2, '0');

function wall(ms) {
  const date = new Date(ms + MSK_OFFSET_MS);
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), weekday: date.getUTCDay(),
    hours: date.getUTCHours(), minutes: date.getUTCMinutes(),
  };
}

export function isoMsk(ms) {
  const w = wall(ms);
  return `${w.year}-${pad(w.month + 1)}-${pad(w.day)}T${pad(w.hours)}:${pad(w.minutes)}:00+03:00`;
}

export function slotLabels(ms) {
  const w = wall(ms);
  const time = `${pad(w.hours)}:${pad(w.minutes)}`;
  const day = `${WEEKDAYS[w.weekday]}, ${w.day} ${MONTHS[w.month]}`;
  return { time, day, label: `${day}, ${time} МСК`, short: `${WEEKDAYS[w.weekday]}, ${time}` };
}

export function buildSlots({ weekly, tutorId, now, leadHours = 3, daysToShow = 3, maxDaysAhead = 7 }) {
  const template = weekly[tutorId] || weekly.default || {};
  const earliest = now + leadHours * 3600000;
  const today = wall(now);
  const days = [];
  for (let offset = 0; offset <= maxDaysAhead && days.length < daysToShow; offset++) {
    const dayStartUtc = Date.UTC(today.year, today.month, today.day + offset);
    const date = new Date(dayStartUtc);
    const times = template[DAY_KEYS[date.getUTCDay()]] || [];
    const slots = times.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      return dayStartUtc + (hours * 60 + minutes) * 60000 - MSK_OFFSET_MS;
    }).filter(ms => ms >= earliest).sort((a, b) => a - b).map(ms => {
      const labels = slotLabels(ms);
      return { tutorId, startsAt: isoMsk(ms), time: labels.time, label: labels.label, short: labels.short };
    });
    if (slots.length) {
      days.push({
        date: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
        label: `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`,
        slots,
      });
    }
  }
  return days;
}

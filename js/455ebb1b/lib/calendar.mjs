// "Add to calendar": .ics download, Google Calendar fallback, text fallback for in-app browsers.
const pad = value => String(value).padStart(2, '0');

function utcStamp(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function escapeIcs(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function eventDetails({ bookingId, tutorName, startsAt, durationMin = 45, phone }) {
  const start = Date.parse(startsAt);
  const title = `Пробный урок TutorOnline${tutorName ? ` — ${tutorName}` : ''}`;
  const description = `Бронь ${bookingId}. Если планы изменятся, предупредите за 3 часа${phone ? `: ${phone}` : ''}.`;
  return { start, end: start + durationMin * 60000, title, description };
}

export function icsText(options) {
  const { start, end, title, description } = eventDetails(options);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TutorOnline//Landing//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${options.bookingId}@tutoronline`, `DTSTAMP:${utcStamp(options.now ?? Date.now())}`,
    `DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`, `SUMMARY:${escapeIcs(title)}`, `DESCRIPTION:${escapeIcs(description)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

export function googleCalendarUrl(options) {
  const { start, end, title, description } = eventDetails(options);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${utcStamp(start)}/${utcStamp(end)}`, details: description });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function addToCalendar(options) {
  try {
    const blob = new Blob([icsText(options)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tutoronline-${options.bookingId}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'ics';
  } catch { /* in-app browsers may block downloads */ }
  try {
    const opened = window.open(googleCalendarUrl(options), '_blank', 'noopener');
    if (opened) return 'google';
  } catch { /* ignore */ }
  return false;
}

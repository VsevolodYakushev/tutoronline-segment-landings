// Minimal, dependency-free HTML templating: every interpolation is escaped
// unless it is marked safe with raw() or produced by another html`` call.

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ESCAPES[char]);
}

export function raw(value) {
  return new SafeHtml(value == null ? '' : String(value));
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let index = 0; index < values.length; index++) out += render(values[index]) + strings[index + 1];
  return new SafeHtml(out);
}

export function isSafe(value) {
  return value instanceof SafeHtml;
}

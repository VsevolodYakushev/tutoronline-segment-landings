// Visitor state per segment (data-model §5): seats 3–10, offer deadline, A/B variant, bookings, first-touch UTM.
// Resolution: cookie → localStorage → client generation → hash fallback (both storages unavailable).
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const DAY_MS = 86400000;

export function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (const char of String(input)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function hashSeats(visitorId, segmentId, min = 3, max = 10) {
  return min + (fnv1a(String(visitorId) + segmentId) % (max - min + 1));
}

export function storageKey(segmentId, version = 'v1') {
  return `tst_${version}_${segmentId}`;
}

export function parseCookieValue(value) {
  const match = /^(\d{1,2})\.(\d{10,14})\.([ab])$/.exec(String(value || '').trim());
  if (!match) return null;
  return { seats: Number(match[1]), deadline: Number(match[2]), variant: match[3] };
}

export function serializeCookie(state) {
  return `${state.seats}.${state.deadline}.${state.variant}`;
}

export function readCookie(cookieString, name) {
  for (const part of String(cookieString || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

export function browserFingerprint(env = globalThis) {
  try {
    const nav = env.navigator || {};
    const screen = env.screen || {};
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return String(fnv1a(`${nav.userAgent || ''}|${nav.language || ''}|${screen.width || 0}x${screen.height || 0}|${zone}`));
  } catch { return 'anonymous'; }
}

function inRange(state, offer) {
  return state && Number.isInteger(state.seats) && state.seats >= offer.seatsMin && state.seats <= offer.seatsMax
    && Number.isFinite(state.deadline) && (state.variant === 'a' || state.variant === 'b');
}

function normalize(stored, offer) {
  return {
    seats: stored.seats,
    deadline: stored.deadline,
    variant: stored.variant,
    booked: Number.isInteger(stored.booked) && stored.booked > 0 ? stored.booked : 0,
    expired: stored.expired === true,
    firstTouch: stored.firstTouch && typeof stored.firstTouch === 'object' ? stored.firstTouch : null,
    createdAt: Number.isFinite(stored.createdAt) ? stored.createdAt : stored.deadline - offer.timerMinutes * 60000,
  };
}

export function generate(offer, now, rand = Math.random) {
  const span = offer.seatsMax - offer.seatsMin + 1;
  return {
    seats: offer.seatsMin + Math.min(span - 1, Math.floor(rand() * span)),
    deadline: now + offer.timerMinutes * 60000,
    variant: rand() < 0.5 ? 'a' : 'b',
    booked: 0, expired: false, firstTouch: null, createdAt: now,
  };
}

export function seatsShown(state) {
  return Math.max(1, state.seats - (state.booked || 0));
}

export function timerState(state, now) {
  if (now >= state.deadline) return 'expired';
  return state.deadline - now <= 60000 ? 'urgent' : 'running';
}

export function firstTouchFrom(searchParams, now) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
  const touch = {};
  let found = false;
  for (const key of UTM_KEYS) {
    const value = (params.get(key) || '').trim().slice(0, 300);
    if (value) { touch[key] = value; found = true; }
  }
  return found ? { ...touch, ts: now } : null;
}

/**
 * Loads (or creates) the state and keeps cookie and localStorage mirrored.
 * `storage` is a localStorage-like object, `cookies` = { get(): string, set(string) }; both may throw.
 */
export function createVisitorState({ segmentId, offer, now = Date.now(), storage, cookies, visitorId, secure = false, rand = Math.random }) {
  const key = storageKey(segmentId, offer.storageVersion);
  const ttl = (offer.ttlDays || 30) * DAY_MS;
  let fromCookie = null;
  let fromStorage = null;
  try { fromCookie = parseCookieValue(readCookie(cookies?.get(), key)); } catch { /* cookies unavailable */ }
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (inRange(parsed, offer)) fromStorage = normalize(parsed, offer);
  } catch { /* storage unavailable or corrupted */ }
  if (fromCookie && !inRange(fromCookie, offer)) fromCookie = null;
  if (fromStorage && now - fromStorage.createdAt > ttl) fromStorage = null;

  let state;
  let mode;
  if (fromCookie && fromStorage) {
    // Both exist: the older first visit wins (a re-issued cookie must not reset seats or the timer).
    state = fromStorage.deadline <= fromCookie.deadline
      ? fromStorage
      : { ...fromStorage, ...fromCookie, createdAt: fromCookie.deadline - offer.timerMinutes * 60000 };
    mode = 'cookie+storage';
  } else if (fromCookie) {
    state = normalize(fromCookie, offer);
    mode = 'cookie';
  } else if (fromStorage) {
    state = fromStorage;
    mode = 'storage';
  } else {
    state = generate(offer, now, rand);
    mode = 'generated';
  }

  function persist() {
    let wrote = false;
    try { storage.setItem(key, JSON.stringify(state)); wrote = storage.getItem(key) !== null; } catch { /* ignore */ }
    try {
      cookies.set(`${key}=${serializeCookie(state)}; Max-Age=${Math.round(ttl / 1000)}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`);
      wrote = wrote || parseCookieValue(readCookie(cookies.get(), key)) !== null;
    } catch { /* ignore */ }
    return wrote;
  }

  if (!persist() && mode === 'generated') {
    // No storage at all: derive stable values from the visitor id; the deadline lives for this tab only.
    const id = visitorId || 'anonymous';
    state.seats = hashSeats(id, segmentId, offer.seatsMin, offer.seatsMax);
    state.variant = fnv1a(`${id}|variant`) % 2 ? 'b' : 'a';
    mode = 'fallback';
  }

  return {
    get state() { return state; },
    get mode() { return mode; },
    seatsShown: () => seatsShown(state),
    timerState: at => timerState(state, at ?? Date.now()),
    captureFirstTouch(searchParams, at = Date.now()) {
      if (state.firstTouch) return state.firstTouch;
      const touch = firstTouchFrom(searchParams, at);
      if (touch) { state.firstTouch = touch; persist(); }
      return state.firstTouch;
    },
    markBooked() { state.booked += 1; persist(); return seatsShown(state); },
    markExpired() { state.expired = true; persist(); },
  };
}

export function browserVisitorState({ segmentId, offer, visitorId }) {
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  const cookies = { get: () => document.cookie, set: value => { document.cookie = value; } };
  return createVisitorState({
    segmentId, offer, storage, cookies,
    visitorId: visitorId || browserFingerprint(window),
    secure: location.protocol === 'https:',
  });
}

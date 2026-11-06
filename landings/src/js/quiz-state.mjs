// Quiz state machine (data-model §6) — pure, no DOM, unit-tested.
import { isValidPhone } from './lib/phone-mask.mjs';

// Fallback labels; the real list comes from content (site.subjects) via the page config.
export const SUBJECTS = { math: 'Математика', russian: 'Русский язык', physics: 'Физика', chemistry: 'Химия', highermath: 'Высшая математика' };
export const MAX_SUBJECTS = 5;
const NAME_RE = /^[\p{L}][\p{L}\s-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validators = {
  name(value) {
    const text = String(value || '').trim();
    if (!text) return 'Укажите имя';
    if (text.length < 2 || text.length > 150) return 'Имя — от 2 до 150 символов';
    if (!NAME_RE.test(text)) return 'Только буквы, пробел и дефис';
    return '';
  },
  phone: value => (isValidPhone(value) ? '' : 'Укажите номер полностью: +7 (XXX) XXX-XX-XX'),
  email(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length <= 254 && EMAIL_RE.test(text) ? '' : 'Проверьте адрес почты';
  },
  commitment: value => (value ? '' : 'Отметьте, что придёте на урок'),
  consentPd: value => (value ? '' : 'Нужно согласие на обработку данных'),
};

export function teaches(tutor, subject) {
  return Boolean(tutor?.subjects?.includes(subject));
}

// FR-037: the first selected subject is the primary one — tutors, the button and the lead field follow it.
export function primarySubject(state) {
  return state.subjects?.[0] || null;
}

export function subjectLabel(subject, labels = SUBJECTS) {
  return labels?.[subject] || SUBJECTS[subject] || subject || '';
}

// FR-038: the segment's own grades are shown first, any other 1–11 opens behind "другой класс".
export function isSegmentGrade(segment, grade) {
  return Boolean(segment.grades?.includes(grade));
}

export function tutorsForStep({ segment, subject, tutorsById, preferredId = null, max = 3 }) {
  const ids = segment.tutorIds?.[subject] || [];
  const ordered = preferredId && ids.includes(preferredId) ? [preferredId, ...ids.filter(id => id !== preferredId)] : ids;
  return ordered.map(id => tutorsById[id]).filter(tutor => teaches(tutor, subject)).slice(0, max);
}

export function createInitialState({ segment, params = new URLSearchParams(), tutorsById, grades = null, subjects = null }) {
  const allowedGrades = grades?.length ? grades : segment.grades;
  const allowedSubjects = subjects?.length ? subjects : (segment.subjects?.length ? segment.subjects : ['math']);
  const grade = Number(params.get('grade'));
  const asked = String(params.get('subject') || '').split(',').map(value => value.trim()).filter(value => allowedSubjects.includes(value));
  const picked = [...new Set(asked)].slice(0, MAX_SUBJECTS);
  const chosen = picked.length ? picked : [allowedSubjects[0]];
  const tutorParam = params.get('tutor');
  const tutorId = tutorParam && (segment.tutorIds?.[chosen[0]] || []).includes(tutorParam) && teaches(tutorsById[tutorParam], chosen[0]) ? tutorParam : null;
  return {
    step: 1,
    grade: allowedGrades.includes(grade) ? grade : segment.defaultGrade,
    subjects: chosen,
    allowedGrades,
    allowedSubjects,
    tutorId,
    preferredTutorId: tutorId,
    slot: null,
    holdExpiresAt: null,
    name: '', phone: '', email: '',
    commitment: false, consentPd: false, consentAds: false,
    status: 'editing', // editing | submitting | error | ticket
    errorCode: null,
    notice: null,
    bookingId: null,
    promoCode: null,
  };
}

export function stepErrors(state, step, now = Date.now()) {
  const errors = {};
  if (step === 1) {
    if (!state.grade || !state.allowedGrades?.includes(state.grade)) errors.grade = 'Выберите класс';
    if (!state.subjects?.length) errors.subject = 'Выберите хотя бы один предмет';
  } else if (step === 2) {
    if (!state.tutorId) errors.tutor = 'Выберите репетитора';
    if (!state.slot) errors.slot = state.notice === 'hold-expired' ? 'Время брони истекло — место освобождено, выберите время снова' : 'Выберите время урока';
    else if (state.holdExpiresAt && now >= state.holdExpiresAt) errors.slot = 'Время брони истекло — место освобождено, выберите время снова';
  } else if (step === 3) {
    for (const field of ['name', 'phone', 'email', 'commitment', 'consentPd']) {
      const message = validators[field](state[field]);
      if (message) errors[field] = message;
    }
  }
  return errors;
}

export function isStepValid(state, step, now) {
  return Object.keys(stepErrors(state, step, now)).length === 0;
}

// Keeps the tutor only while they still teach the primary subject.
function withSubjects(state, subjects, tutors) {
  const primary = subjects[0];
  const keepTutor = state.tutorId && tutors ? teaches(tutors[state.tutorId], primary) : false;
  return {
    ...state,
    subjects,
    tutorId: keepTutor ? state.tutorId : null,
    slot: keepTutor ? state.slot : null,
    holdExpiresAt: keepTutor ? state.holdExpiresAt : null,
  };
}

export function reduce(state, action) {
  switch (action.type) {
    case 'grade': return { ...state, grade: action.grade };
    case 'subject': {
      // Toggle: at least one subject stays selected, at most MAX_SUBJECTS.
      const current = state.subjects || [];
      const allowed = state.allowedSubjects?.length ? state.allowedSubjects : Object.keys(SUBJECTS);
      if (!allowed.includes(action.subject)) return state;
      const has = current.includes(action.subject);
      if (has && current.length === 1) return state;
      if (!has && current.length >= MAX_SUBJECTS) return state;
      const next = has ? current.filter(subject => subject !== action.subject) : [...current, action.subject];
      if (next[0] === current[0]) return { ...state, subjects: next };
      return withSubjects(state, next, action.tutors);
    }
    case 'subjects': {
      const allowed = state.allowedSubjects?.length ? state.allowedSubjects : Object.keys(SUBJECTS);
      const next = [...new Set((action.subjects || []).filter(subject => allowed.includes(subject)))].slice(0, MAX_SUBJECTS);
      if (!next.length) return state;
      return withSubjects(state, next, action.tutors);
    }
    case 'tutor':
      if (action.tutorId === state.tutorId) return state;
      return { ...state, tutorId: action.tutorId, slot: null, holdExpiresAt: null, notice: null };
    case 'slot':
      return { ...state, slot: action.slot, holdExpiresAt: action.now + action.holdMinutes * 60000, notice: null };
    case 'holdExpired':
      return { ...state, slot: null, holdExpiresAt: null, notice: 'hold-expired' };
    case 'field':
      return { ...state, [action.name]: action.value };
    case 'next':
      return state.step < 3 && isStepValid(state, state.step, action.now) ? { ...state, step: state.step + 1, notice: null } : state;
    case 'back':
      return { ...state, step: Math.max(1, state.step - 1), status: 'editing', errorCode: null };
    case 'goto':
      return { ...state, step: action.step };
    case 'submitting':
      return { ...state, status: 'submitting', errorCode: null };
    case 'failure':
      return { ...state, status: 'error', errorCode: action.code || 'network', step: 3 };
    case 'success':
      return { ...state, status: 'ticket', bookingId: action.bookingId, promoCode: action.promoCode ?? state.promoCode, holdExpiresAt: null };
    default:
      return state;
  }
}

// Quiz state machine (data-model §6) — pure, no DOM, unit-tested.
import { isValidPhone } from './lib/phone-mask.mjs';

export const SUBJECTS = { math: 'Математика', russian: 'Русский язык' };
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

export function tutorsForStep({ segment, subject, tutorsById, preferredId = null, max = 3 }) {
  const ids = segment.tutorIds?.[subject] || [];
  const ordered = preferredId && ids.includes(preferredId) ? [preferredId, ...ids.filter(id => id !== preferredId)] : ids;
  return ordered.map(id => tutorsById[id]).filter(tutor => teaches(tutor, subject)).slice(0, max);
}

export function createInitialState({ segment, params = new URLSearchParams(), tutorsById }) {
  const grade = Number(params.get('grade'));
  const subject = params.get('subject') === 'russian' ? 'russian' : 'math';
  const tutorParam = params.get('tutor');
  const tutorId = tutorParam && (segment.tutorIds?.[subject] || []).includes(tutorParam) && teaches(tutorsById[tutorParam], subject) ? tutorParam : null;
  return {
    step: 1,
    grade: segment.grades.includes(grade) ? grade : segment.defaultGrade,
    subject,
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
    if (!state.grade) errors.grade = 'Выберите класс';
    if (!SUBJECTS[state.subject]) errors.subject = 'Выберите предмет';
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

export function reduce(state, action) {
  switch (action.type) {
    case 'grade': return { ...state, grade: action.grade };
    case 'subject': {
      if (action.subject === state.subject) return state;
      const keepTutor = state.tutorId && action.tutors ? teaches(action.tutors[state.tutorId], action.subject) : false;
      return { ...state, subject: action.subject, tutorId: keepTutor ? state.tutorId : null, slot: keepTutor ? state.slot : null, holdExpiresAt: keepTutor ? state.holdExpiresAt : null };
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

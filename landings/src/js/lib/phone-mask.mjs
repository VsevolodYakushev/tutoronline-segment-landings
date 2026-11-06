// Russian phone mask +7 (XXX) XXX-XX-XX (research R9). Pure helpers + DOM binding.

function split(raw) {
  const text = String(raw || '').trim();
  let digits = text.replace(/\D/g, '');
  let country = false;
  // "+7" may sit anywhere if the caret was not at the end while typing ("9+7 (" → 9).
  if (text.includes('+7')) { digits = text.replace('+7', '').replace(/\D/g, ''); country = true; }
  else if (digits.length >= 11 && (digits[0] === '7' || digits[0] === '8')) { digits = digits.slice(1); country = true; }
  else if (digits === '7' || digits === '8') { digits = ''; country = true; }
  return { digits: digits.slice(0, 10), country };
}

export function phoneDigits(value) {
  return split(value).digits;
}

export function formatDigits(digits) {
  let out = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) out += `) ${digits.slice(3, 6)}`;
  if (digits.length >= 6) out += `-${digits.slice(6, 8)}`;
  if (digits.length >= 8) out += `-${digits.slice(8, 10)}`;
  return out;
}

export function maskPhone(raw) {
  const { digits, country } = split(raw);
  if (!digits && !country) return '';
  return formatDigits(digits);
}

export function isValidPhone(value) {
  return phoneDigits(value).length === 10;
}

export function attachPhoneMask(input) {
  input.setAttribute('inputmode', 'tel');
  input.setAttribute('autocomplete', 'tel');
  let previous = phoneDigits(input.value);
  input.addEventListener('input', event => {
    let digits = phoneDigits(input.value);
    // Deleting a separator ("(", ")", "-", " ") must delete the digit before it, otherwise the mask restores it.
    if (event.inputType === 'deleteContentBackward' && digits === previous && digits.length) digits = digits.slice(0, -1);
    input.value = digits ? formatDigits(digits) : (input.value.trim() ? '+7 (' : '');
    if (input.value === '+7 (' && event.inputType?.startsWith('delete')) input.value = '';
    previous = digits;
    input.setSelectionRange?.(input.value.length, input.value.length);
  });
  const caretToEnd = () => input.setSelectionRange?.(input.value.length, input.value.length);
  input.addEventListener('focus', () => {
    if (!input.value) input.value = '+7 (';
    caretToEnd();
    requestAnimationFrame?.(caretToEnd); // some browsers place the caret after the focus handler
  });
  input.addEventListener('blur', () => { if (input.value === '+7 (') input.value = ''; });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { maskPhone, phoneDigits, isValidPhone } from '../../src/js/lib/phone-mask.mjs';

test('typing ten digits produces the +7 mask', () => {
  assert.equal(maskPhone('9123456789'), '+7 (912) 345-67-89');
});

test('pasted numbers in common formats are normalized', () => {
  for (const raw of ['89123456789', '79123456789', '+7 912 345 67 89', '+7 (912) 345-67-89', '8 (912) 345-67-89']) {
    assert.equal(maskPhone(raw), '+7 (912) 345-67-89', raw);
  }
});

test('partial input while typing', () => {
  assert.equal(maskPhone('8'), '+7 (');
  assert.equal(maskPhone('+7 (9'), '+7 (9');
  assert.equal(maskPhone('+7 (912'), '+7 (912) ');
  assert.equal(maskPhone('+7 (912) 34'), '+7 (912) 34');
  assert.equal(maskPhone(''), '');
});

test('validity: exactly 10 digits after +7', () => {
  assert.equal(isValidPhone('+7 (912) 345-67-89'), true);
  assert.equal(isValidPhone('+7 (912) 345-67-8'), false);
  assert.equal(phoneDigits('+7 (912) 345-67-89'), '9123456789');
});

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scanAndRedactPII, SENIOR_SECURITY_RESOURCES } from '../src/utils/security';

describe('Security & Privacy Protection Tests', () => {
  test('Redacts Social Security Numbers (SSN) safely', () => {
    const input = 'My Medicare bill says patient SSN is 123-45-6789 and needs review.';
    const result = scanAndRedactPII(input);

    assert.strictEqual(result.hasPII, true);
    assert.ok(result.detectedTypes.includes('Social Security Number (SSN)'));
    assert.ok(!result.safeText.includes('123-45-6789'));
    assert.ok(result.safeText.includes('[PROTECTED SSN: ***-**-****]'));
  });

  test('Redacts 16-digit Credit and Debit card numbers', () => {
    const input = 'The caller asked for payment on card 4111-2222-3333-4444 immediately.';
    const result = scanAndRedactPII(input);

    assert.strictEqual(result.hasPII, true);
    assert.ok(result.detectedTypes.includes('Credit / Debit Card Number'));
    assert.ok(!result.safeText.includes('4111-2222-3333-4444'));
    assert.ok(result.safeText.includes('[PROTECTED CARD: ****-****-****-****]'));
  });

  test('Redacts PIN and password codes', () => {
    const input = 'They told me to provide PIN: 9876 to unlock my computer.';
    const result = scanAndRedactPII(input);

    assert.strictEqual(result.hasPII, true);
    assert.ok(result.detectedTypes.includes('Security PIN or Password'));
    assert.ok(!result.safeText.includes('9876'));
    assert.ok(result.safeText.includes('[PROTECTED CODE]'));
  });

  test('Redacts bank routing and account numbers', () => {
    const input = 'Deposit to routing 021000021 and account 9876543210.';
    const result = scanAndRedactPII(input);

    assert.strictEqual(result.hasPII, true);
    assert.ok(result.detectedTypes.includes('Bank Account / Routing Number'));
    assert.ok(!result.safeText.includes('9876543210'));
    assert.ok(result.safeText.includes('[PROTECTED ACCOUNT]'));
  });

  test('Leaves benign everyday text untouched', () => {
    const input = 'Doctor appointment scheduled for next Tuesday at 10:30 AM with Dr. Miller.';
    const result = scanAndRedactPII(input);

    assert.strictEqual(result.hasPII, false);
    assert.strictEqual(result.detectedTypes.length, 0);
    assert.strictEqual(result.safeText, input);
  });

  test('Provides trusted official senior fraud helplines', () => {
    assert.ok(SENIOR_SECURITY_RESOURCES.length >= 3);
    const elderHotline = SENIOR_SECURITY_RESOURCES.find(r => r.name.includes('Elder Fraud Hotline'));
    assert.ok(elderHotline);
    assert.ok(elderHotline?.phone.includes('833'));
  });
});

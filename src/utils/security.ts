/**
 * Security & Privacy Utilities for Lumina Companion.
 * 
 * Provides:
 * 1. Automatic client-side PII (Personally Identifiable Information) detection and redaction.
 *    Protects Social Security Numbers, Credit/Debit Card numbers, bank accounts, and PINs
 *    before they ever leave the user's browser.
 * 2. Fraud & Emergency Helplines for seniors.
 * 3. Text sanitization & safety checks.
 */

export interface PIIScanResult {
  hasPII: boolean;
  detectedTypes: string[];
  safeText: string;
  redactionCount: number;
}

// Patterns for sensitive data commonly pasted by seniors in medical bills or scams
const SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g;
const CREDIT_CARD_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11}|(?:\d{4}[-\s]){3}\d{4})\b/g;
const PIN_PASSWORD_REGEX = /\b(pin|password|passcode|secret\s*code)[\s:=]+([a-zA-Z0-9!@#$%^&*]{4,20})\b/gi;
const BANK_ACCOUNT_REGEX = /\b(account|acct|routing)\s*(?:#|number|num)?[\s:=]+(\d{6,17})\b/gi;

/**
 * Automatically inspects and masks sensitive personal identifiers.
 */
export function scanAndRedactPII(input: string): PIIScanResult {
  if (!input || typeof input !== 'string') {
    return { hasPII: false, detectedTypes: [], safeText: '', redactionCount: 0 };
  }

  let text = input;
  const detectedTypes: string[] = [];
  let redactions = 0;

  // 1. Social Security Numbers
  if (SSN_REGEX.test(text)) {
    detectedTypes.push('Social Security Number (SSN)');
    text = text.replace(SSN_REGEX, () => {
      redactions++;
      return '[PROTECTED SSN: ***-**-****]';
    });
  }

  // 2. Credit and Debit Card Numbers
  if (CREDIT_CARD_REGEX.test(text)) {
    detectedTypes.push('Credit / Debit Card Number');
    text = text.replace(CREDIT_CARD_REGEX, () => {
      redactions++;
      return '[PROTECTED CARD: ****-****-****-****]';
    });
  }

  // 3. Passwords and PINs
  if (PIN_PASSWORD_REGEX.test(text)) {
    detectedTypes.push('Security PIN or Password');
    text = text.replace(PIN_PASSWORD_REGEX, (match, prefix) => {
      redactions++;
      return `${prefix}: [PROTECTED CODE]`;
    });
  }

  // 4. Bank Account or Routing Numbers
  if (BANK_ACCOUNT_REGEX.test(text)) {
    detectedTypes.push('Bank Account / Routing Number');
    text = text.replace(BANK_ACCOUNT_REGEX, (match, prefix) => {
      redactions++;
      return `${prefix}: [PROTECTED ACCOUNT]`;
    });
  }

  return {
    hasPII: detectedTypes.length > 0,
    detectedTypes,
    safeText: text,
    redactionCount: redactions,
  };
}

/**
 * Strips dangerous HTML, script tags, trims excess whitespace, and caps length
 * before data is transmitted to AI API endpoints.
 */
export function sanitizeInputForAI(input: string, maxLength: number = 8000): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    // Remove script tags and embedded JavaScript
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove HTML event attributes like onerror, onclick, etc.
    .replace(/\s*on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    // Strip dangerous tags like iframe, object, embed
    .replace(/<\/?(iframe|object|embed|applet)\b[^>]*>/gi, '')
    // Normalize excess blank lines
    .replace(/\n{4,}/g, '\n\n')
    .trim();

  // Enforce boundary length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

/**
 * Trusted Official Senior Fraud & Security Emergency Contacts
 */
export const SENIOR_SECURITY_RESOURCES = [
  {
    name: 'National Elder Fraud Hotline (US Dept of Justice)',
    phone: '1-833-FRAUD-11 (1-833-372-8311)',
    hours: 'Mon-Fri, 10am-6pm ET • Free & Confidential',
    description: 'Case managers help older adults report fraud, file complaints, and connect with local support.',
  },
  {
    name: 'Federal Trade Commission (FTC) Fraud Reporting',
    phone: '1-877-FTC-HELP (1-877-382-4357)',
    website: 'ReportFraud.ftc.gov',
    description: 'The official federal reporting system for scams, identity theft, and telemarketer fraud.',
  },
  {
    name: 'IdentityTheft.gov (FTC)',
    phone: '1-877-438-4338',
    website: 'IdentityTheft.gov',
    description: 'Step-by-step recovery plan if someone has stolen your Social Security number or opened accounts.',
  },
  {
    name: 'Social Security Administration Fraud Hotline',
    phone: '1-800-269-0271',
    description: 'For suspicious calls claiming your Social Security benefits will be suspended or canceled.',
  },
];

/**
 * US-pilot phone normalization. One canonical form is stored and compared:
 * E.164-style `+1` + 10 digits (e.g. `+13109028228`).
 *
 * Display formatting uses the national 10-digit form: `(310) 902-8228`.
 * Values are always handled as strings — never parsed as JavaScript numbers.
 */

export type PhoneNormalizeResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

export const PHONE_VALIDATION_ERROR =
  "Enter a valid 10-digit U.S. phone number.";

/** Strip every non-digit character. Always operate on strings. */
export function digitsOnly(input: string): string {
  return String(input).replace(/\D/g, "");
}

/**
 * Digits used for the live U.S. national display (max 10).
 * If the user typed/pasted 11 digits starting with 1, drop the leading 1.
 */
export function toNationalDigits(input: string): string {
  let digits = digitsOnly(input);
  if (digits.length >= 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Format national digits as `(310) 902-8228` while the user types.
 * Partial values format progressively: `(310`, `(310) 902`, etc.
 */
export function formatUsPhoneDisplay(input: string): string {
  const d = toNationalDigits(input);
  if (d.length === 0) return "";
  if (d.length < 3) return `(${d}`;
  if (d.length === 3) return `(${d})`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Map a caret position in the raw input to a caret position in the formatted
 * display, preserving the number of digits to the left of the caret.
 */
export function caretAfterFormat(
  previousValue: string,
  previousCaret: number,
  nextFormatted: string,
): number {
  const digitsBefore = digitsOnly(previousValue.slice(0, previousCaret)).length;
  // Account for a leading country-code 1 that display formatting strips.
  let nationalBefore = digitsBefore;
  const allDigits = digitsOnly(previousValue);
  if (allDigits.startsWith("1") && allDigits.length >= 11) {
    // Digits before caret that fall within the stripped leading 1.
    const leadingOnes = previousValue
      .slice(0, previousCaret)
      .replace(/\D/g, "")
      .startsWith("1")
      ? 1
      : 0;
    if (leadingOnes && digitsBefore > 0) {
      nationalBefore = Math.max(0, digitsBefore - 1);
    }
  }
  nationalBefore = Math.min(nationalBefore, 10);

  if (nationalBefore === 0) return 0;

  let seen = 0;
  for (let i = 0; i < nextFormatted.length; i++) {
    if (/\d/.test(nextFormatted[i]!)) {
      seen += 1;
      if (seen === nationalBefore) return i + 1;
    }
  }
  return nextFormatted.length;
}

/**
 * Normalize a US phone number to `+1XXXXXXXXXX`.
 * Accepts 10-digit local numbers and 11-digit numbers with a leading 1 / +1.
 */
export function normalizeUsPhone(input: string): PhoneNormalizeResult {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: PHONE_VALIDATION_ERROR };
  }

  // Letters mean this isn't a phone number. Other punctuation is stripped.
  if (/[a-zA-Z]/.test(trimmed)) {
    return { ok: false, error: PHONE_VALIDATION_ERROR };
  }

  const digits = digitsOnly(trimmed);

  if (digits.length === 10) {
    return { ok: true, phone: `+1${digits}` };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { ok: true, phone: `+${digits}` };
  }

  return { ok: false, error: PHONE_VALIDATION_ERROR };
}

/** The 10 national digits for a canonical `+1…` phone. */
export function nationalDigits(canonical: string): string {
  return digitsOnly(canonical).slice(-10);
}

/**
 * Legacy storage variants that may already exist in the database for the same
 * logical number. Used only for lookup — new writes always use the canonical
 * `+1XXXXXXXXXX` form.
 */
export function phoneLookupCandidates(canonical: string): string[] {
  const ten = nationalDigits(canonical);
  if (ten.length !== 10) return [canonical];

  const area = ten.slice(0, 3);
  const mid = ten.slice(3, 6);
  const last = ten.slice(6);

  return Array.from(
    new Set([
      canonical,
      ten,
      `1${ten}`,
      `+1${ten}`,
      `(${area}) ${mid}-${last}`,
      `${area}-${mid}-${last}`,
      `${area}.${mid}.${last}`,
      `${area} ${mid} ${last}`,
    ]),
  );
}

/** True when two phone strings refer to the same US number after normalization. */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeUsPhone(a);
  const nb = normalizeUsPhone(b);
  if (!na.ok || !nb.ok) return false;
  return na.phone === nb.phone;
}

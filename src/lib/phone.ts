/**
 * US-pilot phone normalization. One canonical form is stored and compared:
 * E.164-style `+1` + 10 digits (e.g. `+13105550199`).
 */

export type PhoneNormalizeResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

/** Strip formatting characters; keep digits only (and a leading + if present). */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normalize a US phone number to `+1XXXXXXXXXX`.
 * Accepts 10-digit local numbers and 11-digit numbers with a leading 1 / +1.
 */
export function normalizeUsPhone(input: string): PhoneNormalizeResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  // Reject obvious non-phone characters early (letters, etc.).
  if (/[^\d+\-()\s.]/.test(trimmed)) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const digits = digitsOnly(trimmed);

  if (digits.length === 10) {
    return { ok: true, phone: `+1${digits}` };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { ok: true, phone: `+${digits}` };
  }

  if (digits.length < 10) {
    return {
      ok: false,
      error: "Enter a valid 10-digit US phone number.",
    };
  }

  return {
    ok: false,
    error: "That phone number looks too long.",
  };
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

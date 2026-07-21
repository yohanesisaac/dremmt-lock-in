import { cookies } from "next/headers";
import { serverEnv } from "./env";
import { signValue, verifySignedValue } from "./tokens";
import { getSupabaseAdmin } from "./supabase";
import {
  parseReturningMemberPayload,
  serializeReturningMemberPayload,
  type ReturningMemberContextPayload,
} from "./returning-member";
import type { MemberRow } from "./types";

export const ADMIN_COOKIE = "dremmt_admin";
export const MEMBER_COOKIE = "dremmt_member";
/** Short-lived signed context after a returning-member phone lookup. */
export const RETURNING_MEMBER_COOKIE = "dremmt_returning";

const ADMIN_SESSION_MARKER = "dremmt-admin-session";
const MEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 45; // 45 days
const RETURNING_MEMBER_COOKIE_MAX_AGE = 60 * 60 * 2; // 2 hours

export type ReturningMemberContext = ReturningMemberContextPayload;

/** Signed value stored in the admin cookie. */
export function adminCookieValue(): string {
  return signValue(ADMIN_SESSION_MARKER, serverEnv.adminPassword());
}

/** Validate the raw admin cookie value against ADMIN_PASSWORD. */
export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value) return false;
  const verified = verifySignedValue(value, serverEnv.adminPassword());
  return verified === ADMIN_SESSION_MARKER;
}

/** Read + verify the admin session from the request cookies. */
export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminCookie(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Look up the member tied to the membership-access cookie, if any.
 *
 * IMPORTANT: This cookie is UI convenience only (e.g. set after Stripe verify).
 * It must NEVER be used as proof of trialing/active membership for Checkout
 * bypass. Membership eligibility is determined solely by the submitted
 * normalized phone number against the database.
 */
export async function getMemberFromCookie(): Promise<MemberRow | null> {
  const store = await cookies();
  const token = store.get(MEMBER_COOKIE)?.value;
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("member_access_token", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as MemberRow;
}

export function memberCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MEMBER_COOKIE_MAX_AGE,
  };
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  };
}

export function returningMemberCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: RETURNING_MEMBER_COOKIE_MAX_AGE,
  };
}

/** Sign returning-member context: memberId + canonical phone + expiry. */
export function signReturningMemberContext(
  memberId: string,
  canonicalPhone: string,
  nowMs: number = Date.now(),
): string {
  const exp = nowMs + RETURNING_MEMBER_COOKIE_MAX_AGE * 1000;
  const payload = serializeReturningMemberPayload(memberId, canonicalPhone, exp);
  return signValue(payload, serverEnv.adminPassword());
}

/** Verify a returning-member cookie value. Returns null when forged/expired. */
export function verifyReturningMemberContext(
  value: string | undefined,
  nowMs: number = Date.now(),
): ReturningMemberContext | null {
  if (!value) return null;
  const verified = verifySignedValue(value, serverEnv.adminPassword());
  return parseReturningMemberPayload(verified, nowMs);
}

/**
 * Read returning-member context from the cookie, then re-load the member and
 * confirm the stored phone still matches. A stale cookie alone never grants
 * access — callers must still check subscription status and allowance.
 */
export async function getReturningMemberFromCookie(): Promise<{
  context: ReturningMemberContext;
  member: MemberRow;
} | null> {
  const store = await cookies();
  const context = verifyReturningMemberContext(
    store.get(RETURNING_MEMBER_COOKIE)?.value,
  );
  if (!context) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", context.memberId)
    .maybeSingle();

  if (error || !data) return null;
  const member = data as MemberRow;

  // Phone on the row must still match the looked-up canonical phone.
  const storedDigits = (member.phone ?? "").replace(/\D/g, "").slice(-10);
  const contextDigits = context.phone.replace(/\D/g, "").slice(-10);
  if (storedDigits.length !== 10 || storedDigits !== contextDigits) return null;

  return { context, member };
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  RETURNING_MEMBER_COOKIE,
  returningMemberCookieOptions,
  signReturningMemberContext,
} from "@/lib/auth";
import { findMemberByNormalizedPhone } from "@/lib/data";
import { normalizeUsPhone } from "@/lib/phone";
import { getMemberAllowance } from "@/lib/reward-period";
import { buildReturningMemberView } from "@/lib/returning-member";

const bodySchema = z.object({
  phone: z.string(),
});

/**
 * Look up a returning member by normalized phone.
 * Sets a short-lived signed cookie on success; never creates a member row.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid 10-digit U.S. phone number." },
      { status: 422 },
    );
  }

  const normalized = normalizeUsPhone(parsed.data.phone);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 422 });
  }

  const lookup = await findMemberByNormalizedPhone(normalized.phone);
  if (!lookup.ok) {
    return NextResponse.json({ error: lookup.error }, { status: 503 });
  }

  const store = await cookies();

  if (!lookup.member) {
    store.delete(RETURNING_MEMBER_COOKIE);
    return NextResponse.json(
      { view: buildReturningMemberView({ member: null }) },
      { status: 200 },
    );
  }

  const member = lookup.member;
  let allowance = null;
  try {
    if (
      member.subscription_status === "active" ||
      member.subscription_status === "trialing"
    ) {
      allowance = await getMemberAllowance(member);
    }
  } catch (err) {
    console.error(
      "[returning-member] allowance check failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "We couldn't verify membership right now. Please try again." },
      { status: 503 },
    );
  }

  const view = buildReturningMemberView({ member, allowance });

  // Only persist context when we found a member row (active or inactive).
  store.set(
    RETURNING_MEMBER_COOKIE,
    signReturningMemberContext(member.id, normalized.phone),
    returningMemberCookieOptions(),
  );

  return NextResponse.json({ view }, { status: 200 });
}

/** Clear returning-member context (e.g. "Start a new membership"). */
export async function DELETE() {
  const store = await cookies();
  store.delete(RETURNING_MEMBER_COOKIE);
  return NextResponse.json({ ok: true }, { status: 200 });
}

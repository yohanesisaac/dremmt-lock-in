import { afterEach, describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./env";
import {
  VERIFY_RUN_READY_STATUSES,
  buildStripeVerifyRedirect,
  isIdempotentVerifyRunStatus,
} from "./stripe-verify-redirect";

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function requestWithOrigin(origin: string) {
  return { nextUrl: { origin } };
}

afterEach(() => {
  restoreEnv();
});

describe("stripe verify redirect origin", () => {
  it("Production verification request resolves to the Vercel request origin", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: undefined,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    const origin = resolveSiteUrl(
      requestWithOrigin("https://dremmt-lock-in.vercel.app"),
    );
    expect(origin).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("uses a valid NEXT_PUBLIC_SITE_URL", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: "https://dremmt-lock-in.vercel.app",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(
      resolveSiteUrl(requestWithOrigin("https://some-other.vercel.app")),
    ).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("never redirects to localhost in Production", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: undefined,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    const origin = resolveSiteUrl(
      requestWithOrigin("https://dremmt-lock-in.vercel.app"),
    );
    const redirect = buildStripeVerifyRedirect(origin, {
      inviteToken: "invite-token-abc",
    });
    expect(redirect.url).not.toContain("localhost");
    expect(redirect.url.startsWith("https://dremmt-lock-in.vercel.app/")).toBe(
      true,
    );

    expect(() =>
      resolveSiteUrl(requestWithOrigin("http://localhost:3000")),
    ).toThrow(/public site URL/i);
  });

  it("successful verification redirects to the invitation/share success page", () => {
    const redirect = buildStripeVerifyRedirect(
      "https://dremmt-lock-in.vercel.app",
      { inviteToken: "share-token-123" },
    );
    expect(redirect.pathname).toBe("/checkout/success");
    expect(redirect.url).toBe(
      "https://dremmt-lock-in.vercel.app/checkout/success?token=share-token-123",
    );
  });

  it("repeated verification remains idempotent", () => {
    expect(VERIFY_RUN_READY_STATUSES).toEqual(["awaiting_payment", "ready"]);
    expect(isIdempotentVerifyRunStatus("awaiting_payment")).toBe(true);
    expect(isIdempotentVerifyRunStatus("ready")).toBe(true);
    // Already-accepted / other statuses are not re-mutated into new work.
    expect(isIdempotentVerifyRunStatus("accepted")).toBe(false);
    expect(isIdempotentVerifyRunStatus("pending_friend")).toBe(false);

    // Same success URL on reload — no new token minting in the redirect helper.
    const first = buildStripeVerifyRedirect("https://dremmt-lock-in.vercel.app", {
      inviteToken: "same-token",
    });
    const second = buildStripeVerifyRedirect("https://dremmt-lock-in.vercel.app", {
      inviteToken: "same-token",
    });
    expect(first.url).toBe(second.url);
  });
});

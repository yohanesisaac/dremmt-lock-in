import { afterEach, describe, expect, it } from "vitest";
import {
  buildInviteShareUrl,
  originFromForwardedHeaders,
  parseConfiguredSiteUrl,
  resolveShareOrigin,
  resolveSiteUrl,
} from "./env";
import { canShowCheckoutSuccess } from "./membership-identity";

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

describe("parseConfiguredSiteUrl", () => {
  it("accepts a valid configured Vercel URL", () => {
    expect(parseConfiguredSiteUrl("https://dremmt-lock-in.vercel.app")).toBe(
      "https://dremmt-lock-in.vercel.app",
    );
  });

  it("removes a trailing slash", () => {
    expect(parseConfiguredSiteUrl("https://dremmt-lock-in.vercel.app/")).toBe(
      "https://dremmt-lock-in.vercel.app",
    );
  });

  it("rejects quotes, parentheses, commas, whitespace, and paths", () => {
    expect(parseConfiguredSiteUrl('"https://dremmt-lock-in.vercel.app"')).toBe(
      "https://dremmt-lock-in.vercel.app",
    );
    expect(parseConfiguredSiteUrl("(https://dremmt-lock-in.vercel.app)")).toBe(
      "https://dremmt-lock-in.vercel.app",
    );
    expect(parseConfiguredSiteUrl("https://dremmt-lock-in.vercel.app,")).toBe(
      "https://dremmt-lock-in.vercel.app",
    );
    expect(parseConfiguredSiteUrl("  https://dremmt-lock-in.vercel.app  ")).toBe(
      "https://dremmt-lock-in.vercel.app",
    );
    expect(parseConfiguredSiteUrl("https://dremmt-lock-in.vercel.app/create")).toBe(
      null,
    );
    expect(parseConfiguredSiteUrl("not-a-url")).toBe(null);
    expect(parseConfiguredSiteUrl("")).toBe(null);
  });
});

describe("resolveSiteUrl", () => {
  it("uses a valid configured Vercel URL", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: "https://dremmt-lock-in.vercel.app",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(resolveSiteUrl()).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("removes trailing slash from the resolved origin", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: "https://dremmt-lock-in.vercel.app/",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(resolveSiteUrl()).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("uses the Vercel request origin when the env value is missing", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: undefined,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(
      resolveSiteUrl(requestWithOrigin("https://dremmt-lock-in.vercel.app")),
    ).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("allows localhost in development", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: undefined,
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
    });
    expect(resolveSiteUrl()).toBe("http://localhost:3000");
    expect(resolveSiteUrl(requestWithOrigin("http://localhost:3000"))).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects localhost in Production", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: undefined,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(() =>
      resolveSiteUrl(requestWithOrigin("http://localhost:3000")),
    ).toThrow(/public site URL/i);

    setEnv({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(() => resolveSiteUrl()).toThrow(/public site URL/i);
  });

  it("falls back to the request origin when the configured URL is invalid", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: "(not-valid)",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(
      resolveSiteUrl(requestWithOrigin("https://dremmt-lock-in.vercel.app")),
    ).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("builds success_url and cancel_url from the resolved public origin", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: undefined,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    const origin = resolveSiteUrl(
      requestWithOrigin("https://dremmt-lock-in.vercel.app"),
    );
    const success_url = `${origin}/api/stripe/verify?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/create?canceled=1`;

    expect(success_url).toBe(
      "https://dremmt-lock-in.vercel.app/api/stripe/verify?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(cancel_url).toBe(
      "https://dremmt-lock-in.vercel.app/create?canceled=1",
    );
    expect(success_url).not.toContain("localhost");
    expect(cancel_url).not.toContain("localhost");
  });
});

describe("resolveShareOrigin / checkout success share URL", () => {
  it("resolves Production success share origin from forwarded Vercel headers", () => {
    const origin = resolveShareOrigin({
      configuredSiteUrl: null,
      forwardedHost: "dremmt-lock-in.vercel.app",
      host: "dremmt-lock-in.vercel.app",
      forwardedProto: "https",
      allowLocalhost: false,
    });
    expect(origin).toBe("https://dremmt-lock-in.vercel.app");
    expect(
      buildInviteShareUrl(origin, "invite-token-abc"),
    ).toBe("https://dremmt-lock-in.vercel.app/invite/invite-token-abc");
  });

  it("uses a configured public site URL", () => {
    expect(
      resolveShareOrigin({
        configuredSiteUrl: "https://dremmt-lock-in.vercel.app",
        forwardedHost: "other.example.com",
        host: "other.example.com",
        forwardedProto: "https",
        allowLocalhost: false,
      }),
    ).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("relative internal navigation does not require a public origin", () => {
    const relativeNav = ["/create", "/manage-membership", "/invite/token"];
    for (const href of relativeNav) {
      expect(href.startsWith("/")).toBe(true);
      expect(href).not.toContain("localhost");
      expect(href).not.toMatch(/^https?:\/\//);
    }
  });

  it("invitation share URL uses the Vercel host, never localhost in Production", () => {
    const origin = resolveShareOrigin({
      configuredSiteUrl: undefined,
      forwardedHost: "dremmt-lock-in.vercel.app",
      host: "127.0.0.1",
      forwardedProto: "https",
      allowLocalhost: false,
    });
    const inviteUrl = buildInviteShareUrl(origin, "tok");
    expect(inviteUrl).toBe("https://dremmt-lock-in.vercel.app/invite/tok");
    expect(inviteUrl).not.toContain("localhost");
  });

  it("missing headers and missing env fail only when an absolute share URL is required", () => {
    expect(() =>
      resolveShareOrigin({
        configuredSiteUrl: null,
        forwardedHost: null,
        host: null,
        forwardedProto: null,
        allowLocalhost: false,
      }),
    ).toThrow(/share links/i);

    // Relative fallback still usable for page render without absolute origin.
    expect(`/invite/tok`).toBe("/invite/tok");
  });

  it("originFromForwardedHeaders prefers x-forwarded-host + proto", () => {
    expect(
      originFromForwardedHeaders({
        forwardedHost: "dremmt-lock-in.vercel.app",
        host: "localhost:3000",
        forwardedProto: "https",
      }),
    ).toBe("https://dremmt-lock-in.vercel.app");
  });

  it("existing token validation remains unchanged", () => {
    expect(
      canShowCheckoutSuccess({
        runStatus: "ready",
        memberStatus: "trialing",
      }),
    ).toBe(true);
    expect(
      canShowCheckoutSuccess({
        runStatus: "awaiting_payment",
        memberStatus: "trialing",
      }),
    ).toBe(false);
  });
});

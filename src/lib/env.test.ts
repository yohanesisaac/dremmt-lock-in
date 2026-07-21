import { afterEach, describe, expect, it } from "vitest";
import {
  parseConfiguredSiteUrl,
  resolveSiteUrl,
} from "./env";

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

/**
 * Server-side environment access with clear, loud errors.
 *
 * Never import this from a Client Component. These reads are only valid on the
 * server (route handlers, server actions, server components).
 */

import { headers } from "next/headers";
import type { NextRequest } from "next/server";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example and README_SETUP.md.`,
    );
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripePriceId: () => required("STRIPE_PRICE_ID"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  adminPassword: () => required("ADMIN_PASSWORD"),
};

/** True when running on Vercel Production (not preview/dev). */
function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Local app development — localhost fallback is allowed here only. */
function isLocalDevelopment(): boolean {
  if (isVercelProduction()) return false;
  return process.env.NODE_ENV !== "production";
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Parse NEXT_PUBLIC_SITE_URL into a clean origin, or null if unusable.
 *
 * Rejects accidental paste formatting: quotes, parentheses, commas, whitespace,
 * and any path/query/hash after the domain. A valid value is exactly an
 * absolute http(s) origin such as `https://dremmt-lock-in.vercel.app`.
 */
export function parseConfiguredSiteUrl(
  raw: string | undefined | null,
): string | null {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value) return null;

  // Strip surrounding quotes / brackets / parentheses and trailing commas.
  value = value
    .replace(/^[\s("'\[{<]+/, "")
    .replace(/[\s)"'\]}>,]+$/g, "")
    .trim();
  if (!value) return null;

  // Drop a trailing slash before URL parsing so origin comparison is clean.
  value = value.replace(/\/+$/, "");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  // Reject paths (other than empty /), query, or hash — origin only.
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;

  return url.origin;
}

type RequestWithOrigin = Pick<NextRequest, "nextUrl"> | { nextUrl: { origin: string } };

/**
 * Resolve the public site origin for redirects (Stripe Checkout, etc.).
 *
 * Order:
 * 1. Valid NEXT_PUBLIC_SITE_URL absolute http(s) origin
 * 2. Incoming request origin (when provided)
 * 3. http://localhost:3000 only in local development
 *
 * Never silently returns localhost on Vercel Production.
 */
export function resolveSiteUrl(request?: RequestWithOrigin): string {
  const configured = parseConfiguredSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) {
    if (isLocalhostOrigin(configured) && (isVercelProduction() || !isLocalDevelopment())) {
      // Ignore a misconfigured localhost value outside local development.
    } else {
      return configured.replace(/\/$/, "");
    }
  }

  if (request?.nextUrl?.origin) {
    const origin = String(request.nextUrl.origin).replace(/\/$/, "");
    if (isLocalhostOrigin(origin)) {
      if (isLocalDevelopment()) {
        return origin;
      }
      // Do not use localhost from the request in Production.
    } else if (origin.startsWith("http://") || origin.startsWith("https://")) {
      return origin;
    }
  }

  if (isLocalDevelopment()) {
    return "http://localhost:3000";
  }

  throw new Error(
    "Could not resolve a public site URL for redirects. Set NEXT_PUBLIC_SITE_URL to an absolute https origin (e.g. https://dremmt-lock-in.vercel.app) with no quotes, parentheses, or path.",
  );
}

/**
 * Build an absolute invitation URL for copy/share fields.
 * Prefer relative paths (`/invite/[token]`) for in-app Link navigation.
 */
export function buildInviteShareUrl(origin: string, inviteToken: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${inviteToken}`;
}

/**
 * Derive a public origin from forwarded Host headers (Vercel / proxies).
 * Pure helper — safe to unit test without Next.js.
 */
export function originFromForwardedHeaders(args: {
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
}): string | null {
  const hostRaw = (args.forwardedHost || args.host || "").trim();
  if (!hostRaw) return null;

  // x-forwarded-host may be a comma-separated list; use the first.
  const host = hostRaw.split(",")[0]!.trim();
  if (!host || host.includes("/") || host.includes(" ")) return null;

  const protoRaw = (args.forwardedProto || "").trim().split(",")[0]!.trim();
  let proto = protoRaw.toLowerCase();
  if (proto !== "http" && proto !== "https") {
    proto = isLocalhostOrigin(`http://${host}`) ? "http" : "https";
  }

  try {
    const url = new URL(`${proto}://${host}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Pure Server-Component origin resolution (config + forwarded headers).
 * Used by {@link resolveServerSiteUrl} and unit tests.
 */
export function resolveShareOrigin(args: {
  configuredSiteUrl?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  allowLocalhost: boolean;
}): string {
  const configured = parseConfiguredSiteUrl(args.configuredSiteUrl);
  if (configured) {
    if (isLocalhostOrigin(configured) && !args.allowLocalhost) {
      // Ignore a misconfigured localhost value outside local development.
    } else {
      return configured.replace(/\/$/, "");
    }
  }

  const fromHeaders = originFromForwardedHeaders({
    forwardedHost: args.forwardedHost,
    host: args.host,
    forwardedProto: args.forwardedProto,
  });

  if (fromHeaders) {
    if (isLocalhostOrigin(fromHeaders)) {
      if (args.allowLocalhost) return fromHeaders;
    } else {
      return fromHeaders.replace(/\/$/, "");
    }
  }

  if (args.allowLocalhost) {
    return "http://localhost:3000";
  }

  throw new Error(
    "Could not resolve a public site URL for share links. Set NEXT_PUBLIC_SITE_URL to an absolute https origin (e.g. https://dremmt-lock-in.vercel.app), or ensure Host / x-forwarded-host headers are present.",
  );
}

/**
 * Resolve the public site origin for Server Components (no NextRequest).
 *
 * Order:
 * 1. Valid NEXT_PUBLIC_SITE_URL
 * 2. x-forwarded-proto + x-forwarded-host
 * 3. https/http + host header
 * 4. localhost only in local development
 *
 * Do not call {@link resolveSiteUrl} without a request from Server Components.
 */
export async function resolveServerSiteUrl(): Promise<string> {
  const h = await headers();
  return resolveShareOrigin({
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    forwardedHost: h.get("x-forwarded-host"),
    host: h.get("host"),
    forwardedProto: h.get("x-forwarded-proto"),
    allowLocalhost: isLocalDevelopment(),
  });
}

/**
 * @deprecated Prefer {@link resolveSiteUrl}(request) in route handlers or
 * {@link resolveServerSiteUrl}() in Server Components. This requestless form
 * throws in Production when NEXT_PUBLIC_SITE_URL is missing/invalid.
 */
export function siteUrl(): string {
  return resolveSiteUrl();
}

/** The Dremmt pilot phone number (used for display + suggested copy). */
export function dremmtPhone(): string {
  return process.env.NEXT_PUBLIC_DREMMT_PHONE || "";
}

/**
 * Stripe's hosted (no-code) customer portal URL. Members open it and log in
 * with the email they checked out with — Stripe emails them a one-time code.
 * Not required for the app to run; the /manage-membership page degrades
 * gracefully when it is missing.
 */
export function stripeCustomerPortalUrl(): string {
  return process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL || "";
}

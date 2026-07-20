import { SiteHeader, SiteFooter, accentButton } from "@/components/ui";
import { stripeCustomerPortalUrl } from "@/lib/env";

export const metadata = {
  title: "Manage your membership — Dremmt Lock-In",
};

export default function ManageMembershipPage() {
  const portalUrl = stripeCustomerPortalUrl();
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-12 sm:px-8">
          <div>
            <h1 className="text-3xl text-navy">Manage your membership</h1>
            <p className="mt-3 text-navy">
              No profile or password needed. Open Stripe&apos;s secure portal and
              use the email you checked out with. Stripe will send you a one-time
              code.
            </p>
          </div>

          {portalUrl ? (
            <div className="space-y-4">
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={accentButton}
              >
                Manage or cancel membership
              </a>
              <p className="text-navy">
                From there, you can cancel, update your payment method, or view
                billing details.
              </p>
              <p className="text-navy">
                Cancel before your free trial ends and you will not be charged.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border-strong bg-cream p-6">
              <p className="font-medium text-navy">
                Membership management isn&apos;t configured yet.
              </p>
              {isDev ? (
                <div className="mt-3 space-y-2 text-sm text-navy">
                  <p>
                    Set{" "}
                    <code className="rounded bg-surface px-1.5 py-0.5">
                      NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL
                    </code>{" "}
                    in <code className="rounded bg-surface px-1.5 py-0.5">.env.local</code>{" "}
                    to your Stripe hosted customer portal link, then restart the
                    dev server.
                  </p>
                  <p className="text-muted">
                    See README_SETUP.md → &ldquo;Stripe free trial and
                    cancellation setup.&rdquo;
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-navy">
                  Please contact Dremmt during the pilot and we&apos;ll help you
                  cancel or update your membership.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

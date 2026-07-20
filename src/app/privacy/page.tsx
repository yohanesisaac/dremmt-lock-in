import { SiteHeader, SiteFooter } from "@/components/ui";

export const metadata = {
  title: "Privacy — Dremmt Lock-In",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-5 py-12 sm:px-8">
          <h1 className="text-3xl text-navy">Privacy (pilot)</h1>
          <p className="text-muted">
            This is a small pilot. Here&apos;s plainly what we collect and why.
          </p>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">What we collect</h2>
            <p className="text-navy">
              For the person starting a plan: first name, phone number, and email.
              For an invited friend who accepts: first name (from the invite) and
              phone number. We also store the plan details you enter — restaurant,
              location, proposed times, and any message you add.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">How we use it</h2>
            <p className="text-navy">
              We use your contact details for this specific plan, membership
              updates, and a day-of reminder. During the pilot, reminders are sent
              manually by a person at Dremmt — we do not run automated texting.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Texting consent</h2>
            <p className="text-navy">
              We only text people who checked the consent box. You can reply STOP
              at any time to stop receiving texts about a Dremmt run.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Payments</h2>
            <p className="text-navy">
              Membership payments are handled by Stripe. We never see or store your
              full card details.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl text-navy">Contact</h2>
            <p className="text-navy">
              Want your data removed, or have a question? Contact Dremmt during the
              pilot and we&apos;ll take care of it.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

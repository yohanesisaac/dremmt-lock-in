import { SiteHeader, SiteFooter } from "@/components/ui";
import { CreateFlow } from "@/components/create/CreateFlow";
import { getMemberFromCookie } from "@/lib/auth";
import {
  isMembershipActive,
  getMemberAllowance,
  formatResetDate,
} from "@/lib/reward-period";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  const member = await getMemberFromCookie();
  const activeMember = member ? isMembershipActive(member) : false;
  const allowance =
    activeMember && member ? await getMemberAllowance(member) : null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
          <CreateFlow
            isActiveMember={activeMember}
            isTrial={allowance?.isTrial ?? false}
            allowanceLimit={allowance?.limit ?? 2}
            allowanceRemaining={allowance?.remaining ?? null}
            allowanceLimitReached={allowance?.limitReached ?? false}
            resetDateLabel={allowance ? formatResetDate(allowance.resetDate) : null}
            canceled={canceled === "1"}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

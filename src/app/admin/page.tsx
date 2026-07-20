import { Logo, eyebrowClass, secondaryButton } from "@/components/ui";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminRunCard } from "@/components/admin/AdminRunCard";
import { isAdminAuthenticated } from "@/lib/auth";
import { logoutAdmin } from "@/app/admin/actions";
import { listRuns, listMembersByIds } from "@/lib/data";
import { siteUrl, dremmtPhone } from "@/lib/env";
import type { RunRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function count(runs: RunRow[], predicate: (run: RunRow) => boolean): number {
  return runs.filter(predicate).length;
}

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return (
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <AdminLogin />
      </main>
    );
  }

  const runs = await listRuns();
  const members = await listMembersByIds(
    runs.map((run) => run.member_id).filter((id): id is string => Boolean(id)),
  );

  const summary = [
    { label: "Awaiting payment", value: count(runs, (r) => r.status === "awaiting_payment") },
    { label: "Ready to share", value: count(runs, (r) => r.status === "ready") },
    { label: "Pending friend", value: count(runs, (r) => r.status === "pending_friend") },
    { label: "Accepted", value: count(runs, (r) => r.status === "accepted") },
    { label: "Time conflict", value: count(runs, (r) => r.status === "time_conflict") },
    { label: "Completed", value: count(runs, (r) => r.status === "completed") },
    { label: "Reward sent", value: count(runs, (r) => r.reward_status === "sent") },
  ];

  const phone = dremmtPhone();

  return (
    <>
      <header className="border-b border-border bg-cream">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo showCity={false} />
            <span className={eyebrowClass}>Ops</span>
          </div>
          <form action={logoutAdmin}>
            <button type="submit" className={secondaryButton}>
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8">
          <section>
            <h1 className="text-3xl text-navy">Pilot operations</h1>
            {phone ? (
              <p className="mt-1 text-muted">
                Send manual texts from <strong>{phone}</strong>.
              </p>
            ) : (
              <p className="mt-1 text-sm text-orange-deep">
                Set NEXT_PUBLIC_DREMMT_PHONE to show your pilot texting number here.
              </p>
            )}
          </section>

          <section>
            <h2 className={`${eyebrowClass} mb-3`}>Summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {summary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-border bg-surface p-4 text-center shadow-[var(--shadow-card)]"
                >
                  <p className="text-3xl font-semibold text-navy">{item.value}</p>
                  <p className="mt-1 text-xs text-muted">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className={eyebrowClass}>All runs ({runs.length})</h2>
            {runs.length === 0 ? (
              <p className="rounded-md border border-border bg-surface p-6 text-navy shadow-[var(--shadow-card)]">
                No runs yet. Once someone creates a Dremmt run it will appear here.
              </p>
            ) : (
              runs.map((run) => (
                <AdminRunCard
                  key={run.id}
                  run={run}
                  member={run.member_id ? members.get(run.member_id) ?? null : null}
                  inviteUrl={`${siteUrl()}/invite/${run.invite_token}`}
                />
              ))
            )}
          </section>
        </div>
      </main>
    </>
  );
}

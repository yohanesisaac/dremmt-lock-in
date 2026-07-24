import { SiteHeader, SiteFooter } from "@/components/ui";
import { CreateFlow } from "@/components/create/CreateFlow";
import { loadReturningCreateContext } from "@/lib/returning-create-context";
import { isBehaviorTestMode } from "@/lib/behavior-test";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; returning?: string; restart?: string }>;
}) {
  const { canceled, returning, restart } = await searchParams;

  // Re-check membership from the signed returning cookie + live DB status.
  // Cookies alone never grant access.
  const returningContext =
    returning === "1" || restart === "1"
      ? await loadReturningCreateContext()
      : null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
          <CreateFlow
            canceled={canceled === "1"}
            returningContext={returningContext}
            restartMode={restart === "1"}
            behaviorTest={isBehaviorTestMode()}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

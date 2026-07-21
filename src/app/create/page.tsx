import { SiteHeader, SiteFooter } from "@/components/ui";
import { CreateFlow } from "@/components/create/CreateFlow";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;

  // Membership access is determined at Checkout time from the submitted phone.
  // Cookies / browser state must not pre-grant trialing or active access here.
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
          <CreateFlow canceled={canceled === "1"} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

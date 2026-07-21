import { SiteHeader, SiteFooter } from "@/components/ui";
import { ReturningMemberFlow } from "@/components/returning/ReturningMemberFlow";

export const metadata = {
  title: "Welcome back — Dremmt Lock-In",
};

export default function ReturningMemberPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-center px-5 py-16 sm:px-8">
          <ReturningMemberFlow />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

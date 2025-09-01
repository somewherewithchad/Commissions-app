import { auth } from "@/lib/auth";
import { SignInButton } from "@/app/sign-in/_components/sign-in-button";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserTypeSelector } from "@/app/(dashboard)/_components/user-type-selector";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh w-full relative flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_40rem_at_top,theme(colors.primary/10%),transparent),radial-gradient(30rem_30rem_at_bottom_right,theme(colors.primary/5%),transparent)]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Commission Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to manage payouts and track recruiting performance.
          </p>
        </div>
        <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="space-y-4">
            <UserTypeSelector />
            <SignInButton />
            <p className="text-xs text-muted-foreground text-center">
              By continuing, you agree to our Terms and acknowledge our Privacy
              Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Icons } from "@/lib/icons";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
    });
  };

  return (
    <Button
      variant="outline"
      className="w-full justify-center gap-2 h-10"
      aria-label="Continue with Google"
      onClick={handleSignIn}
    >
      <Icons.google className="size-4" />
      Continue with Google
    </Button>
  );
}

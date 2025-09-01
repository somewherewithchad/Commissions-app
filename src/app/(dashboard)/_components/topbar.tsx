import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { UserTypeSelector } from "@/app/(dashboard)/_components/user-type-selector";

export async function Topbar({
  title = "Dashboard",
  className,
}: {
  title?: string;
  className?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className={cn("bg-background sticky top-0 z-20", className)}>
      <div className="flex h-13 items-center gap-3 px-3 md:px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Commission Hub</span>
          <span className="text-sm">/</span>
          <h1 className="text-sm font-medium tracking-tight">{title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2" />
        {session?.user.role !== "admin" && <UserTypeSelector />}
      </div>
      <Separator />
    </div>
  );
}

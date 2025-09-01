import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavUser } from "@/app/(dashboard)/_components/nav-user";
import { SideBarNav } from "@/app/(dashboard)/_components/side-bar-nav";

export async function AppSidebar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <Sidebar>
      <SidebarHeader className="px-0 py-1">
        <div className="px-2">
          <h2 className="text-lg font-semibold">Commission Hub</h2>
          <p className="text-xs text-muted-foreground">Recruiting Payouts</p>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <SideBarNav user={session?.user} />
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      <SidebarFooter>
        <NavUser user={session?.user} />
      </SidebarFooter>
    </Sidebar>
  );
}

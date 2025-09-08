"use client";

import { Icons } from "@/lib/icons";
import { SidebarMenu, SidebarMenuButton } from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/auth";

export function SideBarNav({ user }: { user?: User }) {
  const pathname = usePathname();

  let navigationItems = [];

  if (user?.role === "admin") {
    navigationItems = [
      {
        title: "Dashboard",
        href: "/",
        icon: Icons.layoutDashboard,
      },
      {
        title: "Payouts",
        href: "/payouts",
        icon: Icons.dollarSign,
      },
      {
        title: "Users",
        href: "/users",
        icon: Icons.users,
      },
    ];
  } else {
    navigationItems = [
      {
        title: "Dashboard",
        href: "/",
        icon: Icons.layoutDashboard,
      },
    ];
  }

  return (
    <>
      {navigationItems.map((item) => (
        <SidebarMenu key={item.href}>
          <SidebarMenuButton asChild isActive={pathname === item.href}>
            <Link
              href={item.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenu>
      ))}
    </>
  );
}

import { Icons } from "@/lib/icons";
import { AppSidebar } from "@/app/(dashboard)/_components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Topbar } from "@/app/(dashboard)/_components/topbar";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Icons.layoutDashboard,
  },
  {
    title: "Recruiters",
    href: "/recruiters",
    icon: Icons.users,
  },
  {
    title: "Deals",
    href: "/deals",
    icon: Icons.fileText,
  },
  {
    title: "Payouts",
    href: "/payouts",
    icon: Icons.dollarSign,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: Icons.trendingUp,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Icons.settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="overflow-x-hidden">
      <AppSidebar />
      <SidebarInset className="p-0 overflow-x-hidden">
        <Topbar />
        <div className="p-2 md:p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

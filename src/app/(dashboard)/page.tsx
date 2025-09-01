import { AdminDashboard } from "@/app/(dashboard)/_components/admin-dashboard";
import { UserDashboard } from "@/app/(dashboard)/_components/user-dashboard";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role === "admin") {
    return <AdminDashboard />;
  }

  return <UserDashboard />;
}

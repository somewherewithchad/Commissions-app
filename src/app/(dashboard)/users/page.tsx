import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UsersPage } from "@/app/(dashboard)/users/_components/users-page";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  return <UsersPage />;
}

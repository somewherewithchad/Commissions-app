"use client";

import { useLocalStorage } from "@mantine/hooks";
import { RecruiterDashboard } from "@/app/(dashboard)/_components/recruiter-dashboard";
import { RecruitmentManagerDashboard } from "@/app/(dashboard)/_components/recruitment-manager-dashboard";

export function UserDashboard() {
  const [value] = useLocalStorage({
    key: "user-type",
    defaultValue: "recruiter",
  });

  if (value === "recruiter") {
    return <RecruiterDashboard />;
  }
  return <RecruitmentManagerDashboard />;
}

"use client";

import { useLocalStorage } from "@mantine/hooks";
import { RecruiterDashboard } from "@/app/(dashboard)/_components/user-dashboards/recruiter-dashboard";
import { RecruitmentManagerDashboard } from "@/app/(dashboard)/_components/user-dashboards/recruitment-manager-dashboard";
import { AccountExecutiveDashboard } from "@/app/(dashboard)/_components/user-dashboards/account-executive-dashboard";

export function UserDashboard() {
  const [value] = useLocalStorage({
    key: "user-type",
    defaultValue: "recruiter",
  });

  if (value === "recruiter") {
    return <RecruiterDashboard />;
  } else if (value === "recruitmentManager") {
    return <RecruitmentManagerDashboard />;
  } else if (value === "accountExecutive") {
    return <AccountExecutiveDashboard />;
  }
  return null;
}

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { userTypes, userTypeToLabel } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { RecruitersTable } from "@/app/(dashboard)/users/_components/recruiters-table";
import { parseAsString, useQueryState } from "nuqs";
import { RecruiterManagerTable } from "@/app/(dashboard)/users/_components/recruiter-manager-table";
import { AccountExecutiveTable } from "@/app/(dashboard)/users/_components/account-executive-table";
import { AccountManagerTable } from "@/app/(dashboard)/users/_components/account-manager-table";

export function UsersPage() {
  const router = useRouter();
  const [type] = useQueryState("type", parseAsString.withDefault("recruiter"));

  return (
    <div>
      <Select
        value={type}
        onValueChange={(value) => {
          router.push(`/users?type=${value}`);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select user type" />
        </SelectTrigger>
        <SelectContent>
          {userTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {userTypeToLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="data-table-container">
        {type === "recruiter" && <RecruitersTable />}
        {type === "recruitmentManager" && <RecruiterManagerTable />}
        {type === "accountExecutive" && <AccountExecutiveTable />}
        {type === "accountManager" && <AccountManagerTable />}
      </div>
    </div>
  );
}

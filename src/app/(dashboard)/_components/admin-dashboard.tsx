"use client";

import { RecruiterDataForm } from "@/app/(dashboard)/_components/forms/recruiter-data-form";
import { RecruitmentManagerDataForm } from "@/app/(dashboard)/_components/forms/recruitment-manager-data-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { userTypes, userTypeToLabel, type UserType } from "@/lib/utils";
import { AccountExecutiveDataForm } from "@/app/(dashboard)/_components/forms/account-executive-data-form";
import AccountManagerDataForm from "@/app/(dashboard)/_components/forms/account-manager-data-form";

export function AdminDashboard() {
  const [form, setForm] = useQueryState(
    "form",
    parseAsStringEnum(userTypes).withDefault("recruiter")
  );

  const renderForm = (form: UserType) => {
    if (form === "recruiter") {
      return <RecruiterDataForm />;
    } else if (form === "recruitmentManager") {
      return <RecruitmentManagerDataForm />;
    } else if (form === "accountExecutive") {
      return <AccountExecutiveDataForm />;
    } else return <AccountManagerDataForm />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label htmlFor="form-select">Form</Label>
        <Select
          value={form}
          onValueChange={(value) => setForm(value as UserType)}
        >
          <SelectTrigger id="form-select" aria-label="Select form">
            <SelectValue placeholder="Select form" />
          </SelectTrigger>
          <SelectContent>
            {userTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {userTypeToLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderForm(form as UserType)}
    </div>
  );
}

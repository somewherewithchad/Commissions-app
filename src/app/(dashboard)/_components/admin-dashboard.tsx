"use client";

import { RecruiterDataForm } from "@/app/(dashboard)/_components/recruiter-data-form";
import { RecruitmentManagerDataForm } from "@/app/(dashboard)/_components/recruitment-manager-data-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseAsStringEnum, useQueryState } from "nuqs";

export function AdminDashboard() {
  const [form, setForm] = useQueryState(
    "form",
    parseAsStringEnum(["recruiter", "recruitmentManager"]).withDefault(
      "recruiter"
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label htmlFor="form-select">Form</Label>
        <Select
          value={form}
          onValueChange={(value) =>
            setForm(value as "recruiter" | "recruitmentManager")
          }
        >
          <SelectTrigger id="form-select" aria-label="Select form">
            <SelectValue placeholder="Select form" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recruiter">Recruiter</SelectItem>
            <SelectItem value="recruitmentManager">
              Recruitment Manager
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form === "recruiter" ? (
        <RecruiterDataForm />
      ) : (
        <RecruitmentManagerDataForm />
      )}
    </div>
  );
}

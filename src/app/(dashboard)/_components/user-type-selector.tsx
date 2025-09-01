"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@mantine/hooks";

export function UserTypeSelector() {
  const [value, setValue] = useLocalStorage({
    key: "user-type",
    defaultValue: "recruiter",
  });

  return (
    <div>
      <Select value={value} onValueChange={(value) => setValue(value)}>
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
  );
}

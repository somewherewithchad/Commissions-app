"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@mantine/hooks";
import { userTypes, userTypeToLabel } from "@/lib/utils";

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
          {userTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {userTypeToLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

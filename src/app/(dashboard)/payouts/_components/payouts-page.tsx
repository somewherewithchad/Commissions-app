"use client";

import * as React from "react";
import { MonthPicker } from "@/components/ui/month-picker";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, userTypes, type UserType } from "@/lib/utils";
import { RecruiterPayouts } from "@/app/(dashboard)/payouts/_components/recruiter-payouts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecruitmentManagerPayouts } from "@/app/(dashboard)/payouts/_components/recruitment-manager-payouts";
import { AccountExecutivePayouts } from "@/app/(dashboard)/payouts/_components/account-executive-payouts";

export function PayoutsPage() {
  const [selected, setSelected] = React.useState<Date | null>(new Date());

  const [userType, setUserType] = React.useState<UserType>("recruiter");

  const renderPayouts = () => {
    if (userType === "recruiter") {
      return <RecruiterPayouts selected={selected} />;
    } else if (userType === "recruitmentManager") {
      return <RecruitmentManagerPayouts selected={selected} />;
    }
    return <AccountExecutivePayouts selected={selected} />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <CardTitle className="text-base">Payouts</CardTitle>
          <div className="ml-auto flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !selected && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selected ? (
                    format(selected, "MMM yyyy")
                  ) : (
                    <span>Pick a month</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <MonthPicker
                  onMonthSelect={setSelected}
                  selectedMonth={selected ?? undefined}
                />
              </PopoverContent>
            </Popover>

            <Select
              value={userType}
              onValueChange={(value) => setUserType(value as UserType)}
            >
              <SelectTrigger id="form-select" aria-label="Select form">
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {userTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>{renderPayouts()}</CardContent>
      </Card>
    </div>
  );
}

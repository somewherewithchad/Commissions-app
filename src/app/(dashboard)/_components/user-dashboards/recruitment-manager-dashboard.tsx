"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import { format, parse } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RecruitmentManagerDashboard() {
  const [year, setYear] = React.useState("2025");
  const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
  const [openPayouts, setOpenPayouts] = React.useState<Record<string, boolean>>(
    {}
  );

  const { data: managerData, isLoading } =
    api.recruitmentManager.getManagerData.useQuery({ year });

  // Fetch detailed data for the selected month when the dialog is opened
  const monthDetails = api.recruitmentManager.getManagerMonthDetails.useQuery(
    { month: selectedMonth ?? "1970-01" },
    { enabled: !!selectedMonth }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Year</span>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-sm text-muted-foreground">Loading...</div>
          )}
          {!isLoading && !managerData && (
            <div className="text-sm text-muted-foreground">
              No data available.
            </div>
          )}

          {managerData && (
            <div className="w-full overflow-x-auto rounded-md border">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    {managerData.map((m) => (
                      <TableHead key={m.month}>
                        <Dialog
                          onOpenChange={(open) =>
                            !open && setSelectedMonth(null)
                          }
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="link"
                              className="h-auto p-0 text-foreground"
                              onClick={() => setSelectedMonth(m.month)}
                            >
                              {format(
                                parse(m.month, "yyyy-MM", new Date()),
                                "MMMM yyyy"
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] !max-w-4xl max-h-[85vh] overflow-hidden">
                            <DialogHeader>
                              <DialogTitle>
                                Payout Details for{" "}
                                {format(
                                  parse(m.month, "yyyy-MM", new Date()),
                                  "MMMM yyyy"
                                )}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-auto pr-4 space-y-4">
                              {!selectedMonth || monthDetails.isLoading ? (
                                <div className="text-sm text-muted-foreground">
                                  Loading details...
                                </div>
                              ) : monthDetails.data ? (
                                monthDetails.data.payouts.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">
                                    No payouts were paid this month.
                                  </div>
                                ) : (
                                  monthDetails.data.payouts.map((payout) => (
                                    <Card key={payout.id}>
                                      <CardHeader className="flex-row items-start justify-between pb-2">
                                        <div>
                                          <p className="text-sm text-muted-foreground">
                                            Payout Amount
                                          </p>
                                          <p className="text-2xl font-bold">
                                            {formatCurrency(payout.amount)}
                                          </p>
                                        </div>
                                        <Badge
                                          variant={
                                            payout.type === "base"
                                              ? "secondary"
                                              : "default"
                                          }
                                        >
                                          {(
                                            payout.commissionRate * 100
                                          ).toFixed(2)}
                                          %{" "}
                                          {payout.type === "base"
                                            ? "Base"
                                            : "Bonus"}
                                        </Badge>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="text-sm text-muted-foreground mb-2">
                                          This payout was calculated from cash
                                          collected in{" "}
                                          <strong>
                                            {format(
                                              parse(
                                                payout.sourceSummaryMonth,
                                                "yyyy-MM",
                                                new Date()
                                              ),
                                              "MMMM yyyy"
                                            )}
                                          </strong>
                                          .
                                          {payout.type === "bonus" && (
                                            <span>
                                              {" "}
                                              The{" "}
                                              <strong>
                                                {(
                                                  payout.commissionRate * 100
                                                ).toFixed(2)}
                                                %
                                              </strong>{" "}
                                              bonus rate was applied because
                                              total invoices in{" "}
                                              <strong>
                                                {format(
                                                  parse(
                                                    payout.sourceInvoiceMonth,
                                                    "yyyy-MM",
                                                    new Date()
                                                  ),
                                                  "MMMM"
                                                )}
                                              </strong>{" "}
                                              reached{" "}
                                              <strong>
                                                {formatCurrency(
                                                  payout.sourceInvoiceTotal
                                                )}
                                              </strong>
                                              .
                                            </span>
                                          )}
                                        </div>
                                        <div className="rounded-md border">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Deal ID</TableHead>
                                                <TableHead>Deal Name</TableHead>
                                                <TableHead className="text-right">
                                                  Cash Collected
                                                </TableHead>
                                                <TableHead className="text-right">
                                                  Rate
                                                </TableHead>
                                                <TableHead className="text-right">
                                                  Commission
                                                </TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {payout.sourceCollection ? (
                                                <TableRow
                                                  key={
                                                    payout.sourceCollection.id
                                                  }
                                                >
                                                  <TableCell className="font-medium">
                                                    {
                                                      payout.sourceCollection
                                                        .dealId
                                                    }
                                                  </TableCell>
                                                  <TableCell>
                                                    {
                                                      payout.sourceCollection
                                                        .dealName
                                                    }
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {formatCurrency(
                                                      payout.sourceCollection
                                                        .amountPaid
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {(
                                                      payout.commissionRate *
                                                      100
                                                    ).toFixed(2)}
                                                    %
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {formatCurrency(
                                                      payout.sourceCollection
                                                        .amountPaid *
                                                        payout.commissionRate
                                                    )}
                                                  </TableCell>
                                                </TableRow>
                                              ) : (
                                                <TableRow>
                                                  <TableCell
                                                    colSpan={5}
                                                    className="text-sm text-muted-foreground"
                                                  >
                                                    Could not identify the exact
                                                    source collection for this
                                                    payout.
                                                  </TableCell>
                                                </TableRow>
                                              )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))
                                )
                              ) : (
                                <div className="text-sm text-destructive">
                                  Failed to load details.
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">
                      Total Invoiced
                    </TableCell>
                    {managerData.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalInvoiced)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">
                      Total Collections
                    </TableCell>
                    {managerData.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalCollections)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total Payout this Month</TableCell>
                    {managerData.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalPayout)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink } from "lucide-react";

export function AccountManagerDashboard() {
  const [year, setYear] = React.useState("2025");
  const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);

  const { data, isLoading } = api.accountManager.getManagerData.useQuery({
    year,
  });
  const monthDetails = api.accountManager.getManagerMonthDetails.useQuery(
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
          <div className="mb-2 text-xs text-muted-foreground">
            Tip: Click any month header to view payout details.
          </div>
          {isLoading && (
            <div className="text-sm text-muted-foreground">Loading...</div>
          )}

          {!isLoading && !data && (
            <div className="text-sm text-muted-foreground">
              No data available.
            </div>
          )}

          {data && (
            <div className="w-full overflow-x-auto rounded-md border">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    {data.map((m) => (
                      <TableHead key={m.month}>
                        <Dialog
                          onOpenChange={(open) =>
                            !open && setSelectedMonth(null)
                          }
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 text-foreground inline-flex items-center gap-1 underline underline-offset-4"
                                    onClick={() => setSelectedMonth(m.month)}
                                    aria-label={`View details for ${format(
                                      parse(m.month, "yyyy-MM", new Date()),
                                      "MMMM yyyy"
                                    )}`}
                                  >
                                    {format(
                                      parse(m.month, "yyyy-MM", new Date()),
                                      "MMMM yyyy"
                                    )}
                                    <ExternalLink className="h-3 w-3 opacity-70" />
                                  </Button>
                                </DialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                View payout details
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                                  monthDetails.data.payouts.map(
                                    (payout: any) => {
                                      const ratePercent = (
                                        payout.commissionRate * 100
                                      ).toFixed(2);
                                      const label =
                                        payout.type === "owner-bonus"
                                          ? "Owner Bonus"
                                          : payout.type === "bonus"
                                          ? "Bonus"
                                          : "Base";
                                      return (
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
                                            <Badge>
                                              {ratePercent}% {label}
                                            </Badge>
                                          </CardHeader>
                                          <CardContent>
                                            <div className="text-sm text-muted-foreground mb-2">
                                              This payout was calculated from
                                              cash collected in{" "}
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
                                                    {ratePercent}%
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
                                              {payout.type ===
                                                "owner-bonus" && (
                                                <span>
                                                  {" "}
                                                  This is an additional Deal
                                                  Owner bonus.
                                                </span>
                                              )}
                                            </div>
                                            <div className="rounded-md border">
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead>
                                                      Deal ID
                                                    </TableHead>
                                                    <TableHead>
                                                      Deal Name
                                                    </TableHead>
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
                                                  {payout.sourceCollections &&
                                                  payout.sourceCollections
                                                    .length > 0 ? (
                                                    payout.sourceCollections.map(
                                                      (c: any) => (
                                                        <TableRow key={c.id}>
                                                          <TableCell className="font-medium">
                                                            {c.dealId}
                                                          </TableCell>
                                                          <TableCell>
                                                            {c.dealName ?? "—"}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                            {formatCurrency(
                                                              c.amountPaid
                                                            )}
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                            {ratePercent}%
                                                          </TableCell>
                                                          <TableCell className="text-right">
                                                            {formatCurrency(
                                                              c.amountPaid *
                                                                payout.commissionRate
                                                            )}
                                                          </TableCell>
                                                        </TableRow>
                                                      )
                                                    )
                                                  ) : payout.sourceCollection ? (
                                                    <TableRow
                                                      key={
                                                        payout.sourceCollection
                                                          .id
                                                      }
                                                    >
                                                      <TableCell className="font-medium">
                                                        {
                                                          payout
                                                            .sourceCollection
                                                            .dealId
                                                        }
                                                      </TableCell>
                                                      <TableCell>
                                                        {payout.sourceCollection
                                                          .dealName ?? "—"}
                                                      </TableCell>
                                                      <TableCell className="text-right">
                                                        {formatCurrency(
                                                          payout
                                                            .sourceCollection
                                                            .amountPaid
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-right">
                                                        {ratePercent}%
                                                      </TableCell>
                                                      <TableCell className="text-right">
                                                        {formatCurrency(
                                                          payout
                                                            .sourceCollection
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
                                                        Could not identify the
                                                        exact source collection
                                                        for this payout.
                                                      </TableCell>
                                                    </TableRow>
                                                  )}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      );
                                    }
                                  )
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
                    {data.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalInvoiced)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">
                      Total Collections
                    </TableCell>
                    {data.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalCollections)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total Payout this Month</TableCell>
                    {data.map((m) => (
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

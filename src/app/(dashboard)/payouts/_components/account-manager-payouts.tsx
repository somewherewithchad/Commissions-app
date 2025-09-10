"use client";

import * as React from "react";
import { api } from "@/trpc/react";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AccountManagerPayouts({ selected }: { selected: Date | null }) {
  const monthString = React.useMemo(() => {
    if (!selected) return null;
    return format(selected, "yyyy-MM");
  }, [selected]);

  const payoutsQuery = api.accountManager.getPayoutsByMonth.useQuery(
    { month: monthString ?? "1970-01" },
    { enabled: !!monthString }
  );

  const groupedByManager = React.useMemo(() => {
    const map = new Map<
      string,
      {
        managerEmail: string;
        managerName: string | null;
        totalAmount: number;
        payouts: any[];
      }
    >();
    if (!payoutsQuery.data) return [] as Array<any>;
    for (const p of payoutsQuery.data) {
      const key = (p as any).sourceAccountManagerEmail as string;
      if (!map.has(key)) {
        map.set(key, {
          managerEmail: key,
          managerName: (p as any).managerName ?? null,
          totalAmount: 0,
          payouts: [],
        });
      }
      const entry = map.get(key)!;
      entry.totalAmount += (p as any).amount;
      entry.payouts.push(p);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );
  }, [payoutsQuery.data]);

  return (
    <>
      {!monthString ? (
        <div className="text-sm text-muted-foreground">
          Select a month to view payouts.
        </div>
      ) : payoutsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : payoutsQuery.isError ? (
        <div className="text-sm text-destructive">Failed to load.</div>
      ) : payoutsQuery.data && payoutsQuery.data.length === 0 ? (
        <div className="text-sm text-muted-foreground">No payouts.</div>
      ) : (
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>Account Manager</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead>Breakdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByManager.map((row) => (
                <React.Fragment key={row.managerEmail}>
                  <TableRow>
                    <TableCell>{row.managerName ?? row.managerEmail}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] !max-w-4xl max-h-[85vh] overflow-hidden">
                          <DialogHeader>
                            <DialogTitle>
                              Payout Details for{" "}
                              {row.managerName ?? row.managerEmail} —{" "}
                              {monthString
                                ? format(
                                    parse(monthString, "yyyy-MM", new Date()),
                                    "MMMM yyyy"
                                  )
                                : ""}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="max-h-[70vh] overflow-auto pr-4 space-y-4">
                            {row.payouts.length === 0 ? (
                              <div className="text-sm text-muted-foreground">
                                No payouts for this user.
                              </div>
                            ) : (
                              row.payouts.map((p: any) => {
                                const ratePercent = (
                                  p.commissionRate * 100
                                ).toFixed(2);
                                const label = (() => {
                                  if (p.type === "owner-bonus")
                                    return "Owner Bonus";
                                  if (p.type === "bonus") return "Bonus";
                                  return "Base";
                                })();
                                return (
                                  <Card key={p.id}>
                                    <CardHeader className="flex-row items-start justify-between pb-2">
                                      <div>
                                        <p className="text-sm text-muted-foreground">
                                          Payout Amount
                                        </p>
                                        <p className="text-2xl font-bold">
                                          {formatCurrency(p.amount)}
                                        </p>
                                      </div>
                                      <Badge>
                                        {ratePercent}% {label}
                                      </Badge>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-sm text-muted-foreground mb-2">
                                        This payout was calculated from cash
                                        collected in{" "}
                                        <strong>
                                          {format(
                                            parse(
                                              p.sourceSummaryMonth,
                                              "yyyy-MM",
                                              new Date()
                                            ),
                                            "MMMM yyyy"
                                          )}
                                        </strong>
                                        .
                                      </div>
                                      <div className="rounded-md border">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Deal ID</TableHead>
                                              <TableHead>Deal Name</TableHead>
                                              <TableHead className="text-right">
                                                Amount Paid
                                              </TableHead>
                                              <TableHead>Deal Link</TableHead>
                                              <TableHead className="text-right">
                                                Invoice Total
                                              </TableHead>
                                              <TableHead>
                                                Invoice Month
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {p.sourceCollection ? (
                                              <TableRow>
                                                <TableCell>
                                                  {p.sourceCollection.dealId}
                                                </TableCell>
                                                <TableCell>
                                                  {p.sourceCollection
                                                    .dealName ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {formatCurrency(
                                                    p.sourceCollection
                                                      .amountPaid
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                  {p.sourceCollection
                                                    .dealLink ? (
                                                    <a
                                                      href={
                                                        p.sourceCollection
                                                          .dealLink
                                                      }
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="text-primary underline-offset-4 hover:underline"
                                                    >
                                                      Open
                                                    </a>
                                                  ) : (
                                                    <span className="text-muted-foreground">
                                                      —
                                                    </span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {formatCurrency(
                                                    p.sourceInvoiceTotal || 0
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                  {p.sourceInvoiceMonth
                                                    ? format(
                                                        parse(
                                                          p.sourceInvoiceMonth,
                                                          "yyyy-MM",
                                                          new Date()
                                                        ),
                                                        "MMM yyyy"
                                                      )
                                                    : "—"}
                                                </TableCell>
                                              </TableRow>
                                            ) : (
                                              <TableRow>
                                                <TableCell colSpan={6}>
                                                  <span className="text-muted-foreground">
                                                    No collection matched.
                                                  </span>
                                                </TableCell>
                                              </TableRow>
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

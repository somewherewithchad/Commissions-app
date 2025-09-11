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

export function RecruiterPayouts({ selected }: { selected: Date | null }) {
  const monthString = React.useMemo(() => {
    if (!selected) return null;
    return format(selected, "yyyy-MM");
  }, [selected]);

  const payoutsQuery = api.recruiter.getPayoutsByMonth.useQuery(
    { month: monthString ?? "1970-01" },
    { enabled: !!monthString }
  );

  const [selectedRecruiter, setSelectedRecruiter] = React.useState<
    string | null
  >(null);

  const groupedByRecruiter = React.useMemo(() => {
    const map = new Map<
      string,
      {
        recruiterEmail: string;
        recruiterName: string | null;
        totalAmount: number;
        payouts: any[];
      }
    >();
    if (!payoutsQuery.data) return [] as Array<any>;
    for (const p of payoutsQuery.data) {
      const key = p.sourceRecruiterEmail;
      if (!map.has(key)) {
        map.set(key, {
          recruiterEmail: p.sourceRecruiterEmail,
          recruiterName: (p as any).recruiterName ?? null,
          totalAmount: 0,
          payouts: [],
        });
      }
      const entry = map.get(key)!;
      entry.totalAmount += p.amount;
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
                <TableHead>Recruiter</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead>Breakdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByRecruiter.map((row) => (
                <React.Fragment key={row.recruiterEmail}>
                  <TableRow>
                    <TableCell>
                      {row.recruiterName ?? row.recruiterEmail}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Dialog
                        onOpenChange={(open) =>
                          !open && setSelectedRecruiter(null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSelectedRecruiter(row.recruiterEmail)
                            }
                          >
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] !max-w-4xl max-h-[85vh] overflow-hidden">
                          <DialogHeader>
                            <DialogTitle>
                              Payout Details for{" "}
                              {row.recruiterName ?? row.recruiterEmail} —{" "}
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
                                const totalSource =
                                  p.sourceCashCollections.reduce(
                                    (acc: number, c: any) => acc + c.amountPaid,
                                    0
                                  );
                                const isDelayedBonus =
                                  p.payoutMonth !== p.sourceSummaryMonth;
                                const ratePercent = (
                                  p.commissionRate * 100
                                ).toFixed(0);
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
                                        {ratePercent}%{" "}
                                        {isDelayedBonus ? "Bonus" : "Base"}
                                      </Badge>
                                    </CardHeader>
                                    <CardContent>
                                      {isDelayedBonus ? (
                                        <>
                                          {p.description ? (
                                            <div className="text-sm text-muted-foreground">
                                              <span className="">
                                                This payout was calculated from
                                                cash collected in{" "}
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
                                              </span>
                                              <br />
                                              {p.description}
                                            </div>
                                          ) : (
                                            <div className="text-sm text-muted-foreground">
                                              Bonus payout
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <>
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
                                                  <TableHead>
                                                    Deal Name
                                                  </TableHead>
                                                  <TableHead className="text-right">
                                                    Amount Paid
                                                  </TableHead>
                                                  <TableHead>
                                                    Deal Link
                                                  </TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {p.sourceCashCollections.map(
                                                  (c: any) => (
                                                    <TableRow key={c.id}>
                                                      <TableCell>
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
                                                      <TableCell>
                                                        {c.dealLink ? (
                                                          <a
                                                            href={c.dealLink}
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
                                                    </TableRow>
                                                  )
                                                )}
                                                <TableRow>
                                                  <TableCell
                                                    colSpan={2}
                                                    className="font-medium"
                                                  >
                                                    Total
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium">
                                                    {formatCurrency(
                                                      totalSource
                                                    )}
                                                  </TableCell>
                                                  <TableCell />
                                                </TableRow>
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </>
                                      )}
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

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

export function RecruiterPayouts({ selected }: { selected: Date | null }) {
  const monthString = React.useMemo(() => {
    if (!selected) return null;
    return format(selected, "yyyy-MM");
  }, [selected]);

  const payoutsQuery = api.recruiter.getPayoutsByMonth.useQuery(
    { month: monthString ?? "1970-01" },
    { enabled: !!monthString }
  );

  const [openRows, setOpenRows] = React.useState<Record<string, boolean>>({});
  const [openPayouts, setOpenPayouts] = React.useState<Record<string, boolean>>(
    {}
  );

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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setOpenRows((s) => ({
                            ...s,
                            [row.recruiterEmail]: !s[row.recruiterEmail],
                          }))
                        }
                      >
                        {openRows[row.recruiterEmail] ? "Hide" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openRows[row.recruiterEmail] && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <div className="space-y-3">
                          <div className="text-sm font-medium">
                            Payout components paid this month
                          </div>
                          <div className="max-h-[50vh] w-full overflow-auto rounded border">
                            <Table className="min-w-max">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Source Month</TableHead>
                                  <TableHead className="text-right">
                                    Amount
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Rate
                                  </TableHead>
                                  <TableHead>Calculation</TableHead>
                                  <TableHead>Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.payouts.map((p: any) => {
                                  const totalSource =
                                    p.sourceCashCollections.reduce(
                                      (acc: number, c: any) =>
                                        acc + c.amountPaid,
                                      0
                                    );
                                  const calcLabel = (() => {
                                    const isDelayedBonus =
                                      p.payoutMonth !== p.sourceSummaryMonth;
                                    if (isDelayedBonus) {
                                      const remainder = Math.max(
                                        totalSource - 30000,
                                        0
                                      );
                                      return `${formatCurrency(
                                        remainder
                                      )} x 2% (bonus over 30k)`;
                                    }
                                    if (p.commissionRate === 0.03) {
                                      return `${formatCurrency(
                                        totalSource
                                      )} x 3%`;
                                    }
                                    if (p.commissionRate === 0.02) {
                                      return `${formatCurrency(
                                        totalSource
                                      )} x 2%`;
                                    }
                                    return "—";
                                  })();

                                  return (
                                    <React.Fragment key={p.id}>
                                      <TableRow>
                                        <TableCell>
                                          {format(
                                            parse(
                                              p.sourceSummaryMonth,
                                              "yyyy-MM",
                                              new Date()
                                            ),
                                            "MMMM yyyy"
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatCurrency(p.amount)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {(p.commissionRate * 100).toFixed(0)}%
                                        </TableCell>
                                        <TableCell>{calcLabel}</TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              setOpenPayouts((s) => ({
                                                ...s,
                                                [p.id]: !s[p.id],
                                              }))
                                            }
                                          >
                                            {openPayouts[p.id]
                                              ? "Hide"
                                              : "View"}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                      {openPayouts[p.id] && (
                                        <TableRow>
                                          <TableCell colSpan={5}>
                                            <div className="space-y-2">
                                              <div className="text-sm text-muted-foreground">
                                                Source cash collections
                                                contributing to this payout
                                              </div>
                                              <div className="max-h-48 w-full overflow-auto rounded border">
                                                <Table className="min-w-max">
                                                  <TableHeader>
                                                    <TableRow>
                                                      <TableHead>
                                                        Deal ID
                                                      </TableHead>
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
                                                                href={
                                                                  c.dealLink
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
                                                          p.sourceCashCollections.reduce(
                                                            (
                                                              acc: number,
                                                              c: any
                                                            ) =>
                                                              acc +
                                                              c.amountPaid,
                                                            0
                                                          )
                                                        )}
                                                      </TableCell>
                                                      <TableCell />
                                                    </TableRow>
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

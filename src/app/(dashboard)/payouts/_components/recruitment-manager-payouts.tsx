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

export function RecruitmentManagerPayouts({
  selected,
}: {
  selected: Date | null;
}) {
  const monthString = React.useMemo(() => {
    if (!selected) return null;
    return format(selected, "yyyy-MM");
  }, [selected]);

  const payoutsQuery = api.recruitmentManager.getPayoutsByMonth.useQuery(
    { month: monthString ?? "1970-01" },
    { enabled: !!monthString }
  );

  const [openRows, setOpenRows] = React.useState<Record<string, boolean>>({});
  const [openPayouts, setOpenPayouts] = React.useState<Record<string, boolean>>(
    {}
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
      const key = (p as any).sourceManagerEmail as string;
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
                <TableHead>Recruitment Manager</TableHead>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setOpenRows((s) => ({
                            ...s,
                            [row.managerEmail]: !s[row.managerEmail],
                          }))
                        }
                      >
                        {openRows[row.managerEmail] ? "Hide" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openRows[row.managerEmail] && (
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
                                  <TableHead>Source Collection Month</TableHead>
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
                                  const calcLabel = (() => {
                                    const amountPaid =
                                      p.sourceCollection?.amountPaid ?? 0;
                                    if (
                                      p.type === "base" ||
                                      p.commissionRate === 0.01
                                    ) {
                                      return `${formatCurrency(
                                        amountPaid
                                      )} x 1%`;
                                    }
                                    if (p.commissionRate === 0.0025) {
                                      return `${formatCurrency(
                                        amountPaid
                                      )} x 0.25% (invoice total ${formatCurrency(
                                        p.sourceInvoiceTotal || 0
                                      )} in ${
                                        p.sourceInvoiceMonth
                                          ? format(
                                              parse(
                                                p.sourceInvoiceMonth,
                                                "yyyy-MM",
                                                new Date()
                                              ),
                                              "MMM yyyy"
                                            )
                                          : "—"
                                      })`;
                                    }
                                    if (p.commissionRate === 0.005) {
                                      return `${formatCurrency(
                                        amountPaid
                                      )} x 0.5% (invoice total ${formatCurrency(
                                        p.sourceInvoiceTotal || 0
                                      )} in ${
                                        p.sourceInvoiceMonth
                                          ? format(
                                              parse(
                                                p.sourceInvoiceMonth,
                                                "yyyy-MM",
                                                new Date()
                                              ),
                                              "MMM yyyy"
                                            )
                                          : "—"
                                      })`;
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
                                          {(p.commissionRate * 100).toFixed(2)}%
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
                                                Source cash collection
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
                                                    {p.sourceCollection ? (
                                                      <TableRow>
                                                        <TableCell>
                                                          {
                                                            p.sourceCollection
                                                              .dealId
                                                          }
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
                                                                p
                                                                  .sourceCollection
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
                                                      </TableRow>
                                                    ) : (
                                                      <TableRow>
                                                        <TableCell colSpan={4}>
                                                          <span className="text-muted-foreground">
                                                            No collection
                                                            matched.
                                                          </span>
                                                        </TableCell>
                                                      </TableRow>
                                                    )}
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

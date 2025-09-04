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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AccountExecutivePayouts({
  selected,
}: {
  selected: Date | null;
}) {
  const monthString = React.useMemo(() => {
    if (!selected) return null;
    return format(selected, "yyyy-MM");
  }, [selected]);

  const payoutsQuery = api.accountExecutive.getPayoutsByMonth.useQuery(
    { month: monthString ?? "1970-01" },
    { enabled: !!monthString }
  );

  const [selectedExecutive, setSelectedExecutive] = React.useState<
    string | null
  >(null);
  const [openPayouts, setOpenPayouts] = React.useState<Record<string, boolean>>(
    {}
  );

  const groupedByExecutive = React.useMemo(() => {
    const map = new Map<
      string,
      {
        executiveEmail: string;
        executiveName: string | null;
        totalAmount: number;
        payouts: any[];
      }
    >();
    if (!payoutsQuery.data) return [] as Array<any>;
    for (const p of payoutsQuery.data) {
      const key = (p as any).sourceExecutiveEmail as string;
      if (!map.has(key)) {
        map.set(key, {
          executiveEmail: key,
          executiveName: (p as any).executiveName ?? null,
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
                <TableHead>Account Executive</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedByExecutive.map((row) => (
                <React.Fragment key={row.executiveEmail}>
                  <TableRow>
                    <TableCell>
                      {row.executiveName ?? row.executiveEmail}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Dialog
                        onOpenChange={(open) =>
                          !open && setSelectedExecutive(null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSelectedExecutive(row.executiveEmail)
                            }
                          >
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] !max-w-4xl max-h-[85vh] overflow-hidden">
                          <DialogHeader>
                            <DialogTitle>
                              Payout Details for{" "}
                              {row.executiveName ?? row.executiveEmail} —{" "}
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
                              row.payouts.map((payout: any) => (
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
                                      {(payout.commissionRate * 100).toFixed(2)}
                                      % Base
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
                                          {payout.sourceCollections &&
                                          payout.sourceCollections.length >
                                            0 ? (
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
                                                    {(
                                                      payout.commissionRate *
                                                      100
                                                    ).toFixed(2)}
                                                    %
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
                                          ) : (
                                            <TableRow>
                                              <TableCell
                                                colSpan={5}
                                                className="text-sm text-muted-foreground"
                                              >
                                                Could not identify the exact
                                                source collections for this
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

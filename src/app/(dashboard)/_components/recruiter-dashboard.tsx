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

export function RecruiterDashboard() {
  const [year, setYear] = React.useState("2025");
  const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
  const [openPayouts, setOpenPayouts] = React.useState<Record<string, boolean>>(
    {}
  );

  const { data, isLoading } = api.recruiter.getRecruiterData.useQuery({ year });
  const monthDetails = api.recruiter.getRecruiterMonthDetails.useQuery(
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
                                {format(
                                  parse(m.month, "yyyy-MM", new Date()),
                                  "MMMM yyyy"
                                )}{" "}
                                details
                              </DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-auto pr-1">
                              {!selectedMonth || monthDetails.isLoading ? (
                                <div className="text-sm text-muted-foreground">
                                  Loading...
                                </div>
                              ) : monthDetails.data ? (
                                <div className="space-y-6">
                                  <div>
                                    <h3 className="mb-2 font-semibold">
                                      Deals completed
                                    </h3>
                                    {monthDetails.data.deals.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">
                                        No deals
                                      </div>
                                    ) : (
                                      <div className="max-h-[45vh] w-full overflow-auto overflow-x-auto rounded border">
                                        <Table className="min-w-max">
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Deal ID</TableHead>
                                              <TableHead>Deal Name</TableHead>
                                              <TableHead>Deal Link</TableHead>
                                              <TableHead className="text-right">
                                                Amount Invoiced
                                              </TableHead>
                                              <TableHead>
                                                Recruiter Email
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {monthDetails.data.deals.map(
                                              (d) => (
                                                <TableRow key={d.id}>
                                                  <TableCell>
                                                    {d.dealId}
                                                  </TableCell>
                                                  <TableCell>
                                                    {d.dealName}
                                                  </TableCell>
                                                  <TableCell>
                                                    {d.dealLink ? (
                                                      <a
                                                        href={d.dealLink}
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
                                                      d.amountInvoiced
                                                    )}
                                                  </TableCell>
                                                  <TableCell>
                                                    {d.recruiterEmail}
                                                  </TableCell>
                                                </TableRow>
                                              )
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h3 className="mb-2 font-semibold">
                                      Cash collected
                                    </h3>
                                    {monthDetails.data.cashCollections
                                      .length === 0 ? (
                                      <div className="text-sm text-muted-foreground">
                                        No cash collections
                                      </div>
                                    ) : (
                                      <div className="max-h-[45vh] w-full overflow-auto overflow-x-auto rounded border">
                                        <Table className="min-w-max">
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Deal ID</TableHead>
                                              <TableHead>Deal Name</TableHead>
                                              <TableHead>Deal Link</TableHead>
                                              <TableHead className="text-right">
                                                Amount Paid
                                              </TableHead>
                                              <TableHead>
                                                Recruiter Email
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {monthDetails.data.cashCollections.map(
                                              (c) => (
                                                <TableRow key={c.id}>
                                                  <TableCell>
                                                    {c.dealId}
                                                  </TableCell>
                                                  <TableCell>
                                                    {c.dealName ?? "—"}
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
                                                  <TableCell className="text-right">
                                                    {formatCurrency(
                                                      c.amountPaid
                                                    )}
                                                  </TableCell>
                                                  <TableCell>
                                                    {c.recruiterEmail}
                                                  </TableCell>
                                                </TableRow>
                                              )
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h3 className="mb-2 font-semibold">
                                      Payouts paid this month
                                    </h3>
                                    {monthDetails.data.payouts.length === 0 ? (
                                      <div className="text-sm text-muted-foreground">
                                        No payouts
                                      </div>
                                    ) : (
                                      <div className="max-h-[45vh] w-full overflow-auto overflow-x-auto rounded border">
                                        <Table className="min-w-max">
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>
                                                Source Month
                                              </TableHead>
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
                                            {monthDetails.data.payouts.map(
                                              (p) => (
                                                <>
                                                  <TableRow key={p.id}>
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
                                                      {(
                                                        p.commissionRate * 100
                                                      ).toFixed(0)}
                                                      %
                                                    </TableCell>
                                                    <TableCell>
                                                      {(() => {
                                                        const total =
                                                          p.sourceCashCollections.reduce(
                                                            (
                                                              acc: number,
                                                              c: any
                                                            ) =>
                                                              acc +
                                                              c.amountPaid,
                                                            0
                                                          );
                                                        const isDelayedBonus =
                                                          p.payoutMonth !==
                                                          p.sourceSummaryMonth;
                                                        if (isDelayedBonus) {
                                                          const remainder =
                                                            Math.max(
                                                              total - 30000,
                                                              0
                                                            );
                                                          return `${formatCurrency(
                                                            remainder
                                                          )} x 2% (bonus over 30k)`;
                                                        }
                                                        if (
                                                          p.commissionRate ===
                                                          0.03
                                                        ) {
                                                          return `${formatCurrency(
                                                            total
                                                          )} x 3%`;
                                                        }
                                                        if (
                                                          p.commissionRate ===
                                                          0.02
                                                        ) {
                                                          return `${formatCurrency(
                                                            total
                                                          )} x 2%`;
                                                        }
                                                        return "—";
                                                      })()}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                          setOpenPayouts(
                                                            (s) => ({
                                                              ...s,
                                                              [p.id]: !s[p.id],
                                                            })
                                                          )
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
                                                            Source cash
                                                            collections
                                                            contributing to this
                                                            payout
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
                                                                    <TableRow
                                                                      key={c.id}
                                                                    >
                                                                      <TableCell>
                                                                        {
                                                                          c.dealId
                                                                        }
                                                                      </TableCell>
                                                                      <TableCell>
                                                                        {c.dealName ??
                                                                          "—"}
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
                                                </>
                                              )
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-destructive">
                                  Failed to load.
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
                    <TableCell className="font-semibold">Deals</TableCell>
                    {data.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalDealsCompleted)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Cash</TableCell>
                    {data.map((m) => (
                      <TableCell key={m.month}>
                        {formatCurrency(m.totalCashCollected)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">
                      Total Payout
                    </TableCell>
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

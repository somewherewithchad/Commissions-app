"use client";

import { useDataTable } from "@/hooks/use-data-table";
import type { Column, ColumnDef } from "@tanstack/react-table";
import React from "react";
import { api } from "@/trpc/react";
import { parseAsInteger, useQueryState } from "nuqs";
import { type RouterOutputs } from "@/trpc/react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Icons } from "@/lib/icons";
import { AddAccountExecutiveDialog } from "@/app/(dashboard)/users/_components/add-account-executive-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditAccountExecutiveDialog } from "@/app/(dashboard)/users/_components/edit-account-executive-dialog";

type AccountExecutive =
  RouterOutputs["accountExecutive"]["getAllAccountExecutives"]["items"][number];

export function AccountExecutiveTable() {
  const [page] = useQueryState("page", parseAsInteger.withDefault(1));
  const [perPage] = useQueryState("perPage", parseAsInteger.withDefault(10));

  const accountExecutives =
    api.accountExecutive.getAllAccountExecutives.useQuery({
      page,
      perPage,
    });

  const columns = React.useMemo<ColumnDef<AccountExecutive>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }: { column: Column<AccountExecutive, unknown> }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ cell }) => (
          <div>{cell.getValue<AccountExecutive["name"]>()}</div>
        ),
        meta: {
          label: "Name",
        },
        enableColumnFilter: true,
        enableSorting: false,
      },
      {
        id: "email",
        accessorKey: "email",
        header: ({ column }: { column: Column<AccountExecutive, unknown> }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ cell }) => (
          <div>{cell.getValue<AccountExecutive["email"]>()}</div>
        ),
        meta: {
          label: "Email",
        },
        enableColumnFilter: true,
        enableSorting: false,
      },
      {
        id: "commission",
        header: ({ column }: { column: Column<AccountExecutive, unknown> }) => (
          <DataTableColumnHeader column={column} title="Commission" />
        ),
        cell: ({ row }) => {
          const exec = row.original as AccountExecutive;
          const pct = (n: number) =>
            `${(n * 100).toFixed(1).replace(/\.0$/, "")}\u0025`;
          const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                  <Badge variant="secondary">
                    Base {pct(exec.baseCommissionRate)}
                  </Badge>
                  {exec.tierSystemEnabled ? (
                    <>
                      <Badge variant="outline">
                        T1 {pct(exec.tier1CommissionRate)}
                      </Badge>
                      <Badge variant="outline">
                        T2 {pct(exec.tier2CommissionRate)}
                      </Badge>
                      <Badge variant="outline">
                        T3 {pct(exec.tier3CommissionRate)}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">Tier System Disabled</Badge>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="grid gap-1">
                  <div>Base: {pct(exec.baseCommissionRate)}</div>
                  <div>
                    Tier 1: {pct(exec.tier1CommissionRate)} at{" "}
                    {dollars(exec.tier1CashCollectedThreshold)}+
                  </div>
                  <div>
                    Tier 2: {pct(exec.tier2CommissionRate)} at{" "}
                    {dollars(exec.tier2CashCollectedThreshold)}+
                  </div>
                  <div>
                    Tier 3: {pct(exec.tier3CommissionRate)} at{" "}
                    {dollars(exec.tier3CashCollectedThreshold)}+
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
        meta: {
          label: "Commission",
        },
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        id: "actions",
        cell: function Cell({ row }) {
          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Icons.moreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <EditAccountExecutiveDialog accountExecutive={row.original} />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        },
        size: 32,
      },
    ],
    []
  );

  const { table } = useDataTable({
    data: accountExecutives.data?.items ?? [],
    columns,
    pageCount: accountExecutives.data?.pageCount ?? 1,
    initialState: {},
    getRowId: (row) => row.id,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table}>
        <div>
          <AddAccountExecutiveDialog />
        </div>
      </DataTableToolbar>
    </DataTable>
  );
}

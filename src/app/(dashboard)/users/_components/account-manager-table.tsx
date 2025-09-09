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
import { AddAccountManagerDialog } from "@/app/(dashboard)/users/_components/add-account-manager-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Icons } from "@/lib/icons";
import { EditAccountManagerDialog } from "@/app/(dashboard)/users/_components/edit-account-manager-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AccountManager =
  RouterOutputs["accountManager"]["getAllAccountManagers"]["items"][number];

export function AccountManagerTable() {
  const [page] = useQueryState("page", parseAsInteger.withDefault(1));
  const [perPage] = useQueryState("perPage", parseAsInteger.withDefault(10));

  const accountManagers = api.accountManager.getAllAccountManagers.useQuery({
    page,
    perPage,
  });

  const columns = React.useMemo<ColumnDef<AccountManager>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }: { column: Column<AccountManager, unknown> }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ cell }) => (
          <div>{cell.getValue<AccountManager["name"]>()}</div>
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
        header: ({ column }: { column: Column<AccountManager, unknown> }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ cell }) => (
          <div>{cell.getValue<AccountManager["email"]>()}</div>
        ),
        meta: {
          label: "Email",
        },
        enableColumnFilter: true,
        enableSorting: false,
      },
      {
        id: "isAmerican",
        accessorKey: "isAmerican",
        header: ({ column }: { column: Column<AccountManager, unknown> }) => (
          <DataTableColumnHeader column={column} title="American" />
        ),
        cell: ({ row }) => {
          const isAmerican = row.original.isAmerican as boolean;
          return (
            <Badge variant={isAmerican ? "secondary" : "outline"}>
              {isAmerican ? "American" : "International"}
            </Badge>
          );
        },
        meta: {
          label: "American",
        },
        enableColumnFilter: true,
        enableSorting: false,
      },
      {
        id: "commission",
        header: ({ column }: { column: Column<AccountManager, unknown> }) => (
          <DataTableColumnHeader column={column} title="Commission" />
        ),
        cell: ({ row }) => {
          const mgr = row.original as AccountManager;
          const pct = (n: number) =>
            `${(n * 100).toFixed(1).replace(/\.0$/, "")}\u0025`;
          const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                  {mgr.isAmerican ? (
                    <Badge variant="secondary">
                      American {pct(mgr.americanCommissionRate)}
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="secondary">
                        T1 {pct(mgr.tier1CommissionRate)}
                      </Badge>
                      <Badge variant="outline">
                        T2 {pct(mgr.tier2CommissionRate)}
                      </Badge>
                      <Badge variant="outline">
                        T3 {pct(mgr.tier3CommissionRate)}
                      </Badge>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="grid gap-1">
                  {mgr.isAmerican ? (
                    <div>American Rate: {pct(mgr.americanCommissionRate)}</div>
                  ) : (
                    <>
                      <div>
                        Tier 1: {pct(mgr.tier1CommissionRate)} up to{" "}
                        {dollars(mgr.tier1Threshold)}
                      </div>
                      <div>
                        Tier 2: {pct(mgr.tier2CommissionRate)} up to{" "}
                        {dollars(mgr.tier2Threshold)}
                      </div>
                      <div>
                        Tier 3: {pct(mgr.tier3CommissionRate)} at{" "}
                        {dollars(mgr.tier3Threshold)}+
                      </div>
                    </>
                  )}
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
                  <EditAccountManagerDialog accountManager={row.original} />
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
    data: accountManagers.data?.items ?? [],
    columns,
    pageCount: accountManagers.data?.pageCount ?? 1,
    initialState: {},
    getRowId: (row) => row.id,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table}>
        <div>
          <AddAccountManagerDialog />
        </div>
      </DataTableToolbar>
    </DataTable>
  );
}

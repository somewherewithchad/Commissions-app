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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Icons } from "@/lib/icons";
import { AccountExecutiveDialog } from "@/app/(dashboard)/users/_components/account-executive-dialog";

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
                  <DropdownMenuItem disabled>No Options</DropdownMenuItem>
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
          <AccountExecutiveDialog />
        </div>
      </DataTableToolbar>
    </DataTable>
  );
}

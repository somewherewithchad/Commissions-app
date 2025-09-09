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

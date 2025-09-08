import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDataTable } from "@/hooks/use-data-table";
import { Icons } from "@/lib/icons";
import { api } from "@/trpc/react";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import React from "react";
import { type RouterOutputs } from "@/trpc/react";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";

type RecruiterManager =
  RouterOutputs["recruitmentManager"]["getAllRecruiterManagers"]["items"][number];

export function RecruiterManagerTable() {
  const [page] = useQueryState("page", parseAsInteger.withDefault(1));
  const [perPage] = useQueryState("perPage", parseAsInteger.withDefault(10));

  const recruiterManagers =
    api.recruitmentManager.getAllRecruiterManagers.useQuery({
      page,
      perPage,
    });

  const columns = React.useMemo<ColumnDef<RecruiterManager>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }: { column: Column<RecruiterManager, unknown> }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ cell }) => (
          <div>{cell.getValue<RecruiterManager["name"]>()}</div>
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
        header: ({ column }: { column: Column<RecruiterManager, unknown> }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ cell }) => (
          <div>{cell.getValue<RecruiterManager["email"]>()}</div>
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
    data: recruiterManagers.data?.items ?? [],
    columns,
    pageCount: recruiterManagers.data?.pageCount ?? 1,
    initialState: {},
    getRowId: (row) => row.id,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

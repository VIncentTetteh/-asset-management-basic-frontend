"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";

export type { ColumnDef };

export interface PageInfo {
  /** 0-based page index. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  /** Server pagination; omit for small client-side lists. */
  pageInfo?: PageInfo;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: TData) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Right-hand slot of the footer, e.g. a page money total. */
  footerSummary?: React.ReactNode;
  className?: string;
}

/**
 * The standard list table: token-styled, enterprise-compact rows, sortable
 * headers, built-in loading skeletons, empty state, and server pagination.
 * Every list page renders one of these — bespoke tables are the exception
 * that needs a reason.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  pageInfo,
  onPageChange,
  onRowClick,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  footerSummary,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const showEmpty = !isLoading && data.length === 0;

  return (
    <div className={cn("overflow-hidden rounded-card border border-edge bg-surface", className)}>
      <div className="overflow-x-auto">
        <table className="ea-table w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-edge bg-surface-muted">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const dir = header.column.getIsSorted();
                  return (
                    <th key={header.id} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="ea-focus inline-flex items-center gap-1 rounded-sm hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : dir === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-b border-edge-subtle">
                    {columns.map((_, c) => (
                      <td key={c} className="px-3 py-2.5">
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "h-10 border-b border-edge-subtle last:border-b-0",
                      onRowClick && "cursor-pointer transition-colors hover:bg-surface-muted",
                    )}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {showEmpty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : null}
      </div>

      {(pageInfo || footerSummary) && !showEmpty ? (
        <div className="flex items-center justify-between border-t border-edge bg-surface-muted px-3 py-2 text-xs text-muted-fg">
          {pageInfo ? (
            <div className="flex items-center gap-3">
              <span>
                {pageInfo.totalElements === 0
                  ? "0 results"
                  : `${pageInfo.page * pageInfo.size + 1}–${Math.min(
                      (pageInfo.page + 1) * pageInfo.size,
                      pageInfo.totalElements,
                    )} of ${pageInfo.totalElements.toLocaleString()}`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={pageInfo.page === 0}
                  onClick={() => onPageChange?.(pageInfo.page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={pageInfo.page + 1 >= pageInfo.totalPages}
                  onClick={() => onPageChange?.(pageInfo.page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <span />
          )}
          {footerSummary ?? null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

import { AdminButton } from "@/components/admin/admin-button";
import { cn } from "@/lib/utils";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  accessor?: (row: T) => string | number;
  render: (row: T) => ReactNode;
};

export function AdminTable<T>({
  data,
  columns,
  pageSize = 8,
  emptyText = "Sem registros.",
}: {
  data: T[];
  columns: AdminTableColumn<T>[];
  pageSize?: number;
  emptyText?: string;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((col) => col.key === sort.key);
    if (!column?.accessor) return data;

    const list = [...data].sort((a, b) => {
      const av = column.accessor?.(a);
      const bv = column.accessor?.(b);
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (av > bv) return 1;
      return -1;
    });

    return sort.dir === "asc" ? list : list.reverse();
  }, [columns, data, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  function onSort(key: string) {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  return (
    <div className="admin-surface overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/6">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400", column.className)}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="inline-flex items-center gap-1 text-left"
                    >
                      {column.header}
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {visible.length > 0 ? (
              visible.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/6">
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3 text-sm text-slate-200", column.className)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <p className="text-xs text-slate-400">
          Página {safePage} de {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <AdminButton
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </AdminButton>
          <AdminButton
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
            <ChevronRight className="h-3.5 w-3.5" />
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
}

interface AdminTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  actions?: (item: T) => React.ReactNode;
  loading?: boolean;
}

export function AdminTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = "Search...",
  onSearch,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  actions,
  loading = false,
}: AdminTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, onSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input 
            placeholder={searchPlaceholder} 
            className="pl-10 bg-slate-900 border border-slate-800 text-slate-200 focus:ring-emerald-500/50 rounded-md w-full py-2 text-sm focus:outline-none focus:ring-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="bg-slate-950 [&_tr]:border-b">
              <tr className="border-slate-800 hover:bg-slate-900 transition-colors data-[state=selected]:bg-slate-800">
                {columns.map((col, idx) => (
                  <th key={idx} className="h-12 px-4 text-slate-400 font-medium align-middle [&:has([role=checkbox])]:pr-0">
                    {col.header}
                  </th>
                ))}
                {actions && <th className="h-12 px-4 text-right text-slate-400 align-middle [&:has([role=checkbox])]:pr-0">Actions</th>}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                 <tr>
                   <td colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-slate-500">
                     Loading...
                   </td>
                 </tr>
              ) : data.length > 0 ? (
                data.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors data-[state=selected]:bg-slate-800">
                    {columns.map((col, idx) => (
                      <td key={idx} className="p-4 align-middle text-slate-300 [&:has([role=checkbox])]:pr-0">
                        {col.cell ? col.cell(item) : (item[col.accessorKey as keyof T] as React.ReactNode)}
                      </td>
                    ))}
                    {actions && (
                      <td className="p-4 align-middle text-right [&:has([role=checkbox])]:pr-0">
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-slate-500">
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage <= 1}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 px-3 py-1.5 rounded-md text-sm disabled:opacity-50 flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </button>
        <span className="text-sm text-slate-500">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 px-3 py-1.5 rounded-md text-sm disabled:opacity-50 flex items-center"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

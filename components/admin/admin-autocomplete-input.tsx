"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

type Option = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  onSelect: (option: Option) => void;
  fetchOptions?: (query: string) => Promise<Option[]>;
  localOptions?: Option[];
  minChars?: number;
  onQueryChange?: (value: string) => void;
};

export function AdminAutocompleteInput({
  label,
  placeholder = "Digite para buscar...",
  onSelect,
  fetchOptions,
  localOptions,
  minChars = 2,
  onQueryChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Option[]>([]);

  const filteredLocal = useMemo(() => {
    if (!localOptions) return [];
    const safe = query.trim().toLowerCase();
    if (safe.length < minChars) return [];
    return localOptions
      .filter((item) => `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(safe))
      .slice(0, 12);
  }, [localOptions, minChars, query]);

  useEffect(() => {
    const safe = query.trim();
    if (safe.length < minChars) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (localOptions) {
      setResults(filteredLocal);
      setOpen(true);
      return;
    }

    if (!fetchOptions) return;

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const items = await fetchOptions(safe);
      if (cancelled) return;
      setResults(items);
      setOpen(true);
      setLoading(false);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchOptions, filteredLocal, localOptions, minChars, query]);

  return (
    <div className="relative">
      {label ? <p className="mb-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p> : null}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onQueryChange?.(event.target.value);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-500"
        />
        {query ? (
          <button type="button" onClick={() => { setQuery(""); setOpen(false); setResults([]); }} className="rounded p-0.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#081423] shadow-xl">
          {loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
          {!loading && results.length === 0 ? <p className="px-3 py-2 text-xs text-slate-500">Nenhum resultado.</p> : null}
          {!loading && results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item);
                setQuery(item.title);
                setOpen(false);
              }}
              className="block w-full border-b border-slate-100 dark:border-white/5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
              {item.subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

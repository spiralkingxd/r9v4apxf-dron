"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { label: "Todos", value: "" },
  { label: "Publicados", value: "published" },
  { label: "Ativos", value: "active" },
  { label: "Pausados", value: "paused" },
  { label: "Finalizados", value: "finished" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

export function EventStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("status") ?? "") as FilterValue;

  function handleFilter(value: FilterValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    const query = params.toString();
    router.push(`/events${query ? `?${query}` : ""}`);
  }

  return (
    <div role="tablist" aria-label="Filtrar eventos por status" className="flex flex-wrap gap-2">
      {FILTERS.map(({ label, value }) => (
        <button
          key={value}
          role="tab"
          aria-selected={current === value}
          onClick={() => handleFilter(value)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
            current === value
              ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

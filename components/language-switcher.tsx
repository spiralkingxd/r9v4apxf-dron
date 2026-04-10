"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { toggleLocale } from "@/app/actions/i18n";

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => { toggleLocale(); })}
      disabled={isPending}
      title="Trocar idioma / Change language"
      className="topbar-icon-btn relative rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
    >
      <Languages className="h-5 w-5" />
    </button>
  );
}

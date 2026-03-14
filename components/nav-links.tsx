"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/events", label: "Torneios" },
  { href: "/teams", label: "Equipes" },
  { href: "/ranking", label: "Ranking" },
];

export function NavLinks() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const linkCls = (href: string) =>
    cn(
      "rounded-lg px-3.5 py-2 text-sm font-medium transition",
      isActive(href)
        ? "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        : "text-slate-400 hover:bg-white/8 hover:text-slate-100",
    );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-0.5 md:flex">
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className={linkCls(href)}>
            {label}
          </Link>
        ))}
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-cyan-300/10 hover:text-cyan-100 md:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute inset-x-0 top-[72px] z-50 border-b border-white/10 bg-[#050b12]/96 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(linkCls(href), "py-3 text-base")}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

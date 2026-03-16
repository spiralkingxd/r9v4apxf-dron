"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";



export function NavLinks({ dict }: { dict: any }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const LINKS = [
    { href: "/", label: dict?.navlinks?.home ?? "Início" },
    { href: "/events", label: dict?.navlinks?.events ?? "Torneios" },
    {
      label: dict?.navlinks?.teams ?? "Equipes",
      isDropdown: true,
      children: [
        { href: "/teams", label: dict?.navlinks?.viewTeams ?? "Ver Equipes" },
        { href: "/my-team", label: dict?.navlinks?.myTeams ?? "Minhas Equipes" },
        { href: "/regras", label: dict?.navlinks?.rules ?? "Regras" },
      ],
    },
    { href: "/ranking", label: dict?.navlinks?.ranking ?? "Ranking" },
    { href: "/transmissoes", label: dict?.navlinks?.streams ?? "Transmissões" },
  ];

  function isActive(href: string) {
    if (!href) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const linkCls = (href: string | undefined, hasFocus: boolean = false) =>
    cn(
      "rounded-lg px-3.5 py-2 text-sm font-medium transition",
      hasFocus || (href && isActive(href))
        ? "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        : "text-slate-400 hover:bg-white/8 hover:text-slate-100",
    );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-0.5 md:flex">
        {LINKS.map((item) => {
          if (item.isDropdown) {
            const hasActiveChild = item.children?.some(c => c.href && isActive(c.href));
            return (
              <div key={item.label} className="relative group p-1">
                <button
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                    hasActiveChild
                      ? "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                      : "text-slate-400 hover:bg-white/8 hover:text-slate-100 border border-transparent"
                  )}
                >
                  {item.label}
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                </button>
                <div className="absolute top-[80%] left-0 pt-2 w-48 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">
                  <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-[#050b12]/95 backdrop-blur-xl p-2 shadow-xl shadow-black/50">
                    {item.children?.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-slate-100 transition"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={item.href} className="p-1">
              <Link href={item.href as string} className={linkCls(item.href)}>
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:cyan-300/10 hover:text-cyan-100 md:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute inset-x-0 top-[72px] z-50 border-b border-white/10 bg-[#050b12]/96 backdrop-blur-xl md:hidden max-h-[calc(100vh-72px)] overflow-y-auto">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {LINKS.map((item) => {
              if (item.isDropdown) {
                return (
                  <div key={item.label} className="flex flex-col gap-1 py-2">
                    <span className="px-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {item.label}
                    </span>
                    {item.children?.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className={cn(linkCls(child.href), "py-3 text-base pl-6")}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href as string}
                  onClick={() => setOpen(false)}
                  className={cn(linkCls(item.href), "py-3 text-base")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}

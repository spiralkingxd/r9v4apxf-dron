"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";



type NavDict = {
  navlinks?: {
    home?: string;
    events?: string;
    rules?: string;
    teams?: string;
    ranking?: string;
    streams?: string;
  };
};

export function NavLinks({ dict }: { dict: NavDict }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const LINKS = [
    { href: "/", label: dict?.navlinks?.home ?? "Início" },
    { href: "/events", label: dict?.navlinks?.events ?? "Torneios" },
    { href: "/regras", label: dict?.navlinks?.rules ?? "Regras" },
    { href: "/teams", label: dict?.navlinks?.teams ?? "Equipes" },
    { href: "/ranking", label: dict?.navlinks?.ranking ?? "Ranking" },
    { href: "/transmissoes", label: dict?.navlinks?.streams ?? "Transmissões" },
  ];

  function isActive(href: string) {
    if (!href) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const linkCls = (href: string | undefined, hasFocus: boolean = false) =>
    cn(
      "nav-link",
      hasFocus || (href && isActive(href))
        ? "nav-link-active border border-cyan-300/25"
        : "border border-transparent",
    );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-0.5 md:flex">
        {LINKS.map((item) => (
          <div key={item.href} className="p-1">
            <Link href={item.href as string} className={linkCls(item.href)}>
              {item.label}
            </Link>
          </div>
        ))}
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="topbar-menu-btn rounded-lg border border-white/10 p-2 text-slate-400 transition md:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="topbar-mobile-dropdown absolute inset-x-0 top-[72px] z-50 border-b border-white/10 bg-[#050b12]/96 backdrop-blur-xl md:hidden max-h-[calc(100vh-72px)] overflow-y-auto">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {LINKS.map((item) => {
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
            
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 md:hidden">
              <span className="text-sm font-medium text-slate-400">Preferências</span>
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Ban,
  Bell,
  Calendar,
  Crown,
  Menu,
  Settings,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/admin/tournaments", label: "Torneios", icon: <Trophy className="h-4 w-4" /> },
  { href: "/admin/members", label: "Membros", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/bans", label: "Banimentos", icon: <Ban className="h-4 w-4" /> },
  { href: "/admin/teams", label: "Equipes", icon: <Shield className="h-4 w-4" /> },
  { href: "/admin/events", label: "Eventos", icon: <Calendar className="h-4 w-4" /> },
  { href: "/admin/matches", label: "Partidas", icon: <Swords className="h-4 w-4" /> },
  { href: "/admin/results", label: "Resultados", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/admin/notifications", label: "Notificações", icon: <Bell className="h-4 w-4" /> },
  { href: "/admin/rankings", label: "Rankings", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/admin/settings", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
  { href: "/admin/logs", label: "Logs", icon: <Shield className="h-4 w-4" /> },
  { href: "/admin/backup", label: "Backup", icon: <Crown className="h-4 w-4" /> },
];

export function AdminShell({
  children,
  displayName,
  role,
}: {
  children: ReactNode;
  displayName: string;
  role: "admin" | "owner";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto flex w-full max-w-[1400px] gap-0 xl:px-4">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-[#081426]/95 p-4 backdrop-blur-md transition-transform xl:sticky xl:top-0 xl:h-screen xl:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-4 flex items-center justify-between xl:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Admin</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-6 hidden xl:block">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/90">MadnessArena</p>
            <h2 className="mt-2 text-lg font-bold text-white">Painel Admin</h2>
          </div>

          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#081426]/85 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Abrir menu"
                  className="rounded-lg border border-white/10 bg-white/5 p-2 xl:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin Area</p>
                  <h1 className="text-sm font-semibold text-white">Gestão da Arena</h1>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-1.5">
                <Crown className="h-4 w-4 text-amber-300" />
                <span className="text-sm text-amber-100">{displayName}</span>
                <span className="rounded-full border border-amber-300/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                  {role === "owner" ? "Owner" : "Admin"}
                </span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

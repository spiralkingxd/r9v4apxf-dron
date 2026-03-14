"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Ban,
  Bell,
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
    <div className="admin-shell-bg">
      <div className="mx-auto flex w-full max-w-[1400px] gap-0 xl:px-4">
        <aside
          className={cn(
            "admin-surface fixed inset-y-0 left-0 z-50 w-72 border-r p-4 transition-transform xl:sticky xl:top-0 xl:h-screen xl:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-4 flex items-center justify-between xl:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent-cyan)]">Admin</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-6 hidden xl:block">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-muted)]">MadnessArena</p>
            <h2 className="mt-2 text-lg font-bold text-[color:var(--text-strong)]">Painel Admin</h2>
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
                    "admin-nav-item flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition",
                    active && "admin-nav-active"
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
          <header className="admin-surface sticky top-0 z-40 border-b">
            <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Abrir menu"
                  className="rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] p-2 text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)] xl:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Admin Area</p>
                  <h1 className="text-sm font-semibold text-[color:var(--text-strong)]">Gestão da Arena</h1>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--accent-amber)]/25 bg-[color:var(--accent-amber)]/10 px-3 py-1.5 backdrop-blur-sm">
                <Crown className="h-4 w-4 text-[color:var(--accent-amber)]" />
                <span className="text-sm font-medium" style={{ color: "var(--accent-amber)" }}>{displayName}</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}>
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

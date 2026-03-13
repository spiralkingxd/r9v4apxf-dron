"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Gamepad2, LogOut, Shield, User } from "lucide-react";

import { logout } from "@/app/auth/login/actions";
import { useUserRole, type UserRole } from "@/lib/hooks/use-user-role";
import { cn } from "@/lib/utils";

type Props = {
  nickname: string;
  username?: string | null;
  avatarUrl?: string | null;
  xboxGamertag?: string | null;
  teamsCount: number;
  role?: UserRole;
};

export function UserDropdown({
  nickname,
  username,
  avatarUrl,
  xboxGamertag,
  teamsCount,
  role,
}: Props) {
  const { isAdmin } = useUserRole(role);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!open) return;
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    }
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir menu do usuario"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
      >
        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={nickname} fill sizes="28px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-cyan-200">
              {nickname.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="hidden max-w-[130px] truncate sm:inline">{nickname}</span>
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>

      <div
        ref={panelRef}
        role="menu"
        aria-label="Menu do usuario"
        className={cn(
          "absolute right-0 top-[calc(100%+8px)] z-50 w-[min(92vw,290px)] origin-top-right rounded-2xl border border-white/10 bg-[#0b1726]/95 p-2 text-sm shadow-2xl shadow-black/50 backdrop-blur transition",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0",
        )}
      >
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={nickname} fill sizes="40px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-cyan-200">
                  {nickname.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-100">{nickname}</p>
              {username ? <p className="truncate text-xs text-slate-400">@{username}</p> : null}
              {xboxGamertag ? (
                <p className="mt-1 inline-flex items-center gap-1 truncate text-xs text-emerald-200">
                  <Gamepad2 className="h-3 w-3" />
                  {xboxGamertag}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="my-2 h-px bg-white/10" />

        <nav className="space-y-1" aria-label="Acoes do usuario">
          {isAdmin ? (
            <Link
              href="/admin/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-amber-100 transition hover:bg-amber-300/15"
            >
              <Shield className="h-4 w-4" />
              Painel Admin
            </Link>
          ) : null}

          <Link
            href="/profile/me#teams"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-100 transition hover:bg-white/10"
          >
            <Gamepad2 className="h-4 w-4" />
            Minhas Equipes ({teamsCount}/3)
          </Link>

          <Link
            href="/profile/me"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-100 transition hover:bg-white/10"
          >
            <User className="h-4 w-4" />
            Perfil
          </Link>

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-100 transition hover:bg-rose-300/15"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";

import { logout } from "@/app/auth/login/actions";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/nav-links";
import { upsertProfileFromOAuth } from "@/lib/auth/profile";

type ProfileNavbarRow = {
  display_name: string;
  username: string;
  avatar_url: string | null;
  role: "user" | "admin";
};

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: ProfileNavbarRow | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;

    if (!profile) {
      await upsertProfileFromOAuth();

      const { data: syncedProfile } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle();

      profile = syncedProfile;
    }
  }

  let teamsCount = 0;
  if (user) {
    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "captain");

    teamsCount = count ?? 0;
  }

  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;
  const nickname = profile?.display_name ?? profile?.username ?? user?.email ?? "Jogador";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050b12]/90 backdrop-blur">
      <div className="relative mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">

        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 text-sm font-bold uppercase tracking-[0.3em] text-cyan-200 transition hover:text-cyan-100"
        >
          MadnessArena
        </Link>

        {/* Nav links — desktop inline / mobile toggle */}
        <NavLinks />

        {/* Auth area */}
        {!user ? (
          <Link
            href="/auth/login"
            className="shrink-0 inline-flex items-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Login com Discord
          </Link>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {profile?.role === "admin" && (
              <Link
                href="/admin/dashboard"
                className="hidden rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/20 sm:inline-flex"
              >
                Painel Admin
              </Link>
            )}
            <Link
              href="/profile/me#teams"
              className="hidden rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 sm:inline-flex"
            >
              Minhas Equipes ({teamsCount}/3)
            </Link>
            <Link
              href="/profile/me"
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
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Sair
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
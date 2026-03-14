import Link from "next/link";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserDropdown } from "@/components/user-dropdown";
import { upsertProfileFromOAuth } from "@/lib/auth/profile";

type ProfileNavbarRow = {
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
  role: "user" | "admin" | "owner";
};

const PROFILE_SELECT = "display_name, username, avatar_url, xbox_gamertag, role";

export async function Navbar() {
  if (!isSupabaseConfigured()) {
    return (
      <header className="site-topbar sticky top-0 z-50">
        <div className="relative mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
          <Link
            href="/"
            className="shrink-0 text-sm font-bold uppercase tracking-[0.3em] text-cyan-200 transition hover:text-cyan-100"
          >
            MadnessArena
          </Link>

          <NavLinks />

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link href="/auth/login" className="action-primary inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition">
              Login com Discord
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));

  if (!hasAuthCookie) {
    return (
      <header className="site-topbar sticky top-0 z-50">
        <div className="relative mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
          <Link
            href="/"
            className="shrink-0 text-sm font-bold uppercase tracking-[0.3em] text-cyan-200 transition hover:text-cyan-100"
          >
            MadnessArena
          </Link>

          <NavLinks />

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link href="/auth/login" className="action-primary inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition">
              Login com Discord
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: ProfileNavbarRow | null = null;
  let teamsCount = 0;

  if (user) {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    profile = data;
    teamsCount = count ?? 0;

    if (!profile) {
      await upsertProfileFromOAuth();

      const { data: syncedProfile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle();

      profile = syncedProfile;
    }
  }

  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;
  const nickname = profile?.display_name ?? profile?.username ?? user?.email ?? "Jogador";

  return (
    <header className="site-topbar sticky top-0 z-50">
      <div className="relative mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
        <Link
          href="/"
          className="shrink-0 text-sm font-bold uppercase tracking-[0.3em] text-cyan-200 transition hover:text-cyan-100"
        >
          MadnessArena
        </Link>

        <NavLinks />

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {!user ? (
            <Link href="/auth/login" className="action-primary inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold transition">
              Login com Discord
            </Link>
          ) : (
            <UserDropdown
              nickname={nickname}
              username={profile?.username ?? null}
              avatarUrl={avatarUrl}
              xboxGamertag={profile?.xbox_gamertag ?? null}
              teamsCount={teamsCount}
              role={profile?.role}
            />
          )}
        </div>
      </div>
    </header>
  );
}
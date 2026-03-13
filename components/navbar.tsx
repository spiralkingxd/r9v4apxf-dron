import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/nav-links";
import { UserDropdown } from "@/components/user-dropdown";
import { upsertProfileFromOAuth } from "@/lib/auth/profile";

type ProfileNavbarRow = {
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
  role: "user" | "admin" | "owner";
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
      .select("display_name, username, avatar_url, xbox_gamertag, role")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;

    if (!profile) {
      await upsertProfileFromOAuth();

      const { data: syncedProfile } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, xbox_gamertag, role")
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
      .eq("user_id", user.id);

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
            <UserDropdown
              nickname={nickname}
              username={profile?.username ?? null}
              avatarUrl={avatarUrl}
              xboxGamertag={profile?.xbox_gamertag ?? null}
              teamsCount={teamsCount}
              role={profile?.role}
            />
          </div>
        )}
      </div>
    </header>
  );
}
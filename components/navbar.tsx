import Link from "next/link";
import { cookies } from "next/headers";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { UserDropdown } from "@/components/user-dropdown";
import { UserDropdownSkeleton } from "@/components/user-dropdown-skeleton";
import { upsertProfileFromOAuth } from "@/lib/auth/profile";
import { NavbarShell } from "@/components/navbar-shell";

import { NotificationsBell } from "@/components/notifications-bell";

import { LanguageSwitcher } from "@/components/language-switcher";

type ProfileNavbarRow = {
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
  role: "user" | "admin" | "owner";
};

const PROFILE_SELECT =
  "display_name, username, avatar_url, xbox_gamertag, role";

async function UserSection() {
  try {
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

    const avatarUrl =
      profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;
    const nickname =
      profile?.display_name ?? profile?.username ?? user?.email ?? "Jogador";

    if (!user) {
      return (
        <Link
          href="/auth/login"
          className="action-primary inline-flex items-center rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition"
        >
          <span className="sm:hidden">Login</span>
          <span className="hidden sm:inline">Login com Discord</span>
        </Link>
      );
    }

    return (
      <UserDropdown
        nickname={nickname}
        username={profile?.username ?? null}
        avatarUrl={avatarUrl}
        xboxGamertag={profile?.xbox_gamertag ?? null}
        teamsCount={teamsCount}
        role={profile?.role}
      />
    );
  } catch (error) {
    console.error("[navbar-user-section] fallback due to server error", error);
    return (
      <Link
        href="/auth/login"
        className="action-primary inline-flex items-center rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition"
      >
        <span className="sm:hidden">Login</span>
        <span className="hidden sm:inline">Login com Discord</span>
      </Link>
    );
  }
}

export async function Navbar() {
  const dict = await getDictionary();
  const isConfigured = isSupabaseConfigured();

  let hasAuthCookie = false;
  
  if (isConfigured) {
    const cookieStore = await cookies();
    hasAuthCookie = cookieStore
      .getAll()
      .some((cookie) => cookie.name.includes("-auth-token"));
  }

  return (
    <NavbarShell>
      <div className="relative mx-auto flex h-[72px] w-full max-w-[1920px] items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="shrink-0 text-[13px] sm:text-[15px] md:text-base font-black uppercase tracking-[0.15em] sm:tracking-[0.25em] bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent transition-transform hover:scale-[1.03] drop-shadow-sm"
        >
          Madness Arena
        </Link>

        <NavLinks dict={dict} />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <GlobalSearch dict={dict} /> 
          <div className="hidden md:flex items-center gap-1">
            <LanguageSwitcher /> 
            <ThemeToggle />
          </div>

          {!isConfigured ? (
            <Link
              href="/auth/login"
              className="action-primary inline-flex items-center rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition"
            >
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Login com Discord</span>
            </Link>
          ) : hasAuthCookie ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <NotificationsBell />
              <Suspense fallback={<UserDropdownSkeleton />}>
                <UserSection />
              </Suspense>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="action-primary inline-flex items-center rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition"
            >
              <span className="sm:hidden">Login</span>
              <span className="hidden sm:inline">Login com Discord</span>
            </Link>
          )}
        </div>
      </div>
    </NavbarShell>
  );
}

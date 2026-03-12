import Image from "next/image";
import Link from "next/link";

import { logout } from "@/app/auth/login/actions";
import { createClient } from "@/lib/supabase/server";

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
  }

  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;
  const nickname = profile?.display_name ?? profile?.username ?? user?.email ?? "Jogador";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050b12]/85 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
          MadnessArena
        </Link>

        {!user ? (
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Login com Discord
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            {profile?.role === "admin" ? (
              <Link
                href="/admin/dashboard"
                className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/20"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/profile/me"
              className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              <span className="relative h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/10">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={nickname} fill sizes="32px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold text-cyan-200">
                    {nickname.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="max-w-[170px] truncate">{nickname}</span>
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
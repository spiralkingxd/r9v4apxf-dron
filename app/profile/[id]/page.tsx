import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, UserRound } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

type PublicProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
  created_at: string;
};

type Props = { params: Promise<{ id: string }> };

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, xbox_gamertag, created_at")
    .eq("id", id)
    .maybeSingle<PublicProfile>();

  if (!profile) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] px-4 py-14 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Link
          href="/teams"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
        >
          ← Voltar para equipes
        </Link>

        <section className="rounded-3xl border border-white/10 bg-slate-900/65 p-8 shadow-2xl shadow-black/35">
          <div className="flex flex-wrap items-center gap-5">
            <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <UserRound className="h-7 w-7 text-slate-400" />
              )}
            </span>

            <div>
              <h1 className="text-2xl font-bold text-white">{profile.display_name}</h1>
              <p className="text-sm text-slate-400">@{profile.username}</p>
              {profile.xbox_gamertag ? (
                <p className="mt-1 text-sm text-cyan-300">Xbox: {profile.xbox_gamertag}</p>
              ) : null}
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Na arena desde {new Date(profile.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

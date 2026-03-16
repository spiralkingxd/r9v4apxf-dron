import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Trophy, Target, Clock, AtSign, Crown, Shield } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { XboxStatusTag } from "@/components/xbox-status-tag";
import { getDictionary } from "@/lib/i18n";

type PublicProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
  custom_status: string | null;
  boat_role: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  rankings?: {
    wins: number;
    points: number;
  }[];
};

type Props = { params: Promise<{ id: string }> };

export default async function PublicProfilePage({ params }: Props) {
  const dict = await getDictionary();
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, xbox_gamertag, custom_status, boat_role, role, created_at, updated_at, rankings(wins, points)")
    .eq("id", id)
    .maybeSingle<PublicProfile>();

  if (!profile) {
    notFound();
  }

  const memberSince = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(profile.created_at));

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[radial-gradient(ellipse_at_top,_#0f2847_0%,_#0b1826_50%,_#050b12_100%)] px-4 py-14 text-slate-900 dark:text-slate-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 transition hover:text-slate-900 dark:hover:text-slate-200"
        >
          {dict.profile.backHome}
        </Link>

        <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/70 shadow-xl dark:shadow-2xl dark:shadow-black/40 backdrop-blur-sm">
          {/* Gold accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />
          
          {/* Avatar + Name header */}
          <div className="flex flex-col items-center gap-4 px-8 pb-8 pt-10">
            {/* Avatar with golden ring */}
            <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-yellow-400/70 ring-offset-2 ring-offset-slate-900 shadow-[0_0_32px_rgba(250,204,21,0.20)] bg-slate-200 dark:bg-slate-800">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Display name */}
            <h1 className="text-2xl font-bold tracking-wide text-slate-900 dark:text-white flex flex-col items-center">
              <span className="flex items-center gap-2">
                {profile.display_name}
                {profile.role === "owner" && (
                  <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                )}
                {profile.role === "admin" && (
                  <Shield className="h-6 w-6 text-cyan-500 fill-cyan-500" />
                )}
              </span>
              {profile.custom_status && (
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {profile.custom_status}
                </span>
              )}
            </h1>

            {/* Xbox status and Boat Role */}
            <div className="flex gap-4 items-center">
              <XboxStatusTag gamertag={profile.xbox_gamertag} />
              {profile.boat_role && profile.boat_role !== "nenhuma" && (
                  <div className="flex flex-wrap gap-2">
                    {profile.boat_role.split(',').map((r) => r.trim()).map((role) => (
                      <span key={role} className="px-3 py-1 rounded-full bg-blue-100 dark:bg-[#1a2b4b] text-blue-800 dark:text-blue-300 text-xs font-semibold capitalize border border-blue-200 dark:border-blue-800/50 shadow-sm">
                        {role}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent" />
          
          {/* Info grid - Top Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5 border-b border-slate-200 dark:border-white/5">
            <InfoCard icon={<AtSign className="h-4 w-4 text-cyan-400" />} label="Username">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">@{profile.username}</span>
            </InfoCard>

            <InfoCard icon={<Calendar className="h-4 w-4 text-cyan-400" />} label={dict.profile.memberSince}>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{memberSince}</span>
            </InfoCard>

            <InfoCard icon={<Clock className="h-4 w-4 text-cyan-400" />} label={dict.profile.lastActivity}>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {profile.updated_at ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(profile.updated_at)) : "--"}
              </span>
            </InfoCard>
          </div>

          {/* Info grid - Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-white/5">
            <InfoCard icon={<Target className="h-4 w-4 text-emerald-400" />} label={dict.profile.leaguePoints}>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.rankings?.[0]?.points || 0}</span>
            </InfoCard>

            <InfoCard icon={<Trophy className="h-4 w-4 text-amber-400" />} label={dict.profile.tournamentsWon}>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.rankings?.[0]?.wins || 0}</span>
            </InfoCard>
          </div>

          <div className="pb-8" />
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

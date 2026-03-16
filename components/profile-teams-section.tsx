"use client";

import { useEffect, useMemo, useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Anchor, Plus, Shield, Swords, Users } from "lucide-react";

import { CreateTeamModal } from "@/components/create-team-modal";

type UserTeamCard = {
  id: string;
  name: string;
  logo_url: string | null;
  role: "captain" | "member";
  joined_at: string;
  member_count: number;
  max_members: number;
};

type Props = { dict?: any;
  userId: string;
  userXboxGamertag: string | null;
  teams: UserTeamCard[];
  teamsError?: string | null; systemMaxMembers?: number;
};

const teamDateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium" });

function ProfileTeamsContent({ userId, userXboxGamertag, teams, teamsError, systemMaxMembers = 10, dict }: Props) {
  const [open, setOpen] = useState(false);
  const [isLaunching, startTransition] = useTransition();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("action") === "new-team") {
      setOpen(true);
    }
  }, [searchParams]);

  const teamsCount = teams.length;
  const reachedLimit = teamsCount >= 1;

  const orderedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        const roleA = a.role === "captain" ? 0 : 1;
        const roleB = b.role === "captain" ? 0 : 1;
        if (roleA !== roleB) return roleA - roleB;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      }),
    [teams],
  );

  return (
    <section id="teams" className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-6 shadow-xl dark:shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <Shield className="h-5 w-5 text-amber-400" />
          Minhas Equipes
        </h2>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Equipes ({teamsCount}/1)
          </span>
          <button
            type="button"
            title={reachedLimit ? (dict?.teams?.teamLimitReached || "Você já participa de uma equipe") : (dict?.teams?.createTeam || "Fundar nova equipe")}
            disabled={reachedLimit || isLaunching}
            onClick={() => {
              startTransition(() => setOpen(true));
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {isLaunching ? "..." : (dict?.teams?.createTeam || "Fundar nova equipe")}
          </button>
        </div>
      </div>

      {teamsError ? (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
          {teamsError}
        </p>
      ) : null}

      {orderedTeams.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orderedTeams.map((team) => {
            const isCaptain = team.role === "captain";
            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/4 p-4 transition hover:border-amber-400/50 dark:hover:border-amber-400/30 hover:bg-amber-50 dark:hover:bg-amber-400/6"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5"> {team.logo_url ? ( <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain bg-black/10 dark:bg-black/40" /> ) : ( <Anchor className="h-5 w-5 text-amber-400/70" /> )} </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white">
                      {team.name}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        isCaptain
                          ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                          : "border-slate-300 dark:border-slate-300/20 bg-slate-100 dark:bg-slate-300/10 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {isCaptain ? "Capitão" : "Membro"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Swords className="h-3.5 w-3.5" />
                    Entrada: {teamDateFmt.format(new Date(team.joined_at))}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {team.member_count}/{team.max_members}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/2 px-5 py-10 text-center">
          <Shield className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Você não participa de nenhuma equipe ainda
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Funde sua própria tripulação ou junte-se a uma equipe existente para competir.
          </p>
        </div>
      )}

      {open ? <CreateTeamModal dict={dict} userId={userId} userXboxGamertag={userXboxGamertag} hasReachedTeamLimit={reachedLimit} onClose={() => setOpen(false)} systemMaxMembers={systemMaxMembers} /> : null}
    </section>
  );
}

export function ProfileTeamsSection(props: Props) {
  return (
    <Suspense fallback={<div className="h-40 rounded-3xl md:col-span-2 xl:col-span-3 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-6 flex items-center justify-center">Carregando equipes...</div>}>
      <ProfileTeamsContent {...props} />
    </Suspense>
  );
}


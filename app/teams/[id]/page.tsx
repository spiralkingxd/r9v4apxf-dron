import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Anchor, Calendar, Crown, Scroll, Users } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type TeamDetailRow = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_id: string;
  created_at: string;
};

type MemberRow = {
  profile_id: string;
  joined_at: string;
};

type RegistrationRow = {
  id: string;
  status: string;
  created_at: string;
  event_id: string;
  event_title: string;
  event_status: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  draft: "Em breve",
  finished: "Finalizado",
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

type Props = { params: Promise<{ id: string }> };

export default async function TeamDetailPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    notFound();
  }

  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, logo_url, captain_id, created_at")
    .eq("id", id)
    .single<TeamDetailRow>();

  if (!team) notFound();

  const { data: members } = await supabase
    .from("team_members")
    .select("profile_id, joined_at")
    .eq("team_id", id)
    .order("joined_at", { ascending: true });

  // Fetch event registrations for this team
  const { data: registrationsRaw } = await supabase
    .from("registrations")
    .select("id, status, created_at, event_id, events(id, title, status)")
    .eq("team_id", id)
    .order("created_at", { ascending: false });

  const registrations: RegistrationRow[] = (registrationsRaw ?? []).map((r) => {
    const ev = Array.isArray(r.events) ? r.events[0] : r.events;
    return {
      id: r.id as string,
      status: r.status as string,
      created_at: r.created_at as string,
      event_id: (ev as { id: string } | null)?.id ?? (r.event_id as string),
      event_title: (ev as { title: string } | null)?.title ?? "Evento desconhecido",
      event_status: (ev as { status: string } | null)?.status ?? "",
    };
  });

  const memberList = (members ?? []) as MemberRow[];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10 lg:px-10">

        {/* Back */}
        <Link href="/teams" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200">
          ← Todas as equipes
        </Link>

        {/* Team header */}
        <section className="rounded-[2rem] border border-white/10 bg-white/4 p-8">
          <div className="flex flex-wrap items-start gap-6">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              {team.logo_url ? (
                <Image
                  src={team.logo_url}
                  alt={team.name}
                  width={80}
                  height={80}
                  className="rounded-2xl object-cover"
                />
              ) : (
                <Anchor className="h-8 w-8 text-amber-400/70" />
              )}
            </span>
            <div>
              <h1 className="text-3xl font-bold text-white">{team.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                Fundada em {fmt.format(new Date(team.created_at))}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-2.5">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-slate-300">
                {memberList.length} membro{memberList.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-2.5">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-slate-300">Capitão registrado</span>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Members */}
          <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Users className="h-5 w-5 text-cyan-400" />
              Tripulação
            </h2>

            {memberList.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {memberList.map((member) => (
                  <li
                    key={member.profile_id}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-300">
                        {member.profile_id === team.captain_id ? (
                          <Crown className="h-4 w-4 text-amber-400" />
                        ) : (
                          <Anchor className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {member.profile_id.slice(0, 8)}…
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {fmt.format(new Date(member.joined_at))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                Nenhum membro registrado ainda.
              </p>
            )}
          </section>

          {/* Event history */}
          <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Scroll className="h-5 w-5 text-amber-400" />
              Histórico de Torneios
            </h2>

            {registrations.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {registrations.map((reg) => (
                  <li
                    key={reg.id}
                    className="rounded-xl border border-white/8 bg-white/4 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/events/${reg.event_id}`}
                        className="text-sm font-medium text-slate-100 hover:text-amber-300"
                      >
                        {reg.event_title}
                      </Link>
                      <RegistrationBadge status={reg.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{EVENT_STATUS_LABELS[reg.event_status] ?? reg.event_status}</span>
                      <span>·</span>
                      <span>{fmt.format(new Date(reg.created_at))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                Esta equipe ainda não participou de nenhum torneio.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function RegistrationBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : status === "rejected" || status === "cancelled"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
        : "border-amber-400/30 bg-amber-400/10 text-amber-300";

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

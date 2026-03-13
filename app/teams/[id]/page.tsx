import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Anchor, Calendar, Crown, Scroll, Users } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { JoinRequestHistoryItem, JoinRequestPendingItem, JoinRequestUser } from "@/components/join-request-list";
import { JoinRequestButton } from "@/components/join-request-button";
import { TeamManageButton } from "@/components/team-manage-button";

type TeamDetailRow = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_id: string;
  max_members: number;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: "captain" | "member";
  joined_at: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserTeamCount = 0;
  if (user?.id) {
    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    currentUserTeamCount = count ?? 0;
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, logo_url, captain_id, max_members, created_at")
    .eq("id", id)
    .single<TeamDetailRow>();

  if (!team) notFound();

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, role, joined_at, profiles(display_name, username, avatar_url, xbox_gamertag)")
    .eq("team_id", id)
    .order("joined_at", { ascending: true });

  // Busca o histórico de inscrições desta equipe em eventos.
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

  const memberList: MemberRow[] = (members ?? []).map((member) => {
    const profileData = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;

    return {
      user_id: member.user_id as string,
      role: member.role as "captain" | "member",
      joined_at: member.joined_at as string,
      display_name:
        (profileData as { display_name?: string } | null)?.display_name ?? "Usuário",
      username:
        (profileData as { username?: string } | null)?.username ?? "desconhecido",
      avatar_url:
        ((profileData as { avatar_url?: string | null } | null)?.avatar_url as string | null) ??
        null,
      xbox_gamertag:
        ((profileData as { xbox_gamertag?: string | null } | null)?.xbox_gamertag as
          | string
          | null) ?? null,
    };
  });

  const isCaptain = Boolean(user?.id && user.id === team.captain_id);
  const isMember = Boolean(user?.id && memberList.some((member) => member.user_id === user.id));
  const captain = memberList.find((member) => member.role === "captain") ?? null;

  let pendingRequestsForCaptain: JoinRequestPendingItem[] = [];
  let historyRequestsForCaptain: JoinRequestHistoryItem[] = [];

  let hasPendingRequest = false;
  let pendingRequestId: string | null = null;
  if (user?.id && !isMember && !isCaptain) {
    const { data: pending } = await supabase
      .from("team_join_requests")
      .select("id")
      .eq("team_id", team.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    hasPendingRequest = Boolean(pending);
    pendingRequestId = (pending?.id as string | undefined) ?? null;
  }

  if (isCaptain) {
    const { data: pendingRaw } = await supabase
      .from("team_join_requests")
      .select("id, team_id, user_id, status, created_at")
      .eq("team_id", team.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const { data: historyRaw } = await supabase
      .from("team_join_requests")
      .select("id, team_id, user_id, status, created_at, responded_at, responded_by")
      .eq("team_id", team.id)
      .in("status", ["approved", "rejected"])
      .order("responded_at", { ascending: false })
      .limit(10);

    const pendingRows = (pendingRaw ?? []) as {
      id: string;
      team_id: string;
      user_id: string;
      status: "pending";
      created_at: string;
    }[];

    const historyRows = (historyRaw ?? []) as {
      id: string;
      team_id: string;
      user_id: string;
      status: "approved" | "rejected";
      created_at: string;
      responded_at: string | null;
      responded_by: string | null;
    }[];

    const requesterIds = Array.from(
      new Set([...pendingRows.map((r) => r.user_id), ...historyRows.map((r) => r.user_id)]),
    );
    const responderIds = Array.from(
      new Set(historyRows.map((r) => r.responded_by).filter((id): id is string => Boolean(id))),
    );

    const [requestersResult, respondersResult] = await Promise.all([
      requesterIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url, xbox_gamertag")
            .in("id", requesterIds)
        : Promise.resolve({ data: [] as never[] }),
      responderIds.length > 0
        ? supabase.from("profiles").select("id, display_name").in("id", responderIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const requesterMap = new Map<string, JoinRequestUser>();
    for (const row of requestersResult.data ?? []) {
      requesterMap.set(row.id as string, {
        id: row.id as string,
        display_name: (row.display_name as string) ?? "Usuário",
        username: (row.username as string) ?? "desconhecido",
        avatar_url: (row.avatar_url as string | null) ?? null,
        xbox_gamertag: (row.xbox_gamertag as string | null) ?? null,
      });
    }

    const responderMap = new Map<string, string>();
    for (const row of respondersResult.data ?? []) {
      responderMap.set(row.id as string, (row.display_name as string) ?? "Capitão");
    }

    pendingRequestsForCaptain = pendingRows.flatMap((row) => {
      const requester = requesterMap.get(row.user_id);
      if (!requester) return [];
      return [{
        id: row.id,
        team_id: row.team_id,
        user_id: row.user_id,
        status: "pending",
        created_at: row.created_at,
        user: requester,
      } satisfies JoinRequestPendingItem];
    });

    historyRequestsForCaptain = historyRows.flatMap((row) => {
      const requester = requesterMap.get(row.user_id);
      if (!requester) return [];
      return [{
        id: row.id,
        team_id: row.team_id,
        user_id: row.user_id,
        status: row.status,
        created_at: row.created_at,
        responded_at: row.responded_at,
        responded_by: row.responded_by,
        user: requester,
        responder_name: row.responded_by ? responderMap.get(row.responded_by) ?? null : null,
      } satisfies JoinRequestHistoryItem];
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10 lg:px-10">

        {/* Voltar */}
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
              {captain ? (
                <p className="mt-1 text-sm text-slate-300">
                  Capitão: {" "}
                  <Link href={`/profile/${captain.user_id}`} className="text-amber-300 hover:text-amber-200 hover:underline">
                    {captain.display_name}
                  </Link>
                </p>
              ) : null}
            </div>

            {isCaptain ? (
              <div className="ml-auto">
                <TeamManageButton
                  team={{
                    id: team.id,
                    name: team.name,
                    logo_url: team.logo_url,
                    max_members: team.max_members,
                    captain_id: team.captain_id,
                  }}
                  members={memberList}
                  pendingRequests={pendingRequestsForCaptain}
                  historyRequests={historyRequestsForCaptain}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-2.5">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-slate-300">
                {memberList.length}/{team.max_members} membro{memberList.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-2.5">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-slate-300">Capitão registrado</span>
            </div>

            {isMember && !isCaptain ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-emerald-200">
                <Users className="h-4 w-4" />
                <span>Sua Equipe</span>
              </div>
            ) : null}
          </div>

          {!isCaptain ? (
            <div className="mt-4 max-w-sm">
              <JoinRequestButton
                teamId={team.id}
                teamCaptainId={team.captain_id}
                currentMemberCount={memberList.length}
                userId={user?.id ?? null}
                isMember={isMember}
                hasPendingRequest={hasPendingRequest}
                pendingRequestId={pendingRequestId}
                currentUserTeamCount={currentUserTeamCount}
              />
            </div>
          ) : null}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Membros */}
          <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Users className="h-5 w-5 text-cyan-400" />
              Tripulação
            </h2>

            {memberList.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {memberList.map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-xs font-bold text-slate-300">
                        {member.avatar_url ? (
                          <Image
                            src={member.avatar_url}
                            alt={member.display_name}
                            width={36}
                            height={36}
                            className="h-9 w-9 object-cover"
                          />
                        ) : (
                          member.display_name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div className="space-y-0.5">
                        <span className="block text-sm font-medium text-slate-200">
                          {member.display_name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          @{member.username}
                        </span>
                        {member.xbox_gamertag ? (
                          <span className="block text-xs text-cyan-300">
                            Xbox: {member.xbox_gamertag}
                          </span>
                        ) : null}
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          member.role === "captain"
                            ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                            : "border-slate-300/20 bg-slate-300/10 text-slate-300"
                        }`}>
                          {member.role === "captain" ? "Capitão" : "Membro"}
                        </span>
                      </div>
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

          {/* Histórico de eventos */}
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

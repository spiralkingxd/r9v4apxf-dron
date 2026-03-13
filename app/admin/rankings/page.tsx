import { Trophy } from "lucide-react";

import { RankingsAdminPanel } from "@/components/admin/rankings-admin-panel";
import { createClient } from "@/lib/supabase/server";

type PlayerRow = {
  rank_position: number | null;
  avatar_url: string | null;
  profile_id: string;
  name: string;
  xbox: string | null;
  points: number;
  wins: number;
  losses: number;
  win_rate: number;
  last_match_at: string | null;
  event_types: string[];
};

type TeamRow = {
  rank_position: number | null;
  logo_url: string | null;
  team_id: string;
  team_name: string;
  captain_name: string;
  points: number;
  wins: number;
  losses: number;
  win_rate: number;
  last_match_at: string | null;
  event_types: string[];
};

export default async function AdminRankingsPage() {
  const supabase = await createClient();

  const [
    { data: rankingsRaw },
    { data: teamRankingsRaw },
    { data: profilesRaw },
    { data: teamsRaw },
    { data: membersRaw },
    { data: matchesRaw },
    { data: eventsRaw },
  ] = await Promise.all([
    supabase.from("rankings").select("profile_id, points, wins, losses, rank_position"),
    supabase.from("team_rankings").select("team_id, points, wins, losses, rank_position"),
    supabase.from("profiles").select("id, display_name, username, xbox_gamertag, avatar_url"),
    supabase.from("teams").select("id, name, captain_id, logo_url"),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("matches").select("event_id, team_a_id, team_b_id, ended_at, status"),
    supabase.from("events").select("id, event_type"),
  ]);

  const profileMap = new Map<string, { name: string; xbox: string | null; avatar: string | null }>();
  for (const profile of profilesRaw ?? []) {
    profileMap.set(String(profile.id), {
      name: String(profile.display_name ?? profile.username ?? "Jogador"),
      xbox: (profile.xbox_gamertag as string | null) ?? null,
      avatar: (profile.avatar_url as string | null) ?? null,
    });
  }

  const teamMap = new Map<string, { name: string; captain_id: string; logo_url: string | null }>();
  for (const team of teamsRaw ?? []) {
    teamMap.set(String(team.id), {
      name: String(team.name),
      captain_id: String(team.captain_id),
      logo_url: (team.logo_url as string | null) ?? null,
    });
  }

  const membersByTeam = new Map<string, Set<string>>();
  for (const team of teamsRaw ?? []) {
    membersByTeam.set(String(team.id), new Set<string>([String(team.captain_id)]));
  }
  for (const member of membersRaw ?? []) {
    const teamId = String(member.team_id);
    const set = membersByTeam.get(teamId) ?? new Set<string>();
    set.add(String(member.user_id));
    membersByTeam.set(teamId, set);
  }

  const eventTypeByEventId = new Map<string, string>();
  for (const event of eventsRaw ?? []) {
    eventTypeByEventId.set(String(event.id), String(event.event_type ?? "special"));
  }

  const playerLastMatchMap = new Map<string, string>();
  const teamLastMatchMap = new Map<string, string>();
  const playerEventTypesMap = new Map<string, Set<string>>();
  const teamEventTypesMap = new Map<string, Set<string>>();

  for (const match of matchesRaw ?? []) {
    if (String(match.status) !== "finished") continue;
    const endedAt = match.ended_at ? String(match.ended_at) : null;
    const eventType = eventTypeByEventId.get(String(match.event_id)) ?? "special";
    const teamIds = [match.team_a_id ? String(match.team_a_id) : null, match.team_b_id ? String(match.team_b_id) : null].filter(Boolean) as string[];

    for (const teamId of teamIds) {
      const prev = teamLastMatchMap.get(teamId);
      if (!prev || (endedAt && new Date(endedAt) > new Date(prev))) {
        if (endedAt) teamLastMatchMap.set(teamId, endedAt);
      }

      const teamTypes = teamEventTypesMap.get(teamId) ?? new Set<string>();
      teamTypes.add(eventType);
      teamEventTypesMap.set(teamId, teamTypes);

      const members = membersByTeam.get(teamId) ?? new Set<string>();
      for (const profileId of members) {
        const prevPlayer = playerLastMatchMap.get(profileId);
        if (!prevPlayer || (endedAt && new Date(endedAt) > new Date(prevPlayer))) {
          if (endedAt) playerLastMatchMap.set(profileId, endedAt);
        }

        const playerTypes = playerEventTypesMap.get(profileId) ?? new Set<string>();
        playerTypes.add(eventType);
        playerEventTypesMap.set(profileId, playerTypes);
      }
    }
  }

  const players: PlayerRow[] = (rankingsRaw ?? []).map((row) => {
    const profileId = String(row.profile_id);
    const wins = Number(row.wins ?? 0);
    const losses = Number(row.losses ?? 0);
    const total = wins + losses;
    const profile = profileMap.get(profileId);
    return {
      rank_position: row.rank_position == null ? null : Number(row.rank_position),
      avatar_url: profile?.avatar ?? null,
      profile_id: profileId,
      name: profile?.name ?? "Jogador removido",
      xbox: profile?.xbox ?? null,
      points: Number(row.points ?? 0),
      wins,
      losses,
      win_rate: total > 0 ? (wins / total) * 100 : 0,
      last_match_at: playerLastMatchMap.get(profileId) ?? null,
      event_types: [...(playerEventTypesMap.get(profileId) ?? new Set<string>())],
    };
  });

  const teams: TeamRow[] = (teamRankingsRaw ?? []).map((row) => {
    const teamId = String(row.team_id);
    const team = teamMap.get(teamId);
    const captain = team ? profileMap.get(team.captain_id) : null;
    const wins = Number(row.wins ?? 0);
    const losses = Number(row.losses ?? 0);
    const total = wins + losses;

    return {
      rank_position: row.rank_position == null ? null : Number(row.rank_position),
      logo_url: team?.logo_url ?? null,
      team_id: teamId,
      team_name: team?.name ?? "Equipe removida",
      captain_name: captain?.name ?? "Capitão",
      points: Number(row.points ?? 0),
      wins,
      losses,
      win_rate: total > 0 ? (wins / total) * 100 : 0,
      last_match_at: teamLastMatchMap.get(teamId) ?? null,
      event_types: [...(teamEventTypesMap.get(teamId) ?? new Set<string>())],
    };
  });

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-300" />
          <h1 className="text-2xl font-bold text-white">Gerenciamento de Rankings</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Controle completo de rankings de jogadores e equipes, com ajustes manuais e gestão de temporadas.
        </p>
      </header>

      <RankingsAdminPanel players={players} teams={teams} />
    </section>
  );
}

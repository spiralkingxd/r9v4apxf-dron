"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, RefreshCcw } from "lucide-react";

import {
  adjustRankingPoints,
  recalculateAllRankings,
  resetRankings,
} from "@/app/admin/final-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminAutocompleteInput } from "@/components/admin/admin-autocomplete-input";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";

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

function periodCutoff(period: "weekly" | "monthly" | "general") {
  if (period === "general") return null;
  const date = new Date();
  date.setDate(date.getDate() - (period === "weekly" ? 7 : 30));
  return date;
}

export function RankingsAdminPanel({
  players,
  teams,
}: {
  players: PlayerRow[];
  teams: TeamRow[];
}) {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState<"weekly" | "monthly" | "general">("general");
  const [gameType, setGameType] = useState<"all" | "tournament" | "special" | "scrimmage">("all");
  const [search, setSearch] = useState("");
  const [adjustEntityId, setAdjustEntityId] = useState("");
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const entityOptions = useMemo(
    () => [
      ...players.map((player) => ({
        id: player.profile_id,
        title: player.name,
        subtitle: `Usuario | Xbox: ${player.xbox ?? "-"}`,
      })),
      ...teams.map((team) => ({
        id: team.team_id,
        title: team.team_name,
        subtitle: `Equipe | Capitao: ${team.captain_name}`,
      })),
    ],
    [players, teams],
  );

  const filteredPlayers = useMemo(() => {
    const cutoff = periodCutoff(period);
    const query = search.trim().toLowerCase();
    return players.filter((row) => {
      if (gameType !== "all" && !row.event_types.includes(gameType)) return false;
      if (cutoff && row.last_match_at && new Date(row.last_match_at) < cutoff) return false;
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || String(row.xbox ?? "").toLowerCase().includes(query);
    });
  }, [players, period, gameType, search]);

  const filteredTeams = useMemo(() => {
    const cutoff = periodCutoff(period);
    const query = search.trim().toLowerCase();
    return teams.filter((row) => {
      if (gameType !== "all" && !row.event_types.includes(gameType)) return false;
      if (cutoff && row.last_match_at && new Date(row.last_match_at) < cutoff) return false;
      if (!query) return true;
      return row.team_name.toLowerCase().includes(query) || row.captain_name.toLowerCase().includes(query);
    });
  }, [teams, period, gameType, search]);

  const playerColumns: AdminTableColumn<PlayerRow>[] = [
    { key: "position", header: "Posição", sortable: true, accessor: (row) => row.rank_position ?? 99999, render: (row) => <span>#{row.rank_position ?? "-"}</span> },
    {
      key: "avatar",
      header: "Avatar",
      render: (row) => row.avatar_url
        ? <img src={row.avatar_url} alt={row.name} className="h-8 w-8 rounded-full object-cover" />
        : <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 text-xs">{row.name.slice(0, 1)}</span>,
    },
    { key: "name", header: "Nome", sortable: true, accessor: (row) => row.name, render: (row) => <span>{row.name}</span> },
    { key: "xbox", header: "Xbox", sortable: true, accessor: (row) => row.xbox ?? "", render: (row) => <span>{row.xbox ?? "-"}</span> },
    { key: "points", header: "Pontos", sortable: true, accessor: (row) => row.points, render: (row) => <span className="font-semibold">{row.points}</span> },
    { key: "wins", header: "Vitórias", sortable: true, accessor: (row) => row.wins, render: (row) => <span>{row.wins}</span> },
    { key: "losses", header: "Derrotas", sortable: true, accessor: (row) => row.losses, render: (row) => <span>{row.losses}</span> },
    { key: "winRate", header: "Win Rate", sortable: true, accessor: (row) => row.win_rate, render: (row) => <span>{row.win_rate.toFixed(1)}%</span> },
  ];

  const teamColumns: AdminTableColumn<TeamRow>[] = [
    { key: "position", header: "Posição", sortable: true, accessor: (row) => row.rank_position ?? 99999, render: (row) => <span>#{row.rank_position ?? "-"}</span> },
    {
      key: "logo",
      header: "Logo",
      render: (row) => row.logo_url
        ? <img src={row.logo_url} alt={row.team_name} className="h-8 w-8 rounded-full object-cover" />
        : <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 text-xs">{row.team_name.slice(0, 1)}</span>,
    },
    { key: "name", header: "Nome", sortable: true, accessor: (row) => row.team_name, render: (row) => <span>{row.team_name}</span> },
    { key: "captain", header: "Capitão", sortable: true, accessor: (row) => row.captain_name, render: (row) => <span>{row.captain_name}</span> },
    { key: "points", header: "Pontos", sortable: true, accessor: (row) => row.points, render: (row) => <span className="font-semibold">{row.points}</span> },
    { key: "wins", header: "Vitórias", sortable: true, accessor: (row) => row.wins, render: (row) => <span>{row.wins}</span> },
    { key: "losses", header: "Derrotas", sortable: true, accessor: (row) => row.losses, render: (row) => <span>{row.losses}</span> },
  ];

  function runAction(task: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await task();
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
      if (!result.error) {
        window.location.reload();
      }
    });
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Período
          <select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="general">Geral</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Tipo de jogo
          <select value={gameType} onChange={(event) => setGameType(event.target.value as typeof gameType)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            <option value="tournament">Torneio</option>
            <option value="special">Especial</option>
            <option value="scrimmage">Scrimmage</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:col-span-2">
          Busca
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Jogador, Xbox, equipe ou capitão" className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none" />
        </label>

        <div className="flex items-end gap-2">
          <a href="/admin/rankings/export?scope=players&format=csv" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10">
            <Download className="h-4 w-4" /> CSV
          </a>
          <a href="/admin/rankings/export?scope=players&format=svg" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10">
            <Download className="h-4 w-4" /> Imagem
          </a>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <AdminAutocompleteInput
            label="Jogador/equipe"
            placeholder="Digite 2 letras para buscar..."
            localOptions={entityOptions}
            onQueryChange={setAdjustEntityId}
            onSelect={(option) => setAdjustEntityId(option.id)}
          />
        </div>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Pontos (+/-)
          <input type="number" value={adjustPoints} onChange={(event) => setAdjustPoints(Number(event.target.value))} className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:col-span-2">
          Motivo
          <input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none" />
        </label>
        <AdminButton type="button" disabled={isPending || !adjustEntityId || !adjustReason.trim()} onClick={() => runAction(() => adjustRankingPoints(adjustEntityId, adjustPoints, adjustReason))}>
          Ajustar
        </AdminButton>
      </div>

      <div className="flex flex-wrap gap-2">
        <AdminButton type="button" disabled={isPending} onClick={() => runAction(() => recalculateAllRankings())}>
          <RefreshCcw className="h-4 w-4" />
          Recalcular rankings
        </AdminButton>

        <input
          value={seasonName}
          onChange={(event) => setSeasonName(event.target.value)}
          placeholder="Temporada (ex: 2026-S1)"
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-transparent dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-500"
        />

        <AdminButton type="button" variant="danger" disabled={isPending || !seasonName.trim()} onClick={() => runAction(() => resetRankings(seasonName))}>
          Resetar e arquivar temporada
        </AdminButton>

        <AdminBadge tone="pending">{`Jogadores: ${filteredPlayers.length}`}</AdminBadge>
        <AdminBadge tone="info">{`Equipes: ${filteredTeams.length}`}</AdminBadge>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ranking de Jogadores</h2>
        <AdminTable data={filteredPlayers} columns={playerColumns} pageSize={20} emptyText="Sem jogadores ranqueados." />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ranking de Equipes</h2>
        <AdminTable data={filteredTeams} columns={teamColumns} pageSize={20} emptyText="Sem equipes ranqueadas." />
      </section>
    </section>
  );
}

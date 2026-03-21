import Link from "next/link";
import { Trophy } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  title: string;
  status: "registrations_open" | "check_in" | "started" | "finished";
  tournament_type: "1v1_elimination" | "free_for_all_points" | null;
  crew_type: "solo_sloop" | "sloop" | "brig" | "galleon" | null;
  start_date: string;
  approved_registrations: number;
};

const STATUS_OPTIONS = ["registrations_open", "check_in", "started", "finished"] as const;
const TOURNAMENT_TYPE_OPTIONS = ["1v1_elimination", "free_for_all_points"] as const;
const CREW_TYPE_OPTIONS = ["solo_sloop", "sloop", "brig", "galleon"] as const;

const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  registrations_open: "Inscrições Abertas",
  check_in: "Check-in",
  started: "Iniciado",
  finished: "Finalizado",
};

const STATUS_BADGE_CLASS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  registrations_open: "bg-emerald-100 text-emerald-800 dark:bg-emerald-300/20 dark:text-emerald-200",
  check_in: "bg-amber-100 text-amber-800 dark:bg-amber-300/20 dark:text-amber-200",
  started: "bg-sky-100 text-sky-800 dark:bg-sky-300/20 dark:text-sky-200",
  finished: "bg-slate-200 text-slate-800 dark:bg-slate-400/20 dark:text-slate-200",
};

const STATUS_DOT: Record<(typeof STATUS_OPTIONS)[number], string> = {
  registrations_open: "🟢",
  check_in: "🟡",
  started: "🔵",
  finished: "⚫",
};

const TOURNAMENT_TYPE_LABELS: Record<(typeof TOURNAMENT_TYPE_OPTIONS)[number], string> = {
  "1v1_elimination": "1v1",
  free_for_all_points: "FFA",
};

const CREW_TYPE_LABELS: Record<(typeof CREW_TYPE_OPTIONS)[number], string> = {
  solo_sloop: "Sloop (1 Jogador)",
  sloop: "Sloop",
  brig: "Brig",
  galleon: "Galleon",
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

function normalizeFirst(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};

  const q = normalizeFirst(params.q).trim();
  const statusFilter = normalizeFirst(params.status);
  const tournamentTypeFilter = normalizeFirst(params.tournamentType);
  const crewTypeFilter = normalizeFirst(params.crewType);

  const supabase = await createClient();
  const [{ data: eventsRaw }, { data: registrationsRaw }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, status, tournament_type, crew_type, start_date")
      .eq("event_kind", "tournament")
      .order("start_date", { ascending: false }),
    supabase.from("registrations").select("event_id, status").eq("status", "approved"),
  ]);

  const approvedByEvent = new Map<string, number>();
  for (const registration of registrationsRaw ?? []) {
    const key = String(registration.event_id ?? "");
    if (!key) continue;
    approvedByEvent.set(key, (approvedByEvent.get(key) ?? 0) + 1);
  }

  const rows: Row[] = (eventsRaw ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Sem nome"),
    status: String(row.status ?? "registrations_open") as Row["status"],
    tournament_type: (row.tournament_type as Row["tournament_type"]) ?? null,
    crew_type: (row.crew_type as Row["crew_type"]) ?? null,
    start_date: String(row.start_date),
    approved_registrations: approvedByEvent.get(String(row.id)) ?? 0,
  }));

  const filtered = rows.filter((row) => {
    if (q && !row.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && statusFilter !== "all" && row.status !== statusFilter) return false;
    if (tournamentTypeFilter && tournamentTypeFilter !== "all" && row.tournament_type !== tournamentTypeFilter) return false;
    if (crewTypeFilter && crewTypeFilter !== "all" && row.crew_type !== crewTypeFilter) return false;
    return true;
  });

  return (
    <section className="space-y-5">
      <header className="admin-surface rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-300" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gerenciamento de Torneios</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Lista com tipo, tripulação, status e inscrições.</p>
      </header>

      <form className="admin-surface grid gap-3 rounded-2xl p-4 sm:grid-cols-2 xl:grid-cols-5" method="get">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:col-span-2">
          Busca
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome do torneio"
            className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Status
          <select name="status" defaultValue={statusFilter || "all"} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Tipo
          <select name="tournamentType" defaultValue={tournamentTypeFilter || "all"} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todos</option>
            {TOURNAMENT_TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>{TOURNAMENT_TYPE_LABELS[value]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Tripulação
          <select name="crewType" defaultValue={crewTypeFilter || "all"} className="rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
            <option value="all">Todas</option>
            {CREW_TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>{CREW_TYPE_LABELS[value]}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-5">
          <button type="submit" className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-200">
            Filtrar
          </button>
          <Link href="/admin/tournaments" className="rounded-xl border border-white/12 bg-white/6 px-4 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-white/10">
            Limpar
          </Link>
          <Link href="/admin/tournaments/new" className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">
            Novo torneio
          </Link>
        </div>
      </form>

      <div className="admin-surface overflow-x-auto rounded-2xl p-2">
        <table className="min-w-[980px] w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              <th className="px-3 py-3">Nome do Torneio</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Tripulação</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Inscrições</th>
              <th className="px-3 py-3">Data de Início</th>
              <th className="px-3 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 dark:border-white/10">
                <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-100">{row.title}</td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.tournament_type ? TOURNAMENT_TYPE_LABELS[row.tournament_type] : "-"}</td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.crew_type ? CREW_TYPE_LABELS[row.crew_type] : "-"}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[row.status]}`}>
                    <span aria-hidden="true">{STATUS_DOT[row.status]}</span>
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.approved_registrations} equipes</td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{dateFmt.format(new Date(row.start_date))}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Link href={`/admin/tournaments/${row.id}`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                      Detalhes
                    </Link>
                    <Link href={`/admin/tournaments/${row.id}/edit`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                      Editar
                    </Link>
                    <Link href={`/admin/tournaments/${row.id}/registrations`} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                      Inscrições
                    </Link>
                    <Link href={`/admin/tournaments/${row.id}/matches`} className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-400/20" title="Gerenciar Partidas deste Torneio">
                      Partidas
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum torneio encontrado para os filtros atuais.</div>
        ) : null}
      </div>
    </section>
  );
}

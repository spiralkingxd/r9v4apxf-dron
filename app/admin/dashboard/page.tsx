import { redirect } from "next/navigation";
import Link from "next/link";

import {
  banTeamAction,
  createEventAction,
  deleteEventAction,
  promoteUserToAdminAction,
  updateEventAction,
  updateMatchResultAdminAction,
} from "@/app/admin/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  status: "draft" | "active" | "finished";
  start_date: string;
  end_date: string | null;
  prize_pool: number;
};

type TeamRow = {
  id: string;
  name: string;
  captain_id: string;
  created_at: string;
};

type MatchRow = {
  id: string;
  event_id: string;
  team_a_id: string;
  team_b_id: string;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  round: number;
};

type ProfileRow = {
  id: string;
  display_name: string;
  username: string;
  discord_id: string | null;
  role: "user" | "admin";
  created_at: string;
};

const statusOptions: Array<EventRow["status"]> = ["draft", "active", "finished"];

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

function formatForDatetimeLocal(dateIso: string | null) {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default async function AdminDashboardPage() {
  if (!isSupabaseConfigured()) {
    redirect("/auth/login?next=/admin/dashboard&reason=supabase_not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/admin/dashboard");
  }

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (me?.role !== "admin") {
    redirect("/");
  }

  const [{ data: events }, { data: teams }, { data: matches }, { data: profiles }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, rules, status, start_date, end_date, prize_pool")
      .order("start_date", { ascending: false }),
    supabase.from("teams").select("id, name, captain_id, created_at").order("created_at", { ascending: false }),
    supabase
      .from("matches")
      .select("id, event_id, team_a_id, team_b_id, score_a, score_b, winner_id, round")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, username, discord_id, role, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const eventRows = (events ?? []) as EventRow[];
  const teamRows = (teams ?? []) as TeamRow[];
  const matchRows = (matches ?? []) as MatchRow[];
  const profileRows = (profiles ?? []) as ProfileRow[];

  const eventNameById = new Map(eventRows.map((e) => [e.id, e.title]));
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] px-6 py-10 text-slate-100 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">Painel Administrativo</p>
          <h1 className="text-3xl font-bold text-white">Controle da Arena</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/events" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10">
              Ver eventos publicos
            </Link>
            <Link href="/ranking" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10">
              Ver ranking
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-amber-300/20 bg-slate-950/60 p-6">
          <h2 className="text-xl font-semibold text-white">Criar Evento</h2>
          <form action={createEventAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input name="title" required placeholder="Titulo" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" />
            <select name="status" defaultValue="draft" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              {statusOptions.map((status) => (
                <option key={status} value={status} className="bg-slate-900">{status}</option>
              ))}
            </select>
            <input name="start_date" type="datetime-local" required className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" />
            <input name="end_date" type="datetime-local" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" />
            <input name="prize_pool" type="number" min={0} step="0.01" defaultValue={0} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" />
            <input name="description" placeholder="Descricao" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2" />
            <textarea name="rules" placeholder="Regras" className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2" rows={4} />
            <button type="submit" className="md:col-span-2 rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300">
              Criar evento
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <h2 className="text-xl font-semibold text-white">Eventos</h2>
          <div className="mt-4 space-y-4">
            {eventRows.map((event) => (
              <article key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <form action={updateEventAction} className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="event_id" value={event.id} />
                  <input name="title" defaultValue={event.title} required className="rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
                  <select name="status" defaultValue={event.status} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    {statusOptions.map((status) => (
                      <option key={status} value={status} className="bg-slate-900">{status}</option>
                    ))}
                  </select>
                  <input name="start_date" type="datetime-local" defaultValue={formatForDatetimeLocal(event.start_date)} required className="rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
                  <input name="end_date" type="datetime-local" defaultValue={formatForDatetimeLocal(event.end_date)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
                  <input name="prize_pool" type="number" min={0} step="0.01" defaultValue={event.prize_pool} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
                  <input name="description" defaultValue={event.description ?? ""} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
                  <textarea name="rules" defaultValue={event.rules ?? ""} rows={3} className="md:col-span-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button type="submit" className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                      Salvar
                    </button>
                    <Link href={`/events/${event.id}/bracket`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                      Chaveamento
                    </Link>
                  </div>
                </form>
                <form action={deleteEventAction} className="mt-2">
                  <input type="hidden" name="event_id" value={event.id} />
                  <button type="submit" className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-200 hover:bg-rose-400/20">
                    Excluir evento
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="text-xl font-semibold text-white">Gerenciar Times</h2>
            <div className="mt-4 space-y-3">
              {teamRows.map((team) => (
                <div key={team.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-100">{team.name}</p>
                    <p className="text-xs text-slate-400">Criado em {dateFmt.format(new Date(team.created_at))}</p>
                  </div>
                  <form action={banTeamAction}>
                    <input type="hidden" name="team_id" value={team.id} />
                    <button type="submit" className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-400/20">
                      Banir time
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="text-xl font-semibold text-white">Gerenciar Matches</h2>
            <div className="mt-4 space-y-3">
              {matchRows.map((match) => (
                <form key={match.id} action={updateMatchResultAdminAction} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <input type="hidden" name="match_id" value={match.id} />
                  <input type="hidden" name="event_id" value={match.event_id} />
                  <input type="hidden" name="team_a_id" value={match.team_a_id} />
                  <input type="hidden" name="team_b_id" value={match.team_b_id} />

                  <p className="text-sm font-medium text-slate-100">
                    {eventNameById.get(match.event_id) ?? "Evento"} · Rodada {match.round}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(teamNameById.get(match.team_a_id) ?? "Equipe A")} vs {(teamNameById.get(match.team_b_id) ?? "Equipe B")}
                  </p>

                  <div className="mt-3 flex items-end gap-2">
                    <label className="text-xs text-slate-300">
                      A
                      <input name="score_a" type="number" min={0} defaultValue={match.score_a} className="mt-1 w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5" />
                    </label>
                    <label className="text-xs text-slate-300">
                      B
                      <input name="score_b" type="number" min={0} defaultValue={match.score_b} className="mt-1 w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5" />
                    </label>
                    <button type="submit" className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                      Atualizar
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
          <h2 className="text-xl font-semibold text-white">Usuarios</h2>
          <div className="mt-4 space-y-3">
            {profileRows.map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-100">{profile.display_name || profile.username}</p>
                  <p className="text-xs text-slate-400">Discord: {profile.discord_id ?? "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={profile.role === "admin" ? "rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-200" : "rounded-full border border-white/20 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-300"}>
                    {profile.role}
                  </span>
                  {profile.role !== "admin" ? (
                    <form action={promoteUserToAdminAction}>
                      <input type="hidden" name="user_id" value={profile.id} />
                      <button type="submit" className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/20">
                        Promover admin
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

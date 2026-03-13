"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, RefreshCcw, Save, Trophy, XCircle } from "lucide-react";

import {
  advanceWinner,
  cancelMatch,
  reopenMatch,
  revertMatchResult,
  setMatchWinner,
  updateMatchDetails,
  updateMatchScore,
} from "@/app/admin/match-actions";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";
import type { MatchDetail, MatchHistoryItem } from "@/app/admin/matches/_data";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function MatchDetailEditor({ detail, history }: { detail: MatchDetail; history: MatchHistoryItem[] }) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [scoreA, setScoreA] = useState(detail.score_a);
  const [scoreB, setScoreB] = useState(detail.score_b);
  const [winner, setWinner] = useState<string>(detail.winner_id ?? "draw");
  const [status, setStatus] = useState<MatchDetail["status"]>(detail.status);
  const [scheduledAt, setScheduledAt] = useState(detail.scheduled_at ? new Date(new Date(detail.scheduled_at).getTime() - new Date(detail.scheduled_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [startedAt, setStartedAt] = useState(detail.started_at ? new Date(new Date(detail.started_at).getTime() - new Date(detail.started_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [endedAt, setEndedAt] = useState(detail.ended_at ? new Date(new Date(detail.ended_at).getTime() - new Date(detail.ended_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [durationMinutes, setDurationMinutes] = useState(detail.duration_minutes ?? 0);
  const [cancelReason, setCancelReason] = useState(detail.cancel_reason ?? "");
  const [note, setNote] = useState("");
  const [evidenceText, setEvidenceText] = useState(
    (detail.evidence ?? []).map((entry) => `${entry.type}|${entry.url}|${entry.label ?? ""}`).join("\n"),
  );

  const winnerOptions = useMemo(
    () => [
      { value: "draw", label: "Empate" },
      ...(detail.team_a_id ? [{ value: detail.team_a_id, label: detail.team_a_name }] : []),
      ...(detail.team_b_id ? [{ value: detail.team_b_id, label: detail.team_b_name }] : []),
    ],
    [detail.team_a_id, detail.team_a_name, detail.team_b_id, detail.team_b_name],
  );

  function parseEvidence() {
    const lines = evidenceText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines
      .map((line) => {
        const [typeRaw, urlRaw, labelRaw] = line.split("|");
        const type = typeRaw === "image" ? "image" : "link";
        const url = (urlRaw ?? typeRaw ?? "").trim();
        const label = (labelRaw ?? "").trim();
        if (!url.startsWith("http")) return null;
        return { type, url, label: label || undefined };
      })
      .filter(Boolean) as Array<{ type: "image" | "link"; url: string; label?: string }>;
  }

  function statusTone(current: MatchDetail["status"]) {
    if (current === "finished") return "active" as const;
    if (current === "in_progress") return "info" as const;
    if (current === "cancelled") return "danger" as const;
    return "pending" as const;
  }

  function statusLabel(current: MatchDetail["status"]) {
    if (current === "pending") return "Pendente";
    if (current === "in_progress") return "Em andamento";
    if (current === "finished") return "Finalizada";
    return "Cancelada";
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Partida</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{detail.team_a_name} vs {detail.team_b_name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
            {detail.team_a_logo_url ? <img src={detail.team_a_logo_url} alt={detail.team_a_name} className="h-6 w-6 rounded-full object-cover" /> : <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-xs">A</span>}
            <span>{detail.team_a_name}</span>
          </div>
          <span className="text-slate-500">vs</span>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
            {detail.team_b_logo_url ? <img src={detail.team_b_logo_url} alt={detail.team_b_name} className="h-6 w-6 rounded-full object-cover" /> : <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-xs">B</span>}
            <span>{detail.team_b_name}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
          <AdminBadge tone="info">{detail.event_title}</AdminBadge>
          <AdminBadge tone={statusTone(status)}>{`Status: ${statusLabel(status)}`}</AdminBadge>
          <AdminBadge tone="pending">{`R${detail.round}`}</AdminBadge>
          {detail.bracket_position ? <AdminBadge tone="pending">{detail.bracket_position}</AdminBadge> : null}
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">Editar resultado</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Placar {detail.team_a_name}
            <input type="number" min={0} value={scoreA} onChange={(event) => setScoreA(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Placar {detail.team_b_name}
            <input type="number" min={0} value={scoreB} onChange={(event) => setScoreB(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Vencedor
            <select value={winner} onChange={(event) => setWinner(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              {winnerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await updateMatchScore(detail.id, scoreA, scoreB);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            <Save className="h-4 w-4" />
            Salvar placar
          </AdminButton>
          <AdminButton
            type="button"
            variant="success"
            onClick={() =>
              startTransition(async () => {
                const result = await setMatchWinner(detail.id, winner as string | "draw");
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            <Trophy className="h-4 w-4" />
            Definir vencedor
          </AdminButton>
          <AdminButton
            type="button"
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await advanceWinner(detail.id);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            Avançar no bracket
          </AdminButton>
          <AdminButton
            type="button"
            variant="danger"
            onClick={() => {
              const reason = window.prompt("Motivo do cancelamento:", cancelReason || "WO")?.trim();
              if (!reason) return;
              startTransition(async () => {
                const result = await cancelMatch(detail.id, reason);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              });
            }}
          >
            <XCircle className="h-4 w-4" />
            Cancelar partida
          </AdminButton>
          <AdminButton
            type="button"
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await revertMatchResult(detail.id);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            <RefreshCcw className="h-4 w-4" />
            Reverter resultado
          </AdminButton>
          <AdminButton
            type="button"
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await reopenMatch(detail.id);
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            Reabrir partida
          </AdminButton>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">Meta da partida</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as MatchDetail["status"])} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="pending">Pendente</option>
              <option value="in_progress">Em andamento</option>
              <option value="finished">Finalizada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Duração (minutos)
            <input type="number" min={0} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Agendada em
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Início
            <input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Fim
            <input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Motivo cancelamento
            <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="mt-4 flex flex-col gap-1 text-sm text-slate-200">
          Evidências (uma por linha: `image|url|label` ou `link|url|label`)
          <textarea value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} rows={6} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs" />
        </label>

        <label className="mt-4 flex flex-col gap-1 text-sm text-slate-200">
          Nota da edição
          <input value={note} onChange={(event) => setNote(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
        </label>

        <div className="mt-4">
          <AdminButton
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateMatchDetails({
                  matchId: detail.id,
                  status,
                  scheduled_at: scheduledAt || null,
                  started_at: startedAt || null,
                  ended_at: endedAt || null,
                  duration_minutes: durationMinutes,
                  cancel_reason: cancelReason || null,
                  evidence: parseEvidence(),
                  note: note || null,
                });
                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Ação concluída.");
                router.refresh();
              })
            }
          >
            Salvar detalhes
          </AdminButton>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <History className="h-5 w-5" />
          Histórico de edições
        </h2>
        <ul className="mt-4 space-y-3">
          {history.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{item.action}</p>
                <span className="text-xs text-slate-500">{dateFmt.format(new Date(item.created_at))} · {item.admin_name}</span>
              </div>
              {item.note ? <p className="mt-1 text-xs text-slate-400">{item.note}</p> : null}
              <p className="mt-2 text-xs text-slate-500">Antes: {JSON.stringify(item.previous_state ?? {})}</p>
              <p className="mt-1 text-xs text-slate-500">Depois: {JSON.stringify(item.next_state ?? {})}</p>
            </li>
          ))}
          {history.length === 0 ? <li className="text-sm text-slate-500">Sem histórico.</li> : null}
        </ul>
      </section>
    </section>
  );
}

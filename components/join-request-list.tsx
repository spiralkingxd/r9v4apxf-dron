"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Check, CheckCircle2, Clock3, Inbox, Loader2, X } from "lucide-react";

import { respondToJoinRequest } from "@/app/actions/team-requests";
import { ActionToast } from "@/components/action-toast";
import { teamRequestMessages } from "@/lib/team-request-messages";

export type JoinRequestUser = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
};

export type JoinRequestPendingItem = {
  id: string;
  team_id: string;
  user_id: string;
  status: "pending";
  created_at: string;
  user: JoinRequestUser;
};

export type JoinRequestHistoryItem = {
  id: string;
  team_id: string;
  user_id: string;
  status: "approved" | "rejected";
  created_at: string;
  responded_at: string | null;
  responded_by: string | null;
  user: JoinRequestUser;
  responder_name?: string | null;
};

type Props = {
  teamId: string;
  memberCount: number;
  maxMembers: number;
  initialPendingRequests: JoinRequestPendingItem[];
  initialHistoryRequests: JoinRequestHistoryItem[];
  onPendingCountChange: (count: number) => void;
  onMemberApproved: (user: JoinRequestUser) => void;
};

function timeAgo(input: string) {
  const date = new Date(input).getTime();
  const now = Date.now();
  const diffMs = date - now;
  const diffMin = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");

  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

export function JoinRequestList({
  teamId,
  memberCount,
  maxMembers,
  initialPendingRequests,
  initialHistoryRequests,
  onPendingCountChange,
  onMemberApproved,
}: Props) {
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests);
  const [historyRequests, setHistoryRequests] = useState(initialHistoryRequests);
  const [loadingAction, setLoadingAction] = useState<{
    requestId: string;
    type: "approve" | "reject";
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isFull = memberCount >= maxMembers;

  const orderedPending = useMemo(
    () => [...pendingRequests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [pendingRequests],
  );

  const orderedHistory = useMemo(
    () => [...historyRequests].sort((a, b) => {
      const dateA = a.responded_at ? new Date(a.responded_at).getTime() : new Date(a.created_at).getTime();
      const dateB = b.responded_at ? new Date(b.responded_at).getTime() : new Date(b.created_at).getTime();
      return dateB - dateA;
    }),
    [historyRequests],
  );

  useEffect(() => {
    onPendingCountChange(pendingRequests.length);
  }, [pendingRequests.length, onPendingCountChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function resolveRequest(requestId: string, status: "approved" | "rejected") {
    const request = pendingRequests.find((item) => item.id === requestId);
    if (!request) return;

    if (status === "approved" && isFull) {
      setToast({ type: "error", message: "Equipe atingiu limite de membros" });
      return;
    }

    if (status === "rejected") {
      const ok = window.confirm(`Tem certeza que deseja rejeitar ${request.user.display_name}?`);
      if (!ok) return;
    }

    const previousPending = pendingRequests;
    setPendingRequests((current) => current.filter((item) => item.id !== requestId));
    setLoadingAction({ requestId, type: status === "approved" ? "approve" : "reject" });

    startTransition(async () => {
      const result = await respondToJoinRequest(requestId, status);
      setLoadingAction(null);

      if (!result.success) {
        setPendingRequests(previousPending);
        setToast({ type: "error", message: result.error ?? teamRequestMessages.GENERIC_ERROR });
        return;
      }

      if (status === "approved") {
        onMemberApproved(request.user);
        setToast({ type: "success", message: `${teamRequestMessages.REQUEST_APPROVED}: ${request.user.display_name}` });
      } else {
        setToast({ type: "success", message: `${teamRequestMessages.REQUEST_REJECTED}: ${request.user.display_name}` });
      }

      setHistoryRequests((current) => [
        {
          id: request.id,
          team_id: teamId,
          user_id: request.user_id,
          status,
          created_at: request.created_at,
          responded_at: new Date().toISOString(),
          responded_by: null,
          user: request.user,
          responder_name: "Você",
        },
        ...current,
      ].slice(0, 10));
    });
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <ActionToast tone={toast.type} message={toast.message} />
      ) : null}

      {isFull ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
          {teamRequestMessages.TEAM_FULL}
        </p>
      ) : null}

      {orderedPending.length > 0 ? (
        <div className="space-y-3">
          {orderedPending.map((request) => {
            const isApproving = loadingAction?.requestId === request.id && loadingAction.type === "approve";
            const isRejecting = loadingAction?.requestId === request.id && loadingAction.type === "reject";

            return (
              <article
                key={request.id}
                className="rounded-2xl border border-white/10 bg-white/4 p-4 transition hover:bg-white/6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={request.user.avatar_url} name={request.user.display_name} />
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{request.user.display_name}</p>
                      <p className="text-xs text-slate-400">@{request.user.username}</p>
                      {request.user.xbox_gamertag ? (
                        <p className="mt-1 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-200">
                          Xbox: {request.user.xbox_gamertag}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">{timeAgo(request.created_at)}</div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending || isApproving || isRejecting || isFull}
                    onClick={() => resolveRequest(request.id, "approved")}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/20 disabled:opacity-50"
                    aria-label={`Aprovar solicitação de ${request.user.display_name}`}
                  >
                    {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={isPending || isApproving || isRejecting}
                    onClick={() => resolveRequest(request.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/20 disabled:opacity-50"
                    aria-label={`Rejeitar solicitação de ${request.user.display_name}`}
                  >
                    {isRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Rejeitar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/2 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-300">Nenhuma solicitação pendente</p>
          <p className="mt-1 text-sm text-slate-500">
            Quando usuários solicitarem entrada, aparecerá aqui
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          aria-controls={`join-request-history-${teamId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200"
        >
          <Inbox className="h-4 w-4" />
          Solicitações Respondidas
        </button>

        {showHistory ? (
          <div id={`join-request-history-${teamId}`} className="mt-3 space-y-2">
            {orderedHistory.length > 0 ? (
              orderedHistory.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{item.user.display_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.responder_name ? `Respondido por ${item.responder_name}` : "Respondida"} • {timeAgo(item.responded_at ?? item.created_at)}
                    </p>
                  </div>
                  <span
                    className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      item.status === "approved"
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                        : "border-rose-300/30 bg-rose-300/10 text-rose-200"
                    }`}
                  >
                    {item.status === "approved" ? "Aprovado" : "Rejeitado"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Sem histórico recente.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
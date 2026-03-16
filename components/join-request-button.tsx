"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Loader2, LogOut, UserPlus2, Users, X } from "lucide-react";

import { cancelJoinRequest, createJoinRequest } from "@/app/actions/team-requests";
import { leaveTeam } from "@/app/teams/[id]/actions";
import { ActionToast } from "@/components/action-toast";
import { teamRequestMessages } from "@/lib/team-request-messages";

type Props = {
  teamId: string;
  teamCaptainId: string;
  currentMemberCount: number;
  userId: string | null;
  userXboxGamertag: string | null;
  isMember: boolean;
  hasPendingRequest: boolean;
  pendingRequestId: string | null;
  currentUserTeamCount: number;
  maxUserTeams?: number;
};

export function JoinRequestButton({
  teamId,
  teamCaptainId,
  currentMemberCount,
  userId,
  userXboxGamertag,
  isMember,
  hasPendingRequest,
  pendingRequestId,
  currentUserTeamCount,
  maxUserTeams = 1,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticIsMember, setOptimisticIsMember] = useState(isMember);
  const [optimisticPending, setOptimisticPending] = useState(hasPendingRequest);
  const [actionType, setActionType] = useState<"request" | "cancel" | "leave" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const isFull = currentMemberCount >= 10;
  const isCaptain = Boolean(userId && userId === teamCaptainId);
  const teamLimitReached = currentUserTeamCount >= maxUserTeams;

  useEffect(() => {
    if (!toast) return;
    const timeoutId = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  const state = useMemo(() => {
    if (!userId) return "guest" as const;
    if (isCaptain) return "captain" as const;
    if (optimisticIsMember) return "member" as const;
    if (optimisticPending) return "pending" as const;
    if (teamLimitReached) return "limit" as const;
    if (isFull) return "full" as const;
    return "ready" as const;
  }, [userId, isCaptain, optimisticIsMember, optimisticPending, teamLimitReached, isFull]);

  if (state === "captain") return null;

  async function onRequest() { if (state !== "ready") return; let xboxInput = ""; if (!userXboxGamertag) { const val = window.prompt("Por favor, digite sua Xbox Gamertag para continuar. Isso È necess·rio para entrar em equipes (sÛ pode ser digitado 1 vez):"); if (!val || !val.trim()) { window.alert("Xbox Gamertag È obrigatÛria."); return; } xboxInput = val.trim(); } const confirmed = window.confirm("Deseja enviar solicitaÁ„o de entrada para esta equipe?"); if (!confirmed) return; startTransition(async () => { setActionType("request"); const result = await createJoinRequest(teamId, xboxInput);
      setActionType(null);

      if (!result.success) {
        setToast({ type: "error", message: result.error ?? teamRequestMessages.GENERIC_ERROR });
        return;
      }

      setOptimisticPending(true);
      setToast({ type: "success", message: teamRequestMessages.REQUEST_CREATED });
      router.refresh();
    });
  }

  async function onCancelRequest() {
    if (state !== "pending" || !pendingRequestId) return;

    const confirmed = window.confirm("Deseja cancelar sua solicita√ß√£o de entrada nesta equipe?");
    if (!confirmed) return;

    startTransition(async () => {
      setActionType("cancel");
      const result = await cancelJoinRequest(pendingRequestId);
      setActionType(null);

      if (!result.success) {
        setToast({ type: "error", message: result.error ?? teamRequestMessages.GENERIC_ERROR });
        return;
      }

      setOptimisticPending(false);
      setToast({ type: "info", message: teamRequestMessages.REQUEST_CANCELLED });
      router.refresh();
    });
  }

  async function onLeaveTeam() {
    if (state !== "member") return;

    const confirmed = window.confirm("Deseja sair desta equipe?");
    if (!confirmed) return;

    startTransition(async () => {
      setActionType("leave");
      const result = await leaveTeam({ teamId });
      setActionType(null);

      if (result.error) {
        setToast({ type: "error", message: result.error });
        return;
      }

      setOptimisticIsMember(false);
      setToast({ type: "success", message: result.success ?? "Voc√™ saiu da equipe." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {toast ? (
        <ActionToast tone={toast.type} message={toast.message} />
      ) : null}

      {state === "guest" ? (
        <Link
          href={`/auth/login?next=/teams/${teamId}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-600/30 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-500/30"
          aria-label="Fazer login para solicitar entrada"
        >
          <UserPlus2 className="h-4 w-4" />
          Fa√ßa login para solicitar
        </Link>
      ) : null}

      {state === "member" ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="button"
            disabled
            aria-label="Voc√™ j√° faz parte desta equipe"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4" />
            Sua Equipe
          </button>

          <button
            type="button"
            onClick={onLeaveTeam}
            disabled={isPending}
            aria-label="Sair da equipe"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-300/20 disabled:opacity-50"
          >
            {isPending && actionType === "leave" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {isPending && actionType === "leave" ? "Saindo..." : "Sair da equipe"}
          </button>
        </div>
      ) : null}

      {state === "pending" ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <button
            type="button"
            disabled
            title={teamRequestMessages.WAIT_CAPTAIN}
            aria-label="Solicita√ß√£o pendente"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-200"
          >
            <Clock3 className="h-4 w-4" />
            Solicita√ß√£o Pendente
          </button>
          <button
            type="button"
            onClick={onCancelRequest}
            disabled={isPending || !pendingRequestId}
            aria-label="Cancelar solicita√ß√£o pendente"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {isPending && actionType === "cancel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {isPending && actionType === "cancel" ? "Cancelando..." : "Cancelar"}
          </button>
        </div>
      ) : null}

      {state === "limit" ? (
        <button
          type="button"
          disabled
          title={teamRequestMessages.TEAM_LIMIT}
          aria-label={teamRequestMessages.TEAM_LIMIT}
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-100"
        >
          <Users className="h-4 w-4" />
          Limite de 1 Equipe Atingido
        </button>
      ) : null}

      {state === "full" ? (
        <button
          type="button"
          disabled
          aria-label="Equipe cheia"
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2.5 text-sm font-semibold text-rose-200"
        >
          <Users className="h-4 w-4" />
          Equipe Cheia (10/10)
        </button>
      ) : null}

      {state === "ready" ? (
        <button
          type="button"
          onClick={onRequest}
          disabled={isPending}
          aria-label="Solicitar entrada na equipe"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
        >
          {isPending && actionType === "request" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus2 className="h-4 w-4" />}
          {isPending && actionType === "request" ? "Enviando..." : "Solicitar Entrada"}
        </button>
      ) : null}
    </div>
  );
}



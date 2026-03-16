"use client";

import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Anchor,
  Crown,
  Inbox,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  addTeamMember,
  dissolveTeam,
  removeTeamMember,
  searchTeamCandidates,
  transferLeadership,
  updateTeamSettings,
  type SearchCandidate,
} from "@/app/teams/[id]/actions";
import {
  JoinRequestList,
  type JoinRequestHistoryItem,
  type JoinRequestPendingItem,
  type JoinRequestUser,
} from "@/components/join-request-list";

type MemberRow = {
  user_id: string;
  role: "captain" | "member";
  joined_at: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
};

type TeamInfo = {
  id: string;
  name: string;
  logo_url: string | null;
  max_members: number;
  captain_id: string;
};

type Props = {
  team: TeamInfo;
  initialMembers: MemberRow[];
  initialPendingRequests: JoinRequestPendingItem[];
  initialHistoryRequests: JoinRequestHistoryItem[]; systemMaxMembers?: number;
  onClose: () => void;
};

type TabKey = "members" | "requests" | "add" | "settings";

const createSettingsSchema = (maxAvailable: number) => z.object({
  name: z
    .string()
    .min(3, "Mínimo 3 caracteres.")
    .max(30, "Máximo 30 caracteres.")
    .trim(),
  max_members: z.number().min(1, "Mínimo 1 membro.").max(10, "Máximo 10 membros."), logo_url: z
    .string()
    .refine(
      (v) => v === "" || (() => { try { new URL(v); return true; } catch { return false; } })(),
      { message: "URL inválida." },
    ),
});



function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ManageTeamModal({
  team,
  initialMembers,
  initialPendingRequests,
  initialHistoryRequests,
  onClose, systemMaxMembers = 10
}: Props) {
  const router = useRouter();

  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [tab, setTab] = useState<TabKey>("members");
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; msg: string } | null>(null);
  const [isBusy, startTransition] = useTransition();
  const [pendingCount, setPendingCount] = useState(initialPendingRequests.length);

  const [candidateQuery, setCandidateQuery] = useState("");
  const debouncedCandidateQuery = useDebounce(candidateQuery, 500);
  const [candidateResults, setCandidateResults] = useState<SearchCandidate[]>([]);
  const [pendingAdds, setPendingAdds] = useState<SearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const [confirmTransfer, setConfirmTransfer] = useState<MemberRow | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberRow | null>(null);
  const [confirmDissolveOpen, setConfirmDissolveOpen] = useState(false);
  const [dissolveInput, setDissolveInput] = useState("");

  const memberCount = members.length;
  const fullTeam = memberCount >= team.max_members;
  function handleMemberApproved(user: JoinRequestUser) {
    setMembers((current) => {
      if (current.some((member) => member.user_id === user.id)) return current;
      return [
        ...current,
        {
          user_id: user.id,
          role: "member",
          joined_at: new Date().toISOString(),
          display_name: user.display_name,
          username: user.username,
          avatar_url: user.avatar_url,
          xbox_gamertag: user.xbox_gamertag,
        },
      ];
    });
  }


  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const rankA = a.role === "captain" ? 0 : 1;
      const rankB = b.role === "captain" ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }, [members]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<z.infer<ReturnType<typeof createSettingsSchema>>>({
    resolver: zodResolver(createSettingsSchema(systemMaxMembers)),
    defaultValues: {
      name: team.name, max_members: team.max_members ?? 5,
      logo_url: team.logo_url ?? "",
    },
  });

  useEffect(() => {
    const q = debouncedCandidateQuery.trim();
    if (tab !== "add") return;
    if (q.length < 2) {
      setCandidateResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    searchTeamCandidates(team.id, q).then((rows) => {
      if (cancelled) return;
      const pendingIds = new Set(pendingAdds.map((p) => p.id));
      setCandidateResults(rows.filter((row) => !pendingIds.has(row.id)));
      setSearching(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedCandidateQuery, pendingAdds, tab, team.id]);

  function queueCandidate(candidate: SearchCandidate) {
    if (candidate.team_count >= 1) {
      setFeedback({ type: "error", msg: "Usuário já participa de uma equipe" });
      return;
    }

    if (memberCount + pendingAdds.length >= team.max_members) {
      setFeedback({ type: "error", msg: "A equipe já atingiu o limite máximo de membros." });
      return;
    }
    setPendingAdds((prev) => [...prev, candidate]);
    setCandidateResults((prev) => prev.filter((row) => row.id !== candidate.id));
  }

  function unqueueCandidate(candidateId: string) {
    setPendingAdds((prev) => prev.filter((row) => row.id !== candidateId));
  }

  function addPendingMembers() {
    if (pendingAdds.length === 0) return;

    startTransition(async () => {
      for (const candidate of pendingAdds) {
        const result = await addTeamMember({ teamId: team.id, userId: candidate.id });
        if (result.error) {
          setFeedback({ type: "error", msg: result.error });
          return;
        }
      }

      const now = new Date().toISOString();
      setMembers((prev) => [
        ...prev,
        ...pendingAdds.map((candidate) => ({
          user_id: candidate.id,
          role: "member" as const,
          joined_at: now,
          display_name: candidate.display_name,
          username: candidate.username,
          avatar_url: candidate.avatar_url,
          xbox_gamertag: candidate.xbox_gamertag,
        })),
      ]);
      setPendingAdds([]);
      setFeedback({ type: "success", msg: "Membros adicionados com sucesso." });
      router.refresh();
    });
  }

  function confirmRemoveMember(target: MemberRow) {
    if (target.role === "captain") return;
    setConfirmRemove(target);
  }

  function removeMemberConfirmed() {
    if (!confirmRemove) return;
    const target = confirmRemove;
    setConfirmRemove(null);

    const prev = members;
    setMembers((current) => current.filter((m) => m.user_id !== target.user_id));

    startTransition(async () => {
      const result = await removeTeamMember({ teamId: team.id, targetUserId: target.user_id });
      if (result.error) {
        setMembers(prev);
        setFeedback({ type: "error", msg: result.error });
        return;
      }

      setFeedback({ type: "success", msg: "Membro removido com sucesso." });
      router.refresh();
    });
  }

  function transferLeadershipConfirmed() {
    if (!confirmTransfer) return;
    const target = confirmTransfer;
    setConfirmTransfer(null);

    const prev = members;
    setMembers((current) =>
      current.map((row) => {
        if (row.user_id === target.user_id) return { ...row, role: "captain" as const };
        if (row.role === "captain") return { ...row, role: "member" as const };
        return row;
      }),
    );

    startTransition(async () => {
      const result = await transferLeadership({ teamId: team.id, targetUserId: target.user_id });
      if (result.error) {
        setMembers(prev);
        setFeedback({ type: "error", msg: result.error });
        return;
      }

      setFeedback({ type: "success", msg: "Liderança transferida com sucesso." });
      router.refresh();
    });
  }

  function submitSettings(values: z.infer<ReturnType<typeof createSettingsSchema>>) {
    startTransition(async () => {
      const result = await updateTeamSettings({
        teamId: team.id,
        name: values.name,
        logo_url: values.logo_url,
      });

      if (result.error) {
        setFeedback({ type: "error", msg: result.error });
        return;
      }

      setFeedback({ type: "success", msg: "Configurações salvas com sucesso." });
      router.refresh();
    });
  }

  function submitDissolve() {
    startTransition(async () => {
      const result = await dissolveTeam({ teamId: team.id, confirmName: dissolveInput });
      if (result.error) {
        setFeedback({ type: "error", msg: result.error });
        return;
      }

      onClose();
      router.push("/profile/me");
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d1f33] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Gerenciar Equipe</h2>
            <p className="text-sm text-slate-400">
              {team.name} • {memberCount}/{team.max_members} membros
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-white/10 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "members"} onClick={() => setTab("members")}>
              <Users className="h-4 w-4" />
              Membros
            </TabButton>
            <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
              <Inbox className="h-4 w-4" />
              Solicitações
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                pendingCount > 0
                  ? "bg-amber-300/20 text-amber-100"
                  : "bg-slate-500/20 text-slate-400"
              }`}>
                {pendingCount}
              </span>
            </TabButton>

            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
              <Shield className="h-4 w-4" />
              Configurações
            </TabButton>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {feedback ? (
            <p
              className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${
                feedback.type === "error"
                  ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
                  : "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
              }`}
            >
              {feedback.msg}
            </p>
          ) : null}

          {tab === "requests" ? (
            <JoinRequestList
              teamId={team.id}
              memberCount={memberCount}
              maxMembers={team.max_members}
              initialPendingRequests={initialPendingRequests}
              initialHistoryRequests={initialHistoryRequests}
              onPendingCountChange={setPendingCount}
              onMemberApproved={handleMemberApproved}
            />
          ) : null}

          {tab === "members" ? (
            <div className="space-y-3">
              {orderedMembers.map((member) => {
                const isCaptain = member.role === "captain";
                return (
                  <div
                    key={member.user_id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                      isCaptain
                        ? "border-amber-300/30 bg-amber-300/8"
                        : "border-white/10 bg-white/4"
                    }`}
                  >
                    <Link
                      href={`/profile/${member.user_id}`}
                      className="flex items-center gap-3 transition-opacity hover:opacity-80 rounded-lg p-1 -m-1"
                    >
                      <Avatar src={member.avatar_url} name={member.display_name} />
                      <div>
                        <p className="font-medium text-slate-100">{member.display_name}</p>
                        <p className="text-xs text-slate-400">@{member.username}</p>
                        {member.xbox_gamertag ? (
                          <p className="text-xs text-cyan-300">Xbox: {member.xbox_gamertag}</p>
                        ) : null}
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          isCaptain
                            ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                            : "border-slate-300/20 bg-slate-300/10 text-slate-300"
                        }`}
                      >
                        {isCaptain ? "Capitão" : "Membro"}
                      </span>
                      <span className="text-xs text-slate-500">
                        Entrada: {new Date(member.joined_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>

                      {!isCaptain ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmTransfer(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-50"
                          >
                            <Crown className="h-3.5 w-3.5" />
                            Transferir
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => confirmRemoveMember(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-300/20 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </button>
                        </>
                      ) : (
                        <span
                          title="Você não pode se remover sendo capitão"
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400"
                        >
                          Sem ações
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}



          {tab === "settings" ? (
            <div className="space-y-6">
              <form onSubmit={handleSubmit(submitSettings)} className="space-y-4 rounded-2xl border border-white/10 bg-white/4 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-200">Nome da equipe</label>
                  <input
                    {...register("name")}
                    disabled={isBusy}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-300/40 transition focus:ring"
                  />
                  {errors.name ? <p className="mt-1 text-xs text-rose-400">{errors.name.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-200">Logo URL</label>
                  <div className="flex items-center gap-3">
                    <LogoPreview url={watch("logo_url")} />
                    <input
                      {...register("logo_url")}
                      disabled={isBusy}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-300/40 transition focus:ring"
                    />
                  </div>
                  {errors.logo_url ? <p className="mt-1 text-xs text-rose-400">{errors.logo_url.message}</p> : null} </div> <div> <label className="mb-1.5 block text-sm font-medium text-slate-200">Máximo de Membros</label> <input type="number" {...register("max_members", { valueAsNumber: true })} disabled={isBusy || memberCount >= systemMaxMembers} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-300/40 transition focus:ring" min={Math.max(1, memberCount)} max={systemMaxMembers} /> {errors.max_members ? <p className="mt-1 text-xs text-rose-400">{errors.max_members.message}</p> : null}
                </div>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Salvar alterações
                </button>
              </form>

              <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4">
                <p className="text-sm font-semibold text-rose-200">Zona de Perigo</p>
                <p className="mt-1 text-sm text-rose-100/90">
                  Esta ação remove todos os membros e exclui a equipe permanentemente.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmDissolveOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Apagar equipe
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {confirmTransfer ? (
          <ConfirmPanel
            title="Transferir liderança"
            message={`Transferir liderança para ${confirmTransfer.display_name}?`}
            confirmLabel="Transferir"
            tone="warn"
            onCancel={() => setConfirmTransfer(null)}
            onConfirm={transferLeadershipConfirmed}
          />
        ) : null}

        {confirmRemove ? (
          <ConfirmPanel
            title="Remover membro"
            message={`Remover ${confirmRemove.display_name} da equipe?`}
            confirmLabel="Remover"
            tone="danger"
            onCancel={() => setConfirmRemove(null)}
            onConfirm={removeMemberConfirmed}
          />
        ) : null}

        {confirmDissolveOpen ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-rose-300/30 bg-[#1a2332] p-4">
              <h3 className="text-lg font-bold text-white">Confirmar dissolução</h3>
              <p className="mt-2 text-sm text-slate-300">
                Digite o nome da equipe para confirmar: <span className="font-semibold text-rose-200">{team.name}</span>
              </p>
              <input
                value={dissolveInput}
                onChange={(e) => setDissolveInput(e.target.value)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none"
                placeholder={team.name}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDissolveOpen(false)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isBusy || dissolveInput.trim() !== team.name}
                  onClick={submitDissolve}
                  className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-amber-300/20 text-amber-100"
          : "bg-white/4 text-slate-400 hover:bg-white/8 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return <Image src={src} alt={name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />;
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function LogoPreview({ url }: { url: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Logo"
        className="h-12 w-12 rounded-xl border border-white/10 bg-white/5 object-cover"
      />
    );
  }

  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
      <Anchor className="h-4 w-4 text-slate-500" />
    </span>
  );
}

function ConfirmPanel({
  title,
  message,
  confirmLabel,
  tone,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "warn" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a2332] p-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tone === "warn" ? "bg-amber-400 text-slate-950" : "bg-rose-500 text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

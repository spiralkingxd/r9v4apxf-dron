"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Crown, PlusCircle, RefreshCw, ShieldAlert, Trash2, UserRoundCog, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  addMemberToTeam,
  removeMemberFromTeam,
  transferMemberTeam,
  transferTeamCaptain,
} from "@/app/actions/admin-member-teams";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";

type CurrentTeamItem = {
  id: string;
  name: string;
  logo_url: string | null;
  role: "captain" | "member";
  joined_at: string;
  is_active: boolean;
  member_count: number;
  max_members: number;
};

type AvailableTeamItem = {
  id: string;
  name: string;
  logo_url: string | null;
  member_count: number;
  max_members: number;
};

type TeamHistoryItem = {
  id: string;
  action: string;
  created_at: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type Props = {
  userId: string;
  targetRole: "user" | "admin" | "owner";
  adminRole: "admin" | "owner";
  currentTeams: CurrentTeamItem[];
  availableTeams: AvailableTeamItem[];
  history: TeamHistoryItem[];
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function MemberTeamManagement({
  userId,
  targetRole,
  adminRole,
  currentTeams,
  availableTeams,
  history,
}: Props) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  const [teamSearch, setTeamSearch] = useState("");
  const [addTeamId, setAddTeamId] = useState("");

  const [sourceTeamId, setSourceTeamId] = useState(currentTeams[0]?.id ?? "");
  const [targetTeamId, setTargetTeamId] = useState("");

  const canManage = adminRole === "owner" || targetRole === "user";

  const currentTeamIds = useMemo(() => new Set(currentTeams.map((item) => item.id)), [currentTeams]);

  const filteredAvailable = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    return availableTeams.filter((team) => {
      if (currentTeamIds.has(team.id)) return false;
      if (team.member_count >= team.max_members) return false;
      if (!query) return true;
      return team.name.toLowerCase().includes(query);
    });
  }, [availableTeams, currentTeamIds, teamSearch]);

  function runAction(task: () => Promise<{ error?: string; success?: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await task();
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Acao concluida.");
      if (!result.error) {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function handleAddToTeam() {
    if (!addTeamId) {
      pushToast("info", "Selecione uma equipe para adicionar.");
      return;
    }

    if (!window.confirm("Confirmar adicao deste usuario na equipe selecionada?")) return;

    runAction(() => addMemberToTeam(userId, addTeamId));
  }

  function handleMoveToTeam() {
    if (!sourceTeamId || !targetTeamId) {
      pushToast("info", "Selecione equipe de origem e destino.");
      return;
    }

    if (!window.confirm("Confirmar transferencia de equipe para este usuario?")) return;

    runAction(() => transferMemberTeam(userId, sourceTeamId, targetTeamId));
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">Gerenciamento de Equipes</h2>
        {!canManage ? (
          <AdminBadge tone="danger">Somente owner pode gerenciar este perfil</AdminBadge>
        ) : null}
      </header>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Equipes Atuais</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {currentTeams.map((team) => (
            <article key={`${team.id}-${team.role}`} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 p-4">
              <div className="flex items-start gap-3">
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="h-11 w-11 rounded-lg object-cover border border-white/10" />
                ) : (
                  <div className="h-11 w-11 rounded-lg border border-dashed border-white/15 grid place-items-center text-slate-400">
                    <Users className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/teams/${team.id}`} className="font-semibold text-cyan-700 dark:text-cyan-200 hover:underline">
                    {team.name}
                  </Link>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Cargo: {team.role === "captain" ? "Capitao" : "Membro"}</p>
                  <p className="text-xs text-slate-500">Desde: {dateFmt.format(new Date(team.joined_at))}</p>
                  <p className="text-xs text-slate-500">Membros: {team.member_count}/{team.max_members}</p>
                  <p className="text-xs text-slate-500">Status: {team.is_active ? "Ativa" : "Inativa"}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <AdminButton
                  type="button"
                  variant="danger"
                  disabled={!canManage || isPending}
                  onClick={() => {
                    if (!window.confirm(`Remover usuario da equipe ${team.name}?`)) return;
                    runAction(() => removeMemberFromTeam(userId, team.id));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover da Equipe
                </AdminButton>

                {team.role === "member" ? (
                  <AdminButton
                    type="button"
                    variant="ghost"
                    disabled={!canManage || isPending}
                    onClick={() => {
                      if (!window.confirm(`Transferir capitania da equipe ${team.name} para este usuario?`)) return;
                      runAction(() => transferTeamCaptain(team.id, userId));
                    }}
                  >
                    <Crown className="h-4 w-4" />
                    Transferir para Capitao
                  </AdminButton>
                ) : null}
              </div>
            </article>
          ))}
          {currentTeams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500">
              Usuario sem equipe atualmente.
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Adicionar a Equipe</h3>

        <input
          value={teamSearch}
          onChange={(e) => setTeamSearch(e.target.value)}
          placeholder="Buscar equipe por nome"
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          disabled={!canManage || isPending}
        />

        <div className="flex flex-wrap gap-2">
          <select
            value={addTeamId}
            onChange={(e) => setAddTeamId(e.target.value)}
            className="min-w-[260px] flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm"
            disabled={!canManage || isPending}
          >
            <option value="">Selecionar equipe disponivel</option>
            {filteredAvailable.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.member_count}/{team.max_members})
              </option>
            ))}
          </select>

          <AdminButton
            type="button"
            variant="success"
            disabled={!canManage || isPending}
            onClick={handleAddToTeam}
          >
            <PlusCircle className="h-4 w-4" />
            Adicionar a Equipe
          </AdminButton>
        </div>

        <p className="text-xs text-slate-500">
          Somente equipes com vagas disponiveis aparecem. Regra: usuario deve participar de apenas 1 equipe.
        </p>
      </div>

      {currentTeams.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mover para Outra Equipe</h3>

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={sourceTeamId}
              onChange={(e) => setSourceTeamId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm"
              disabled={!canManage || isPending}
            >
              {currentTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  Origem: {team.name}
                </option>
              ))}
            </select>

            <select
              value={targetTeamId}
              onChange={(e) => setTargetTeamId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm"
              disabled={!canManage || isPending}
            >
              <option value="">Selecionar equipe de destino</option>
              {filteredAvailable.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.member_count}/{team.max_members})
                </option>
              ))}
            </select>
          </div>

          <AdminButton
            type="button"
            variant="ghost"
            disabled={!canManage || isPending}
            onClick={handleMoveToTeam}
          >
            <RefreshCw className="h-4 w-4" />
            Mover para Equipe
          </AdminButton>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Historico de Equipes</h3>
        <ul className="space-y-2">
          {history.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold">{item.action}</p>
              <p>{dateFmt.format(new Date(item.created_at))}</p>
              <p className="text-slate-500">{JSON.stringify(item.new_value ?? item.old_value ?? {})}</p>
            </li>
          ))}
          {history.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-300 dark:border-white/10 px-3 py-2 text-xs text-slate-500">
              Nenhum historico de mudancas de equipe registrado para este membro.
            </li>
          ) : null}
        </ul>
      </div>

      {!canManage ? (
        <p className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4" />
          Admin so pode gerenciar usuarios com role user. Para perfis admin/owner, use conta owner.
        </p>
      ) : null}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        <UserRoundCog className="inline h-4 w-4 mr-1" />
        Acoes registradas em auditoria e refletidas automaticamente apos atualizacao.
      </p>
    </section>
  );
}

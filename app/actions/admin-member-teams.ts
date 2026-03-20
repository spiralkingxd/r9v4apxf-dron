"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";

type ActionResult = {
  success?: string;
  error?: string;
};

type TeamRecord = {
  id: string;
  name: string;
  captain_id: string;
  max_members: number;
  dissolved_at: string | null;
};

const membershipSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid(),
});

const transferSchema = z.object({
  userId: z.string().uuid(),
  oldTeamId: z.string().uuid(),
  newTeamId: z.string().uuid(),
});

const transferCaptainSchema = z.object({
  teamId: z.string().uuid(),
  newCaptainId: z.string().uuid(),
});

function nowIso() {
  return new Date().toISOString();
}

function revalidateMemberTeamPaths(userId: string, teamIds: string[]) {
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath("/profile/me");
  revalidatePath(`/profile/${userId}`);
  for (const id of teamIds) {
    revalidatePath(`/admin/teams/${id}`);
    revalidatePath(`/teams/${id}`);
  }
}

async function insertAdminLog(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  payload: {
    adminId: string;
    action: string;
    userId: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
  },
) {
  await logAdminAction(supabase, {
    adminId: payload.adminId,
    action: payload.action,
    targetType: "user",
    targetId: payload.userId,
    details: {
      oldValue: payload.oldValue ?? null,
      newValue: payload.newValue ?? null,
    },
    previousState: payload.oldValue ?? undefined,
    nextState: payload.newValue ?? undefined,
  });

  await supabase.from("admin_logs").insert({
    user_id: payload.adminId,
    action: payload.action,
    entity_type: "user",
    entity_id: payload.userId,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
  });
}

async function assertTargetManageable(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  adminRole: "admin" | "owner",
  userId: string,
) {
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: "user" | "admin" | "owner" }>();

  if (!target) return { error: "Usuario alvo nao encontrado." };
  if (target.role === "owner") return { error: "Conta owner nao pode ser gerenciada por esta acao." };
  if (target.role === "admin" && adminRole !== "owner") {
    return { error: "Apenas owner pode gerenciar participacao de outro admin em equipes." };
  }

  return { target };
}

async function loadTeamOrError(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  teamId: string,
) {
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, captain_id, max_members, dissolved_at")
    .eq("id", teamId)
    .maybeSingle<TeamRecord>();

  if (!team) return { error: "Equipe nao encontrada." };
  if (team.dissolved_at) return { error: "Equipe inativa/dissolvida." };

  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  return { team, memberCount: count ?? 0 };
}

export async function addMemberToTeam(userId: string, teamId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse({ userId, teamId });
  if (!parsed.success) return { error: "Dados invalidos." };

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "member_added_to_team");

    const targetCheck = await assertTargetManageable(supabase, role, parsed.data.userId);
    if ("error" in targetCheck) return { error: targetCheck.error };

    const { data: currentMemberships } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", parsed.data.userId);

    if ((currentMemberships ?? []).length > 0) {
      return { error: "Usuario ja participa de uma equipe. Use a opcao de mover." };
    }

    const teamCheck = await loadTeamOrError(supabase, parsed.data.teamId);
    if ("error" in teamCheck) return { error: teamCheck.error };

    if (teamCheck.memberCount >= (teamCheck.team.max_members ?? 10)) {
      return { error: "Equipe sem vagas disponiveis." };
    }

    const { error } = await supabase.from("team_members").insert({
      team_id: parsed.data.teamId,
      user_id: parsed.data.userId,
      role: "member",
    });

    if (error) {
      if (error.code === "23505") return { error: "Usuario ja pertence a esta equipe." };
      return { error: "Nao foi possivel adicionar usuario na equipe." };
    }

    await insertAdminLog(supabase, {
      adminId,
      action: "member_added_to_team",
      userId: parsed.data.userId,
      oldValue: null,
      newValue: {
        team_id: parsed.data.teamId,
        team_name: teamCheck.team.name,
      },
    });

    revalidateMemberTeamPaths(parsed.data.userId, [parsed.data.teamId]);
    return { success: `Usuario adicionado a equipe ${teamCheck.team.name}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao adicionar membro em equipe." };
  }
}

export async function removeMemberFromTeam(userId: string, teamId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse({ userId, teamId });
  if (!parsed.success) return { error: "Dados invalidos." };

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "member_removed_from_team");

    const targetCheck = await assertTargetManageable(supabase, role, parsed.data.userId);
    if ("error" in targetCheck) return { error: targetCheck.error };

    const teamCheck = await loadTeamOrError(supabase, parsed.data.teamId);
    if ("error" in teamCheck) return { error: teamCheck.error };

    if (teamCheck.team.captain_id === parsed.data.userId) {
      return { error: "Capitao nao pode ser removido sem transferir lideranca ou dissolver equipe." };
    }

    const { data: membership } = await supabase
      .from("team_members")
      .select("id, role")
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.userId)
      .maybeSingle<{ id: string; role: "captain" | "member" }>();

    if (!membership) return { error: "Usuario nao pertence a esta equipe." };

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.userId);

    if (error) return { error: "Nao foi possivel remover usuario da equipe." };

    await insertAdminLog(supabase, {
      adminId,
      action: "member_removed_from_team",
      userId: parsed.data.userId,
      oldValue: {
        team_id: parsed.data.teamId,
        team_name: teamCheck.team.name,
        role: membership.role,
      },
      newValue: null,
    });

    revalidateMemberTeamPaths(parsed.data.userId, [parsed.data.teamId]);
    return { success: `Usuario removido da equipe ${teamCheck.team.name}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao remover membro da equipe." };
  }
}

export async function transferMemberTeam(
  userId: string,
  oldTeamId: string,
  newTeamId: string,
  _adminId?: string,
): Promise<ActionResult> {
  const parsed = transferSchema.safeParse({ userId, oldTeamId, newTeamId });
  if (!parsed.success) return { error: "Dados invalidos." };

  if (parsed.data.oldTeamId === parsed.data.newTeamId) {
    return { error: "Selecione equipes diferentes para mover o usuario." };
  }

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "member_transferred_team");

    const targetCheck = await assertTargetManageable(supabase, role, parsed.data.userId);
    if ("error" in targetCheck) return { error: targetCheck.error };

    const oldTeamCheck = await loadTeamOrError(supabase, parsed.data.oldTeamId);
    if ("error" in oldTeamCheck) return { error: oldTeamCheck.error };

    const newTeamCheck = await loadTeamOrError(supabase, parsed.data.newTeamId);
    if ("error" in newTeamCheck) return { error: newTeamCheck.error };

    if (newTeamCheck.memberCount >= (newTeamCheck.team.max_members ?? 10)) {
      return { error: "Equipe de destino sem vagas disponiveis." };
    }

    const { data: membership } = await supabase
      .from("team_members")
      .select("id, role")
      .eq("team_id", parsed.data.oldTeamId)
      .eq("user_id", parsed.data.userId)
      .maybeSingle<{ id: string; role: "captain" | "member" }>();

    if (!membership) return { error: "Usuario nao pertence a equipe de origem." };
    if (membership.role === "captain" || oldTeamCheck.team.captain_id === parsed.data.userId) {
      return { error: "Capitao nao pode ser movido sem transferir lideranca antes." };
    }

    const { data: alreadyInTarget } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", parsed.data.newTeamId)
      .eq("user_id", parsed.data.userId)
      .maybeSingle<{ id: string }>();

    if (alreadyInTarget) return { error: "Usuario ja pertence a equipe de destino." };

    const stamp = nowIso();

    const { error: removeError } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", parsed.data.oldTeamId)
      .eq("user_id", parsed.data.userId);

    if (removeError) return { error: "Nao foi possivel remover da equipe de origem." };

    const { error: addError } = await supabase
      .from("team_members")
      .insert({ team_id: parsed.data.newTeamId, user_id: parsed.data.userId, role: "member", joined_at: stamp });

    if (addError) {
      await supabase
        .from("team_members")
        .insert({ team_id: parsed.data.oldTeamId, user_id: parsed.data.userId, role: "member" });
      return { error: "Nao foi possivel inserir na equipe de destino." };
    }

    await insertAdminLog(supabase, {
      adminId,
      action: "member_transferred_team",
      userId: parsed.data.userId,
      oldValue: {
        team_id: parsed.data.oldTeamId,
        team_name: oldTeamCheck.team.name,
      },
      newValue: {
        team_id: parsed.data.newTeamId,
        team_name: newTeamCheck.team.name,
      },
    });

    revalidateMemberTeamPaths(parsed.data.userId, [parsed.data.oldTeamId, parsed.data.newTeamId]);
    return { success: `Usuario movido para equipe ${newTeamCheck.team.name}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao mover usuario entre equipes." };
  }
}

export async function transferTeamCaptain(teamId: string, newCaptainId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = transferCaptainSchema.safeParse({ teamId, newCaptainId });
  if (!parsed.success) return { error: "Dados invalidos." };

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "transfer_team_captain_member_detail");

    const targetCheck = await assertTargetManageable(supabase, role, parsed.data.newCaptainId);
    if ("error" in targetCheck) return { error: targetCheck.error };

    const teamCheck = await loadTeamOrError(supabase, parsed.data.teamId);
    if ("error" in teamCheck) return { error: teamCheck.error };

    if (teamCheck.team.captain_id === parsed.data.newCaptainId) {
      return { error: "Usuario ja e capitao desta equipe." };
    }

    const { data: existingMembership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.newCaptainId)
      .maybeSingle<{ id: string }>();

    if (!existingMembership) {
      if (teamCheck.memberCount >= (teamCheck.team.max_members ?? 10)) {
        return { error: "Equipe sem vagas para adicionar o novo capitao." };
      }

      const { error: addError } = await supabase
        .from("team_members")
        .insert({ team_id: parsed.data.teamId, user_id: parsed.data.newCaptainId, role: "member" });

      if (addError) return { error: "Nao foi possivel adicionar usuario na equipe para transferir capitania." };
    }

    const oldCaptainId = teamCheck.team.captain_id;

    const { error: teamError } = await supabase
      .from("teams")
      .update({ captain_id: parsed.data.newCaptainId, updated_at: nowIso() })
      .eq("id", parsed.data.teamId);

    if (teamError) return { error: "Nao foi possivel transferir capitania." };

    await supabase
      .from("team_members")
      .update({ role: "member" })
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", oldCaptainId);

    await supabase
      .from("team_members")
      .update({ role: "captain" })
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.newCaptainId);

    await insertAdminLog(supabase, {
      adminId,
      action: "team_captain_transferred_member_detail",
      userId: parsed.data.newCaptainId,
      oldValue: {
        team_id: parsed.data.teamId,
        old_captain_id: oldCaptainId,
      },
      newValue: {
        team_id: parsed.data.teamId,
        new_captain_id: parsed.data.newCaptainId,
      },
    });

    revalidateMemberTeamPaths(parsed.data.newCaptainId, [parsed.data.teamId]);
    if (oldCaptainId !== parsed.data.newCaptainId) {
      revalidateMemberTeamPaths(oldCaptainId, [parsed.data.teamId]);
    }

    return { success: "Capitania transferida com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao transferir capitania." };
  }
}

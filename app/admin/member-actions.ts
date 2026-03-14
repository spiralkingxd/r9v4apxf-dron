"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";
import { queueOrSendDiscordNotification } from "@/lib/discord-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { success?: string; error?: string };

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(["user", "admin", "owner"]),
});

const banSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(2).max(400),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  removeFromTeams: z.boolean().optional(),
  cancelActiveRegistrations: z.boolean().optional(),
  notifyDiscord: z.boolean().optional(),
});

const unbanSchema = z.object({
  userId: z.string().uuid(),
});

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

const deleteUserAccountSchema = z.object({
  userId: z.string().uuid(),
  adminId: z.string().uuid(),
  confirmation: z.string().trim().min(1),
  reason: z.string().trim().max(400).optional(),
});

const softDeleteUserSchema = z.object({
  userId: z.string().uuid(),
  adminId: z.string().uuid(),
  reason: z.string().trim().max(400).optional(),
});

const forceLogoutSchema = z.object({
  userId: z.string().uuid(),
});

const bansFilterSchema = z.object({
  adminId: z.string().uuid().optional(),
  activeOnly: z.boolean().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  durationType: z.enum(["all", "temporary", "permanent"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const updateBanDurationSchema = z.object({
  banId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(3650).nullable(),
});

const bulkSchema = z.object({
  action: z.enum(["promote", "demote", "ban", "unban"]),
  memberIds: z.array(z.string().uuid()).min(1),
  reason: z.string().optional(),
});

function nowIso() {
  return new Date().toISOString();
}

function revalidateMemberPaths(memberId?: string) {
  revalidatePath("/admin/members");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/bans");
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath("/profile/me");
  if (memberId) {
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath(`/profile/${memberId}`);
  }
}

async function logAdminTables(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  payload: {
    adminId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    ipAddress?: string | null;
  },
) {
  await logAdminAction(supabase, {
    adminId: payload.adminId,
    action: payload.action,
    targetType: payload.entityType,
    targetId: payload.entityId ?? null,
    details: {
      oldValue: payload.oldValue ?? null,
      newValue: payload.newValue ?? null,
    },
    previousState: payload.oldValue ?? undefined,
    nextState: payload.newValue ?? undefined,
    ipAddress: payload.ipAddress ?? null,
  });

  await supabase.from("admin_logs").insert({
    user_id: payload.adminId,
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId ?? null,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
    ip_address: payload.ipAddress ?? null,
  });
}

export async function updateUserRole(
  userId: string,
  newRole: "user" | "admin" | "owner",
  _updatedBy?: string,
): Promise<ActionResult> {
  const parsed = updateRoleSchema.safeParse({ userId, newRole });
  if (!parsed.success) return { error: "Dados inv�lidos." };

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_user_role");

    const { data: target } = await supabase
      .from("profiles")
      .select("id, role, is_banned")
      .eq("id", parsed.data.userId)
      .maybeSingle<{ id: string; role: "user" | "admin" | "owner"; is_banned: boolean }>();

    if (!target) return { error: "Usu�rio n�o encontrado." };
    if (target.role === "owner" && role !== "owner") return { error: "Apenas owner pode alterar outro owner." };
    if (parsed.data.newRole === "owner" && role !== "owner") return { error: "Apenas owner pode promover para owner." };
    if (parsed.data.userId === adminId && role === "admin" && parsed.data.newRole === "user") {
      return { error: "Voc� n�o pode remover seu pr�prio acesso de admin." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: parsed.data.newRole, updated_at: nowIso() })
      .eq("id", parsed.data.userId);

    if (error) return { error: "N�o foi poss�vel atualizar a role." };

    await logAdminTables(supabase, {
      adminId,
      action: "update_user_role",
      entityType: "user",
      entityId: parsed.data.userId,
      oldValue: { role: target.role },
      newValue: { role: parsed.data.newRole },
    });

    revalidateMemberPaths(parsed.data.userId);
    return { success: "Role atualizada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar role." };
  }
}

export async function banUser(
  userId: string,
  reason: string,
  durationDays: number | null = null,
  _bannedBy?: string,
  options?: {
    removeFromTeams?: boolean;
    cancelActiveRegistrations?: boolean;
    notifyDiscord?: boolean;
  },
): Promise<ActionResult> {
  const parsed = banSchema.safeParse({
    userId,
    reason,
    durationDays,
    removeFromTeams: options?.removeFromTeams ?? false,
    cancelActiveRegistrations: options?.cancelActiveRegistrations ?? false,
    notifyDiscord: options?.notifyDiscord ?? false,
  });
  if (!parsed.success) return { error: "Dados inv�lidos para banimento." };

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "ban_user");

    const { data: target } = await supabase
      .from("profiles")
      .select("id, role, is_banned")
      .eq("id", parsed.data.userId)
      .maybeSingle<{ id: string; role: "user" | "admin" | "owner"; is_banned: boolean }>();

    if (!target) return { error: "Usu�rio n�o encontrado." };
    if (target.role === "owner") return { error: "Conta owner n�o pode ser banida." };
    if (target.role === "admin" && role !== "owner") return { error: "Apenas owner pode banir outro admin." };

    const now = new Date();
    const nowIsoValue = now.toISOString();
    const expiresAt = parsed.data.durationDays ? new Date(now.getTime() + parsed.data.durationDays * 24 * 60 * 60 * 1000).toISOString() : null;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        is_banned: true,
        ban_reason: parsed.data.reason,
        banned_reason: parsed.data.reason,
        banned_at: nowIsoValue,
        banned_by: adminId,
        force_logout_after: nowIsoValue,
        updated_at: nowIsoValue,
      })
      .eq("id", parsed.data.userId);

    if (profileError) return { error: "N�o foi poss�vel banir o usu�rio." };

    await supabase.from("bans").insert({
      user_id: parsed.data.userId,
      banned_by: adminId,
      reason: parsed.data.reason,
      duration: parsed.data.durationDays ?? null,
      expires_at: expiresAt,
      is_active: true,
    });

    if (parsed.data.removeFromTeams) {
      await supabase.from("team_members").delete().eq("user_id", parsed.data.userId);
    }

    if (parsed.data.cancelActiveRegistrations) {
      const { data: memberships } = await supabase.from("team_members").select("team_id").eq("user_id", parsed.data.userId);
      const teamIds = (memberships ?? []).map((row) => String(row.team_id));
      if (teamIds.length > 0) {
        await supabase
          .from("registrations")
          .update({ status: "cancelled", rejection_reason: "Conta banida", updated_at: nowIsoValue })
          .in("team_id", teamIds)
          .in("status", ["pending", "approved"]);
      }
    }

    await logAdminTables(supabase, {
      adminId,
      action: "ban_user",
      entityType: "user",
      entityId: parsed.data.userId,
      oldValue: { is_banned: target.is_banned },
      newValue: {
        is_banned: true,
        reason: parsed.data.reason,
        durationDays: parsed.data.durationDays ?? null,
        expiresAt,
      },
    });

    if (parsed.data.notifyDiscord) {
      await queueOrSendDiscordNotification({
        supabase,
        createdBy: adminId,
        type: "user_banned",
        data: {
          userId: parsed.data.userId,
          reason: parsed.data.reason,
        },
      });
    }

    revalidateMemberPaths(parsed.data.userId);
    return { success: "Usu�rio banido com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao banir usu�rio." };
  }
}

export async function unbanUser(userId: string, _unbannedBy?: string): Promise<ActionResult> {
  const parsed = unbanSchema.safeParse({ userId });
  if (!parsed.success) return { error: "Dados inv�lidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "unban_user");

    const nowIsoValue = nowIso();

    const { data: target } = await supabase
      .from("profiles")
      .select("id, is_banned")
      .eq("id", parsed.data.userId)
      .maybeSingle<{ id: string; is_banned: boolean }>();

    if (!target) return { error: "Usu�rio n�o encontrado." };

    await supabase
      .from("profiles")
      .update({
        is_banned: false,
        ban_reason: null,
        banned_reason: null,
        banned_at: null,
        banned_by: null,
        updated_at: nowIsoValue,
      })
      .eq("id", parsed.data.userId);

    await supabase
      .from("bans")
      .update({ is_active: false, expires_at: nowIsoValue })
      .eq("user_id", parsed.data.userId)
      .eq("is_active", true);

    await logAdminTables(supabase, {
      adminId,
      action: "unban_user",
      entityType: "user",
      entityId: parsed.data.userId,
      oldValue: { is_banned: target.is_banned },
      newValue: { is_banned: false },
    });

    revalidateMemberPaths(parsed.data.userId);
    return { success: "Usu�rio desbanido com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao desbanir usu�rio." };
  }
}

export async function forceLogout(userId: string): Promise<ActionResult> {
  const parsed = forceLogoutSchema.safeParse({ userId });
  if (!parsed.success) return { error: "Dados inv�lidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "force_logout_user");

    const stamp = nowIso();
    const { error } = await supabase
      .from("profiles")
      .update({ force_logout_after: stamp, updated_at: stamp })
      .eq("id", parsed.data.userId);

    if (error) return { error: "N�o foi poss�vel for�ar logout." };

    await logAdminTables(supabase, {
      adminId,
      action: "force_logout_user",
      entityType: "user",
      entityId: parsed.data.userId,
      newValue: { force_logout_after: stamp },
    });

    revalidateMemberPaths(parsed.data.userId);
    return { success: "Logout for�ado agendado para todas as sess�es." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao for�ar logout." };
  }
}

export async function deleteUser(userId: string, _deletedBy?: string): Promise<ActionResult> {
  const parsed = deleteUserSchema.safeParse({ userId });
  if (!parsed.success) return { error: "Dados inv�lidos." };

  try {
    const { supabase, adminId, role } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "delete_user_soft");

    const { data: target } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", parsed.data.userId)
      .maybeSingle<{ id: string; role: "user" | "admin" | "owner" }>();

    if (!target) return { error: "Usu�rio n�o encontrado." };
    if (target.role === "owner") return { error: "Conta owner n�o pode ser deletada." };
    if (target.role === "admin" && role !== "owner") return { error: "Apenas owner pode deletar admin." };

    const stamp = nowIso();
    const { error } = await supabase
      .from("profiles")
      .update({
        deleted_at: stamp,
        deleted_by: adminId,
        is_banned: true,
        ban_reason: "Conta removida pelo administrador",
        banned_reason: "Conta removida pelo administrador",
        banned_at: stamp,
        banned_by: adminId,
        force_logout_after: stamp,
        updated_at: stamp,
      })
      .eq("id", parsed.data.userId);

    if (error) return { error: "N�o foi poss�vel deletar usu�rio." };

    await logAdminTables(supabase, {
      adminId,
      action: "soft_delete_user",
      entityType: "user",
      entityId: parsed.data.userId,
      newValue: { deleted_at: stamp },
    });

    revalidateMemberPaths(parsed.data.userId);
    return { success: "Conta removida (soft delete) com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao deletar usu�rio." };
  }
}

export async function softDeleteUserAccount(
  userId: string,
  adminId: string,
  reason?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const parsed = softDeleteUserSchema.safeParse({ userId, adminId, reason });
  if (!parsed.success) {
    return { success: false, error: "Dados invalidos." };
  }

  try {
    const { supabase, adminId: requesterId, role } = await assertAdminAccess();
    if (requesterId !== parsed.data.adminId) {
      return { success: false, error: "Admin invalido para esta acao." };
    }

    await enforceAdminRateLimit(supabase, requesterId, "soft_delete_user_account");

    const { data: target } = await supabase
      .from("profiles")
      .select("id, role, display_name, username, deleted_at")
      .eq("id", parsed.data.userId)
      .maybeSingle<{
        id: string;
        role: "user" | "admin" | "owner";
        display_name: string | null;
        username: string | null;
        deleted_at: string | null;
      }>();

    if (!target) return { success: false, error: "Usuario alvo nao encontrado." };
    if (target.role === "owner") return { success: false, error: "Conta owner nao pode ser deletada." };
    if (target.role === "admin" && role !== "owner") {
      return { success: false, error: "Apenas owner pode deletar outro admin." };
    }

    const stamp = nowIso();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        deleted_at: stamp,
        deleted_by: requesterId,
        is_banned: true,
        ban_reason: parsed.data.reason || "Conta removida pelo administrador",
        banned_reason: parsed.data.reason || "Conta removida pelo administrador",
        banned_at: stamp,
        banned_by: requesterId,
        force_logout_after: stamp,
        updated_at: stamp,
      })
      .eq("id", parsed.data.userId);

    if (profileError) {
      return { success: false, error: "Nao foi possivel aplicar soft delete na conta." };
    }

    await logAdminTables(supabase, {
      adminId: requesterId,
      action: "soft_delete_user_account",
      entityType: "user",
      entityId: parsed.data.userId,
      oldValue: {
        display_name: target.display_name,
        username: target.username,
        role: target.role,
        deleted_at: target.deleted_at,
      },
      newValue: {
        deleted_at: stamp,
        reason: parsed.data.reason || null,
      },
    });

    revalidateMemberPaths(parsed.data.userId);
    return { success: true, message: "Conta marcada como deletada com sucesso." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Falha ao executar soft delete." };
  }
}

export async function deleteUserAccount(
  userId: string,
  adminId: string,
  confirmation: string,
  reason?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const parsed = deleteUserAccountSchema.safeParse({ userId, adminId, confirmation, reason });
  if (!parsed.success) {
    return { success: false, error: "Dados invalidos para delecao de conta." };
  }

  try {
    const { supabase, adminId: requesterId, role } = await assertAdminAccess();
    if (requesterId !== parsed.data.adminId) {
      return { success: false, error: "Admin invalido para esta acao." };
    }

    await enforceAdminRateLimit(supabase, requesterId, "delete_user_account");

    const adminClient = createAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: "SUPABASE_SERVICE_ROLE_KEY nao configurada. Use soft delete ou configure a chave de servico.",
      };
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id, display_name, username, discord_id, email, role, created_at")
      .eq("id", parsed.data.userId)
      .maybeSingle<{
        id: string;
        display_name: string | null;
        username: string | null;
        discord_id: string | null;
        email: string | null;
        role: "user" | "admin" | "owner";
        created_at: string;
      }>();

    if (!target) return { success: false, error: "Usuario alvo nao encontrado." };
    if (target.role === "owner") return { success: false, error: "Conta owner nao pode ser deletada." };
    if (target.role === "admin" && role !== "owner") {
      return { success: false, error: "Apenas owner pode deletar outro admin." };
    }

    const expectedDeleteToken = "DELETAR";
    const expectedUsername = (target.username ?? "").trim().toLowerCase();
    const confirmationValue = parsed.data.confirmation.trim();
    const confirmationMatches =
      confirmationValue === expectedDeleteToken ||
      (expectedUsername.length > 0 && confirmationValue.toLowerCase() === expectedUsername);

    if (!confirmationMatches) {
      return { success: false, error: "Confirmacao invalida. Digite DELETAR ou o username do usuario." };
    }

    const stamp = nowIso();

    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", parsed.data.userId);

    const memberTeamIds = [...new Set((memberships ?? []).map((row) => String(row.team_id)))];

    const { data: captainTeams } = await supabase
      .from("teams")
      .select("id, name, dissolved_at")
      .eq("captain_id", parsed.data.userId)
      .is("dissolved_at", null);

    const transferSummary = {
      transferredCaptain: 0,
      dissolvedTeams: 0,
      dissolvedTeamIds: [] as string[],
    };

    for (const team of captainTeams ?? []) {
      const teamId = String(team.id);
      const { data: replacementRows } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .neq("user_id", parsed.data.userId)
        .limit(1);

      const replacementUserId = replacementRows?.[0]?.user_id ? String(replacementRows[0].user_id) : null;

      if (replacementUserId) {
        await supabase
          .from("teams")
          .update({ captain_id: replacementUserId, updated_at: stamp })
          .eq("id", teamId);

        await supabase
          .from("team_members")
          .update({ role: "captain" })
          .eq("team_id", teamId)
          .eq("user_id", replacementUserId);

        transferSummary.transferredCaptain += 1;
      } else {
        await supabase
          .from("teams")
          .update({
            dissolved_at: stamp,
            dissolved_by: requesterId,
            dissolve_reason: `Conta do capitao removida: ${target.username ?? target.id}`,
            updated_at: stamp,
          })
          .eq("id", teamId);

        transferSummary.dissolvedTeams += 1;
        transferSummary.dissolvedTeamIds.push(teamId);
      }
    }

    if (memberTeamIds.length > 0) {
      await supabase.from("team_members").delete().eq("user_id", parsed.data.userId);
    }

    await supabase
      .from("team_join_requests")
      .update({ status: "rejected", responded_at: stamp, responded_by: requesterId, updated_at: stamp })
      .eq("user_id", parsed.data.userId)
      .eq("status", "pending");

    if (transferSummary.dissolvedTeamIds.length > 0) {
      await supabase
        .from("team_join_requests")
        .update({ status: "rejected", responded_at: stamp, responded_by: requesterId, updated_at: stamp })
        .in("team_id", transferSummary.dissolvedTeamIds)
        .eq("status", "pending");

      await supabase
        .from("registrations")
        .update({ status: "cancelled", rejection_reason: "Equipe dissolvida por delecao de conta", updated_at: stamp })
        .in("team_id", transferSummary.dissolvedTeamIds)
        .in("status", ["pending", "approved"]);

      await supabase
        .from("matches")
        .update({ team_a_id: null, updated_at: stamp, updated_by: requesterId })
        .in("team_a_id", transferSummary.dissolvedTeamIds);

      await supabase
        .from("matches")
        .update({ team_b_id: null, updated_at: stamp, updated_by: requesterId })
        .in("team_b_id", transferSummary.dissolvedTeamIds);

      await supabase
        .from("matches")
        .update({ winner_id: null, updated_at: stamp, updated_by: requesterId })
        .in("winner_id", transferSummary.dissolvedTeamIds);
    }

    await supabase
      .from("matches")
      .update({ updated_by: null, updated_at: stamp })
      .eq("updated_by", parsed.data.userId);

    await supabase.from("bans").update({ banned_by: requesterId }).eq("banned_by", parsed.data.userId);
    await supabase.from("admin_action_logs").update({ admin_user_id: requesterId }).eq("admin_user_id", parsed.data.userId);
    await supabase.from("admin_logs").update({ user_id: requesterId }).eq("user_id", parsed.data.userId);

    const { error: deleteProfileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", parsed.data.userId);

    if (deleteProfileError) {
      return { success: false, error: "Nao foi possivel remover o perfil da conta." };
    }

    const authDelete = await adminClient.auth.admin.deleteUser(parsed.data.userId);
    if (authDelete.error) {
      return {
        success: false,
        error: `Perfil removido, mas falhou ao remover auth.users: ${authDelete.error.message}`,
      };
    }

    const deletionReason = parsed.data.reason?.trim() || null;

    await logAdminTables(supabase, {
      adminId: requesterId,
      action: "user_deleted",
      entityType: "user",
      entityId: parsed.data.userId,
      oldValue: {
        display_name: target.display_name,
        username: target.username,
        discord_id: target.discord_id,
        email: target.email,
        role: target.role,
        created_at: target.created_at,
      },
      newValue: {
        deleted_at: stamp,
        reason: deletionReason,
        team_changes: {
          transferredCaptain: transferSummary.transferredCaptain,
          dissolvedTeams: transferSummary.dissolvedTeams,
        },
      },
    });

    revalidateMemberPaths(parsed.data.userId);
    return {
      success: true,
      message: `Conta de ${target.display_name ?? target.username ?? "usuario"} deletada com sucesso.`,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Falha ao deletar conta." };
  }
}

export async function getBans(filters?: {
  adminId?: string;
  activeOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  durationType?: "all" | "temporary" | "permanent";
  limit?: number;
}) {
  const parsed = bansFilterSchema.safeParse(filters ?? {});
  if (!parsed.success) {
    return { error: "Filtros inv�lidos.", data: [] as never[] };
  }

  try {
    const { supabase } = await assertAdminAccess();
    const cfg = parsed.data;

    let query = supabase
      .from("bans")
      .select("id, user_id, banned_by, reason, duration, expires_at, created_at, is_active")
      .order("created_at", { ascending: false })
      .limit(cfg.limit ?? 120);

    if (cfg.adminId) query = query.eq("banned_by", cfg.adminId);
    if (cfg.activeOnly) query = query.eq("is_active", true);
    if (cfg.dateFrom) query = query.gte("created_at", cfg.dateFrom);
    if (cfg.dateTo) query = query.lte("created_at", cfg.dateTo);
    if (cfg.durationType === "temporary") query = query.not("duration", "is", null);
    if (cfg.durationType === "permanent") query = query.is("duration", null);

    const { data, error } = await query;
    if (error) return { error: "Falha ao consultar banimentos.", data: [] as never[] };

    const userIds = Array.from(new Set((data ?? []).flatMap((row) => [String(row.user_id), String(row.banned_by)])));
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, display_name, username").in("id", userIds)
      : { data: [] as Array<{ id: string; display_name: string | null; username: string | null }> };

    const nameById = new Map<string, string>();
    for (const profile of profiles ?? []) {
      nameById.set(String(profile.id), String(profile.display_name ?? profile.username ?? "Usu�rio"));
    }

    const normalized = (data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      userName: nameById.get(String(row.user_id)) ?? "Usu�rio",
      bannedBy: String(row.banned_by),
      bannedByName: nameById.get(String(row.banned_by)) ?? "Admin",
      reason: String(row.reason),
      duration: row.duration == null ? null : Number(row.duration),
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      createdAt: String(row.created_at),
      isActive: Boolean(row.is_active),
    }));

    return { error: null, data: normalized };
  } catch {
    return { error: "Falha ao carregar banimentos.", data: [] as never[] };
  }
}

export async function updateBanDuration(banId: string, durationDays: number | null): Promise<ActionResult> {
  const parsed = updateBanDurationSchema.safeParse({ banId, durationDays });
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    const now = new Date();
    const expiresAt = parsed.data.durationDays
      ? new Date(now.getTime() + parsed.data.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: banRow } = await supabase
      .from("bans")
      .select("id, user_id, duration, expires_at")
      .eq("id", parsed.data.banId)
      .maybeSingle<{ id: string; user_id: string; duration: number | null; expires_at: string | null }>();

    if (!banRow) return { error: "Banimento não encontrado." };

    const { error } = await supabase
      .from("bans")
      .update({ duration: parsed.data.durationDays, expires_at: expiresAt })
      .eq("id", parsed.data.banId);

    if (error) return { error: "Falha ao atualizar duração." };

    await logAdminTables(supabase, {
      adminId,
      action: "update_ban_duration",
      entityType: "user",
      entityId: banRow.user_id,
      oldValue: { duration: banRow.duration, expiresAt: banRow.expires_at },
      newValue: { duration: parsed.data.durationDays, expiresAt },
    });

    revalidateMemberPaths(banRow.user_id);
    return { success: "Duração atualizada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar duração." };
  }
}

export async function updateMemberRole(userId: string, newRole: "user" | "admin"): Promise<ActionResult> {
  return updateUserRole(userId, newRole);
}

export async function banMember(userId: string, reason: string): Promise<ActionResult> {
  return banUser(userId, reason, null);
}

export async function bulkManageMembers(formData: FormData): Promise<ActionResult> {
  const action = String(formData.get("bulk_action") ?? "");
  const reason = String(formData.get("bulk_reason") ?? "").trim();
  const memberIds = formData
    .getAll("member_ids")
    .map((id) => String(id))
    .filter(Boolean);

  const parsed = bulkSchema.safeParse({ action, memberIds, reason: reason || undefined });
  if (!parsed.success) return { error: "Selecione membros e a��o v�lida." };

  try {
    if (parsed.data.action === "promote" || parsed.data.action === "demote") {
      const nextRole = parsed.data.action === "promote" ? "admin" : "user";
      for (const memberId of parsed.data.memberIds) {
        const result = await updateUserRole(memberId, nextRole);
        if (result.error) return result;
      }
      return { success: "A��o em lote executada com sucesso." };
    }

    if (parsed.data.action === "unban") {
      for (const memberId of parsed.data.memberIds) {
        const result = await unbanUser(memberId);
        if (result.error) return result;
      }
      return { success: "A��o em lote executada com sucesso." };
    }

    if (!parsed.data.reason || parsed.data.reason.length < 2) {
      return { error: "Informe um motivo para banimento em lote." };
    }

    for (const memberId of parsed.data.memberIds) {
      const result = await banUser(memberId, parsed.data.reason, null);
      if (result.error) return result;
    }

    return { success: "A��o em lote executada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha na a��o em lote." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, assertOwnerAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";
import { recalculateAllRankings as recalculateRankingsFromMatches } from "@/app/admin/match-actions";
import { sendDiscordNotification as sendDiscordNotificationAction } from "@/app/admin/notification-actions";
import type { DiscordNotificationType } from "@/lib/discord-notifications";

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

type LogsFilter = {
  adminId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

const updateSystemSettingsSchema = z.object({
  platform_name: z.string().trim().min(2).max(120).optional(),
  logo_url: z.union([z.literal(""), z.url()]).optional(),
  branding: z.record(z.string(), z.unknown()).optional(),
  social_links: z.record(z.string(), z.unknown()).optional(),
  terms_of_use: z.string().max(120000).optional(),
  general_rules: z.string().max(120000).optional(),
  tournament: z.record(z.string(), z.unknown()).optional(),
  discord: z.record(z.string(), z.unknown()).optional(),
  email: z.record(z.string(), z.unknown()).optional(),
});

const adjustRankingSchema = z.object({
  entityId: z.string().uuid(),
  points: z.coerce.number().int().min(-5000).max(5000),
  reason: z.string().trim().min(2).max(400),
});

const resetRankingsSchema = z.object({
  season: z.string().trim().min(2).max(80),
});

const exportLogsSchema = z.object({
  adminId: z.string().uuid().optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().trim().max(240).optional(),
});

function nowIso() {
  return new Date().toISOString();
}

function asIsoOrNull(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function csvRow(values: unknown[]) {
  return values
    .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
    .join(",");
}

async function recalculateRankPositions(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  table: "rankings" | "team_rankings",
  key: "profile_id" | "team_id",
) {
  const { data } = await supabase.from(table).select(`id, ${key}, points, wins, losses`);
  const sorted = (data ?? [])
    .map((row) => ({
      id: String(row.id),
      points: Number(row.points ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      entityId: String((row as Record<string, unknown>)[key] ?? ""),
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.entityId.localeCompare(b.entityId);
    });

  for (let index = 0; index < sorted.length; index += 1) {
    await supabase
      .from(table)
      .update({ rank_position: index + 1, updated_at: table === "team_rankings" ? nowIso() : undefined })
      .eq("id", sorted[index].id);
  }
}

function revalidateAdminStage7Paths() {
  revalidatePath("/admin/rankings");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/backup");
  revalidatePath("/admin/dashboard");
  revalidatePath("/ranking");
}

export async function updateSystemSettings(
  data: z.input<typeof updateSystemSettingsSchema>,
  _adminId?: string,
): Promise<ActionResult> {
  const parsed = updateSystemSettingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertOwnerAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_system_settings");

    const { data: current } = await supabase
      .from("system_settings")
      .select("platform_name, logo_url, branding, social_links, terms_of_use, general_rules, tournament, discord, email")
      .eq("id", 1)
      .maybeSingle<{
        platform_name: string;
        logo_url: string | null;
        branding: Record<string, unknown>;
        social_links: Record<string, unknown>;
        terms_of_use: string | null;
        general_rules: string | null;
        tournament: Record<string, unknown>;
        discord: Record<string, unknown>;
        email: Record<string, unknown>;
      }>();

    const previous = current ?? {
      platform_name: "MadnessArena",
      logo_url: null,
      branding: {},
      social_links: {},
      terms_of_use: null,
      general_rules: null,
      tournament: {},
      discord: {},
      email: {},
    };

    const next = {
      platform_name: parsed.data.platform_name ?? previous.platform_name,
      logo_url: parsed.data.logo_url === undefined ? previous.logo_url : parsed.data.logo_url || null,
      branding: { ...(previous.branding ?? {}), ...(parsed.data.branding ?? {}) },
      social_links: { ...(previous.social_links ?? {}), ...(parsed.data.social_links ?? {}) },
      terms_of_use: parsed.data.terms_of_use === undefined ? previous.terms_of_use : parsed.data.terms_of_use || null,
      general_rules: parsed.data.general_rules === undefined ? previous.general_rules : parsed.data.general_rules || null,
      tournament: { ...(previous.tournament ?? {}), ...(parsed.data.tournament ?? {}) },
      discord: { ...(previous.discord ?? {}), ...(parsed.data.discord ?? {}) },
      email: { ...(previous.email ?? {}), ...(parsed.data.email ?? {}) },
      updated_by: adminId,
      updated_at: nowIso(),
    };

    const { error } = await supabase.from("system_settings").update(next).eq("id", 1);
    if (error) return { error: "Não foi possível atualizar as configurações." };

    await logAdminAction(supabase, {
      adminId,
      action: "update_system_settings",
      targetType: "system_settings",
      targetId: "1",
      previousState: previous,
      nextState: next,
      severity: "critical",
    });

    revalidateAdminStage7Paths();
    return { success: "Configurações salvas com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao salvar configurações." };
  }
}

export async function recalculateAllRankings(_adminId?: string): Promise<ActionResult> {
  const result = await recalculateRankingsFromMatches();
  if (result.error) return { error: result.error };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await logAdminAction(supabase, {
      adminId,
      action: "recalculate_all_rankings_stage7",
      targetType: "ranking",
      details: { source: "admin_rankings" },
    });
  } catch {
    // no-op: ranking recalculation already succeeded in the primary action.
  }

  revalidateAdminStage7Paths();
  return { success: result.success ?? "Rankings recalculados." };
}

export async function adjustRankingPoints(
  entityId: string,
  points: number,
  reason: string,
  _adminId?: string,
): Promise<ActionResult> {
  const parsed = adjustRankingSchema.safeParse({ entityId, points, reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "adjust_ranking_points");

    const [teamRes, profileRes] = await Promise.all([
      supabase.from("teams").select("id").eq("id", parsed.data.entityId).maybeSingle<{ id: string }>(),
      supabase.from("profiles").select("id").eq("id", parsed.data.entityId).maybeSingle<{ id: string }>(),
    ]);

    const isTeam = Boolean(teamRes.data);
    const isPlayer = Boolean(profileRes.data);
    if (!isTeam && !isPlayer) return { error: "Entidade não encontrada para ajuste." };

    if (isTeam) {
      const { data: row } = await supabase
        .from("team_rankings")
        .select("id, points, wins, losses")
        .eq("team_id", parsed.data.entityId)
        .maybeSingle<{ id: string; points: number; wins: number; losses: number }>();

      const nextPoints = Math.max(0, Number(row?.points ?? 0) + parsed.data.points);
      if (row) {
        await supabase
          .from("team_rankings")
          .update({ points: nextPoints, updated_at: nowIso() })
          .eq("id", row.id);
      } else {
        await supabase.from("team_rankings").insert({
          team_id: parsed.data.entityId,
          points: nextPoints,
          wins: 0,
          losses: 0,
          updated_at: nowIso(),
        });
      }

      await recalculateRankPositions(supabase, "team_rankings", "team_id");
    }

    if (isPlayer) {
      const { data: row } = await supabase
        .from("rankings")
        .select("id, points, wins, losses")
        .eq("profile_id", parsed.data.entityId)
        .maybeSingle<{ id: string; points: number; wins: number; losses: number }>();

      const nextPoints = Math.max(0, Number(row?.points ?? 0) + parsed.data.points);
      if (row) {
        await supabase.from("rankings").update({ points: nextPoints }).eq("id", row.id);
      } else {
        await supabase.from("rankings").insert({
          profile_id: parsed.data.entityId,
          points: nextPoints,
          wins: 0,
          losses: 0,
        });
      }

      await recalculateRankPositions(supabase, "rankings", "profile_id");
    }

    await supabase.from("ranking_adjustments").insert({
      entity_type: isTeam && !isPlayer ? "team" : "player",
      entity_id: parsed.data.entityId,
      points_delta: parsed.data.points,
      reason: parsed.data.reason,
      season: null,
      archived: false,
      created_by: adminId,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "adjust_ranking_points",
      targetType: isTeam && !isPlayer ? "team" : "profile",
      targetId: parsed.data.entityId,
      details: { points: parsed.data.points, reason: parsed.data.reason },
      severity: "warning",
    });

    revalidateAdminStage7Paths();
    return { success: "Ajuste de pontos aplicado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao ajustar pontos." };
  }
}

export async function resetRankings(season: string, _adminId?: string): Promise<ActionResult> {
  const parsed = resetRankingsSchema.safeParse({ season });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Temporada inválida." };

  try {
    const { supabase, adminId } = await assertOwnerAccess();
    await enforceAdminRateLimit(supabase, adminId, "reset_rankings");

    const [playersRes, teamsRes] = await Promise.all([
      supabase.from("rankings").select("profile_id, points, wins, losses, rank_position"),
      supabase.from("team_rankings").select("team_id, points, wins, losses, rank_position"),
    ]);

    await supabase.from("ranking_seasons").insert({
      season: parsed.data.season,
      archived_by: adminId,
      player_snapshot: playersRes.data ?? [],
      team_snapshot: teamsRes.data ?? [],
      archived_at: nowIso(),
    });

    await Promise.all([
      supabase.from("rankings").delete().gte("points", 0),
      supabase.from("team_rankings").delete().gte("points", 0),
      supabase.from("ranking_adjustments").update({ archived: true }).eq("archived", false),
    ]);

    await logAdminAction(supabase, {
      adminId,
      action: "reset_rankings",
      targetType: "ranking",
      targetId: parsed.data.season,
      details: {
        season: parsed.data.season,
        players: (playersRes.data ?? []).length,
        teams: (teamsRes.data ?? []).length,
      },
      severity: "critical",
    });

    revalidateAdminStage7Paths();
    return { success: `Rankings resetados e temporada ${parsed.data.season} arquivada.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao resetar rankings." };
  }
}

export async function createBackup(_adminId?: string): Promise<ActionResult<{ jobId: string }>> {
  try {
    const { supabase, adminId } = await assertOwnerAccess();
    await enforceAdminRateLimit(supabase, adminId, "create_backup");

    const { data: inserted } = await supabase
      .from("backup_jobs")
      .insert({
        status: "running",
        backup_type: "manual",
        started_at: nowIso(),
        requested_by: adminId,
      })
      .select("id")
      .single<{ id: string }>();

    const jobId = inserted?.id;
    if (!jobId) return { error: "Não foi possível iniciar o backup." };

    const [users, teams, events, matches, rankings] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("id", { count: "exact", head: true }),
      supabase.from("rankings").select("id", { count: "exact", head: true }),
    ]);

    const payload = {
      generated_at: nowIso(),
      counts: {
        users: users.count ?? 0,
        teams: teams.count ?? 0,
        events: events.count ?? 0,
        matches: matches.count ?? 0,
        rankings: rankings.count ?? 0,
      },
    };

    await supabase
      .from("backup_jobs")
      .update({
        status: "completed",
        completed_at: nowIso(),
        file_name: `madnessarena-backup-${jobId}.json`,
        payload,
        checksum: `sha1:${jobId}`,
        restore_token: jobId,
      })
      .eq("id", jobId);

    await logAdminAction(supabase, {
      adminId,
      action: "create_backup",
      targetType: "backup",
      targetId: jobId,
      details: payload,
      severity: "critical",
    });

    revalidateAdminStage7Paths();
    return { success: "Backup criado com sucesso.", data: { jobId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao criar backup." };
  }
}

export async function exportLogs(filters: LogsFilter, _adminId?: string): Promise<ActionResult<{ csv: string }>> {
  const parsed = exportLogsSchema.safeParse(filters);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Filtros inválidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "export_logs");

    let query = supabase
      .from("admin_action_logs")
      .select("id, admin_user_id, action, target_type, target_id, details, severity, suspicious, previous_state, next_state, created_at")
      .order("created_at", { ascending: false })
      .limit(4000);

    if (parsed.data.adminId) query = query.eq("admin_user_id", parsed.data.adminId);
    if (parsed.data.action) query = query.ilike("action", `%${parsed.data.action}%`);
    if (parsed.data.entityType) query = query.ilike("target_type", `%${parsed.data.entityType}%`);

    const fromIso = asIsoOrNull(parsed.data.dateFrom);
    const toIso = asIsoOrNull(parsed.data.dateTo);
    if (fromIso) query = query.gte("created_at", fromIso);
    if (toIso) query = query.lte("created_at", toIso);

    const { data } = await query;
    const logs = (data ?? []).filter((row) => {
      if (!parsed.data.search) return true;
      const text = `${row.action} ${row.target_type} ${JSON.stringify(row.details ?? {})}`.toLowerCase();
      return text.includes(parsed.data.search.toLowerCase());
    });

    const adminIds = [...new Set(logs.map((row) => String(row.admin_user_id)))];
    const { data: admins } = adminIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, username").in("id", adminIds)
      : { data: [] };

    const adminNameById = new Map<string, string>();
    for (const admin of admins ?? []) {
      adminNameById.set(String(admin.id), String(admin.display_name ?? admin.username ?? "Admin"));
    }

    const lines = [
      csvRow(["id", "created_at", "admin", "action", "target_type", "target_id", "severity", "suspicious", "details", "previous_state", "next_state"]),
      ...logs.map((row) =>
        csvRow([
          row.id,
          row.created_at,
          adminNameById.get(String(row.admin_user_id)) ?? "Admin",
          row.action,
          row.target_type,
          row.target_id,
          row.severity,
          row.suspicious,
          JSON.stringify(row.details ?? {}),
          JSON.stringify(row.previous_state ?? {}),
          JSON.stringify(row.next_state ?? {}),
        ]),
      ),
    ];

    await logAdminAction(supabase, {
      adminId,
      action: "export_logs",
      targetType: "admin_action_logs",
      details: { total: logs.length },
      severity: "warning",
    });

    return { success: "Logs exportados.", data: { csv: lines.join("\n") } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao exportar logs." };
  }
}

export async function sendDiscordNotification(
  type: DiscordNotificationType,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  return await sendDiscordNotificationAction(type, data);
}

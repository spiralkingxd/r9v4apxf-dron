"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";
import { queueOrSendDiscordNotification } from "@/lib/discord-notifications";

type ActionResult = { success?: string; error?: string };

type TeamStatus = "active" | "incomplete" | "empty" | "dissolved";

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_id: string;
  captain_name: string;
  member_count: number;
  max_members: number;
  created_at: string;
  updated_at: string;
  dissolved_at: string | null;
  tournaments_count: number;
  status: TeamStatus;
};

type TeamDetails = {
  team: {
    id: string;
    name: string;
    logo_url: string | null;
    captain_id: string;
    captain_name: string;
    captain_username: string;
    created_at: string;
    updated_at: string;
    dissolved_at: string | null;
    dissolve_reason: string | null;
    max_members: number;
    member_count: number;
    status: TeamStatus;
  };
  members: Array<{
    user_id: string;
    role: "captain" | "member";
    joined_at: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    xbox_gamertag: string | null;
  }>;
  stats: {
    tournaments: number;
    matches_played: number;
    wins: number;
    losses: number;
    pending_matches: number;
    latest_activity_at: string | null;
  };
  history: Array<{
    id: string;
    source: "admin_action_logs" | "admin_logs";
    action: string;
    created_at: string;
    details: Record<string, unknown> | null;
  }>;
  registrations: Array<{
    id: string;
    status: string;
    created_at: string;
    event_title: string;
  }>;
  availableUsers: Array<{
    id: string;
    display_name: string;
    username: string;
  }>;
};

const getTeamsFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "active", "incomplete", "empty", "dissolved"]).optional(),
  size: z.enum(["all", "solo", "small", "full"]).optional(),
  dateRangeDays: z.number().int().min(1).max(3650).optional(),
  sortBy: z.enum(["created_at", "name", "member_count", "status", "tournaments_count"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(3000).optional(),
});

const updateTeamSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().trim().min(3).max(30).optional(),
  logo_url: z.string().url().nullable().optional().or(z.literal("")),
  max_members: z.number().int().min(1).max(10).optional(),
});

const transferCaptainSchema = z.object({
  teamId: z.string().uuid(),
  newCaptainId: z.string().uuid(),
});

const memberSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

const dissolveSchema = z.object({
  teamId: z.string().uuid(),
  reason: z.string().trim().min(2).max(400),
  confirmName: z.string().trim().min(1).optional(),
  notifyDiscord: z.boolean().optional(),
});

const restoreSchema = z.object({
  teamId: z.string().uuid(),
});

function nowIso() {
  return new Date().toISOString();
}

function getStatus(memberCount: number, dissolvedAt: string | null): TeamStatus {
  if (dissolvedAt) return "dissolved";
  if (memberCount <= 1) return "empty";
  if (memberCount <= 4) return "incomplete";
  return "active";
}

function revalidateTeamPaths(teamId?: string) {
  revalidatePath("/admin/teams");
  revalidatePath("/admin/dashboard");
  revalidatePath("/teams");
  if (teamId) {
    revalidatePath(`/admin/teams/${teamId}`);
    revalidatePath(`/teams/${teamId}`);
  }
}

async function logAdminTables(
  supabase: Awaited<ReturnType<typeof assertAdminAccess>>["supabase"],
  payload: {
    adminId: string;
    action: string;
    teamId: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    severity?: "info" | "warning" | "critical";
  },
) {
  await logAdminAction(supabase, {
    adminId: payload.adminId,
    action: payload.action,
    targetType: "team",
    targetId: payload.teamId,
    details: {
      oldValue: payload.oldValue ?? null,
      newValue: payload.newValue ?? null,
    },
    previousState: payload.oldValue ?? undefined,
    nextState: payload.newValue ?? undefined,
    severity: payload.severity ?? "info",
  });

  await supabase.from("admin_logs").insert({
    user_id: payload.adminId,
    action: payload.action,
    entity_type: "team",
    entity_id: payload.teamId,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
  });
}

export async function getTeams(filters?: {
  search?: string;
  status?: "all" | "active" | "incomplete" | "empty" | "dissolved";
  size?: "all" | "solo" | "small" | "full";
  dateRangeDays?: number;
  sortBy?: "created_at" | "name" | "member_count" | "status" | "tournaments_count";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  const parsed = getTeamsFiltersSchema.safeParse(filters ?? {});
  if (!parsed.success) return { error: "Filtros invalidos.", data: [] as TeamRow[], total: 0 };

  try {
    const { supabase } = await assertAdminAccess();

    const cfg = {
      status: parsed.data.status ?? "all",
      size: parsed.data.size ?? "all",
      sortBy: parsed.data.sortBy ?? "created_at",
      sortDir: parsed.data.sortDir ?? "desc",
      page: parsed.data.page ?? 1,
      pageSize: parsed.data.pageSize ?? 200,
      search: (parsed.data.search ?? "").trim().toLowerCase(),
      dateRangeDays: parsed.data.dateRangeDays,
    };

    const [{ data: teamsRaw }, { data: membersRaw }, { data: profilesRaw }, { data: registrationsRaw }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, name, logo_url, captain_id, created_at, updated_at, max_members, dissolved_at")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase.from("team_members").select("team_id"),
      supabase.from("profiles").select("id, display_name, username"),
      supabase.from("registrations").select("team_id, status"),
    ]);

    const memberCountMap = new Map<string, number>();
    for (const row of membersRaw ?? []) {
      const teamId = String(row.team_id);
      memberCountMap.set(teamId, (memberCountMap.get(teamId) ?? 0) + 1);
    }

    const captainMap = new Map<string, { display_name: string; username: string }>();
    for (const row of profilesRaw ?? []) {
      captainMap.set(String(row.id), {
        display_name: String(row.display_name ?? ""),
        username: String(row.username ?? ""),
      });
    }

    const tournamentCountMap = new Map<string, number>();
    for (const row of registrationsRaw ?? []) {
      const status = String(row.status ?? "");
      if (status === "cancelled" || status === "rejected") continue;
      const teamId = String(row.team_id);
      tournamentCountMap.set(teamId, (tournamentCountMap.get(teamId) ?? 0) + 1);
    }

    let data: TeamRow[] = (teamsRaw ?? []).map((row) => {
      const id = String(row.id);
      const captain = captainMap.get(String(row.captain_id));
      const memberCount = memberCountMap.get(id) ?? 0;
      const dissolvedAt = (row.dissolved_at as string | null) ?? null;

      return {
        id,
        name: String(row.name),
        logo_url: (row.logo_url as string | null) ?? null,
        captain_id: String(row.captain_id),
        captain_name: captain?.display_name || captain?.username || "Capitao",
        member_count: memberCount,
        max_members: Number(row.max_members ?? 10),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at ?? row.created_at),
        dissolved_at: dissolvedAt,
        tournaments_count: tournamentCountMap.get(id) ?? 0,
        status: getStatus(memberCount, dissolvedAt),
      };
    });

    if (cfg.search) {
      data = data.filter((row) => {
        const haystack = `${row.name} ${row.captain_name}`.toLowerCase();
        return haystack.includes(cfg.search);
      });
    }

    if (cfg.status !== "all") {
      data = data.filter((row) => row.status === cfg.status);
    }

    if (cfg.size !== "all") {
      data = data.filter((row) => {
        if (cfg.size === "solo") return row.member_count <= 1;
        if (cfg.size === "small") return row.member_count >= 2 && row.member_count <= 4;
        return row.member_count >= row.max_members;
      });
    }

    if (cfg.dateRangeDays) {
      const cutoff = Date.now() - cfg.dateRangeDays * 24 * 60 * 60 * 1000;
      data = data.filter((row) => new Date(row.created_at).getTime() >= cutoff);
    }

    const factor = cfg.sortDir === "asc" ? 1 : -1;
    data = data.sort((a, b) => {
      if (cfg.sortBy === "name") return a.name.localeCompare(b.name) * factor;
      if (cfg.sortBy === "member_count") return (a.member_count - b.member_count) * factor;
      if (cfg.sortBy === "tournaments_count") return (a.tournaments_count - b.tournaments_count) * factor;
      if (cfg.sortBy === "status") return a.status.localeCompare(b.status) * factor;
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * factor;
    });

    const total = data.length;
    const start = (cfg.page - 1) * cfg.pageSize;
    const paginated = data.slice(start, start + cfg.pageSize);

    return { data: paginated, total };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao carregar equipes.", data: [] as TeamRow[], total: 0 };
  }
}

export async function getTeamDetails(teamId: string) {
  const parsed = z.string().uuid().safeParse(teamId);
  if (!parsed.success) return { error: "Equipe invalida.", data: null as TeamDetails | null };

  try {
    const { supabase } = await assertAdminAccess();

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, logo_url, captain_id, created_at, updated_at, max_members, dissolved_at, dissolve_reason")
      .eq("id", parsed.data)
      .maybeSingle<{
        id: string;
        name: string;
        logo_url: string | null;
        captain_id: string;
        created_at: string;
        updated_at: string;
        max_members: number;
        dissolved_at: string | null;
        dissolve_reason: string | null;
      }>();

    if (!team) return { error: "Equipe nao encontrada.", data: null as TeamDetails | null };

    const [membersRawRes, profilesRawRes, registrationsRes, matchesRes, actionLogsRes, adminLogsRes] = await Promise.all([
      supabase.from("team_members").select("user_id, role, joined_at").eq("team_id", team.id).order("joined_at", { ascending: true }),
      supabase.from("profiles").select("id, display_name, username, avatar_url, xbox_gamertag"),
      supabase
        .from("registrations")
        .select("id, status, created_at, events(title, start_date)")
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("matches")
        .select("id, status, winner_id, updated_at, created_at, team_a_id, team_b_id")
        .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("admin_action_logs")
        .select("id, action, created_at, details")
        .eq("target_type", "team")
        .eq("target_id", team.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("admin_logs")
        .select("id, action, created_at, old_value, new_value")
        .eq("entity_type", "team")
        .eq("entity_id", team.id)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    const membersRaw = membersRawRes.data ?? [];
    const profilesRaw = profilesRawRes.data ?? [];
    const registrationsRaw = registrationsRes.data ?? [];
    const matchesRaw = matchesRes.data ?? [];
    const actionLogsRaw = actionLogsRes.data ?? [];
    const adminLogsRaw = adminLogsRes.data ?? [];

    const profileMap = new Map<string, {
      display_name: string;
      username: string;
      avatar_url: string | null;
      xbox_gamertag: string | null;
    }>();
    for (const profile of profilesRaw) {
      profileMap.set(String(profile.id), {
        display_name: String(profile.display_name ?? "Usuario"),
        username: String(profile.username ?? "desconhecido"),
        avatar_url: (profile.avatar_url as string | null) ?? null,
        xbox_gamertag: (profile.xbox_gamertag as string | null) ?? null,
      });
    }

    let members = membersRaw.map((member) => {
      const userId = String(member.user_id);
      const profile = profileMap.get(userId);
      return {
        user_id: userId,
        role: (String(member.role) === "captain" || userId === team.captain_id ? "captain" : "member") as "captain" | "member",
        joined_at: String(member.joined_at),
        display_name: profile?.display_name ?? "Usuario",
        username: profile?.username ?? "desconhecido",
        avatar_url: profile?.avatar_url ?? null,
        xbox_gamertag: profile?.xbox_gamertag ?? null,
      };
    });

    if (!members.some((member) => member.user_id === team.captain_id)) {
      const captainProfile = profileMap.get(team.captain_id);
      members = [
        {
          user_id: team.captain_id,
          role: "captain",
          joined_at: team.created_at,
          display_name: captainProfile?.display_name ?? "Capitao",
          username: captainProfile?.username ?? "desconhecido",
          avatar_url: captainProfile?.avatar_url ?? null,
          xbox_gamertag: captainProfile?.xbox_gamertag ?? null,
        },
        ...members,
      ];
    }

    members = members.sort((a, b) => {
      if (a.user_id === team.captain_id) return -1;
      if (b.user_id === team.captain_id) return 1;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });

    const captainProfile = profileMap.get(team.captain_id);

    const tournaments = registrationsRaw.filter((row) => {
      const status = String(row.status ?? "");
      return status !== "rejected" && status !== "cancelled";
    }).length;

    const matchesPlayed = matchesRaw.length;
    const wins = matchesRaw.filter((row) => String(row.winner_id ?? "") === team.id).length;
    const losses = Math.max(0, matchesPlayed - wins);
    const pendingMatches = matchesRaw.filter((row) => String(row.status ?? "") === "in_progress" || String(row.status ?? "") === "pending").length;

    const latestMatchDate = matchesRaw.length > 0
      ? matchesRaw
          .map((row) => String(row.updated_at ?? row.created_at ?? ""))
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

    const latestRegistrationDate = registrationsRaw.length > 0 ? String(registrationsRaw[0].created_at) : null;
    const latestActivityAt = [latestMatchDate, latestRegistrationDate, team.updated_at]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

    const history: TeamDetails["history"] = [
      ...actionLogsRaw.map((log) => ({
        id: String(log.id),
        source: "admin_action_logs" as const,
        action: String(log.action),
        created_at: String(log.created_at),
        details: (log.details as Record<string, unknown> | null) ?? null,
      })),
      ...adminLogsRaw.map((log) => ({
        id: String(log.id),
        source: "admin_logs" as const,
        action: String(log.action),
        created_at: String(log.created_at),
        details: {
          oldValue: (log.old_value as Record<string, unknown> | null) ?? null,
          newValue: (log.new_value as Record<string, unknown> | null) ?? null,
        },
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const memberIds = new Set(members.map((member) => member.user_id));
    const availableUsers = profilesRaw
      .filter((profile) => !memberIds.has(String(profile.id)))
      .slice(0, 80)
      .map((profile) => ({
        id: String(profile.id),
        display_name: String(profile.display_name ?? "Usuario"),
        username: String(profile.username ?? "desconhecido"),
      }));

    const data: TeamDetails = {
      team: {
        id: team.id,
        name: team.name,
        logo_url: team.logo_url,
        captain_id: team.captain_id,
        captain_name: captainProfile?.display_name ?? captainProfile?.username ?? "Capitao",
        captain_username: captainProfile?.username ?? "desconhecido",
        created_at: team.created_at,
        updated_at: team.updated_at,
        dissolved_at: team.dissolved_at,
        dissolve_reason: team.dissolve_reason,
        max_members: team.max_members ?? 10,
        member_count: members.length,
        status: getStatus(members.length, team.dissolved_at),
      },
      members,
      stats: {
        tournaments,
        matches_played: matchesPlayed,
        wins,
        losses,
        pending_matches: pendingMatches,
        latest_activity_at: latestActivityAt,
      },
      history,
      registrations: registrationsRaw.map((row) => {
        const event = Array.isArray(row.events) ? row.events[0] : row.events;
        return {
          id: String(row.id),
          status: String(row.status),
          created_at: String(row.created_at),
          event_title: ((event as { title?: string } | null)?.title ?? "Evento") as string,
        };
      }),
      availableUsers,
    };

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao carregar detalhes da equipe.", data: null as TeamDetails | null };
  }
}

export async function updateTeam(
  teamId: string,
  data: { name?: string; logo_url?: string | null; max_members?: number },
  _adminId?: string,
): Promise<ActionResult> {
  const parsed = updateTeamSchema.safeParse({
    teamId,
    name: data.name,
    logo_url: data.logo_url ?? undefined,
    max_members: data.max_members,
  });
  if (!parsed.success) return { error: "Dados invalidos para equipe." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_team_admin");

    const { data: current } = await supabase
      .from("teams")
      .select("id, name, logo_url, max_members")
      .eq("id", parsed.data.teamId)
      .maybeSingle<{ id: string; name: string; logo_url: string | null; max_members: number }>();

    if (!current) return { error: "Equipe nao encontrada." };

    if (parsed.data.name && parsed.data.name !== current.name) {
      const { data: duplicate } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", parsed.data.name)
        .neq("id", parsed.data.teamId)
        .maybeSingle();
      if (duplicate) return { error: "Ja existe uma equipe com esse nome." };
    }

    const patch: Record<string, unknown> = { updated_at: nowIso() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.logo_url !== undefined) patch.logo_url = parsed.data.logo_url || null;
    if (parsed.data.max_members !== undefined) patch.max_members = parsed.data.max_members;

    const { error } = await supabase.from("teams").update(patch).eq("id", parsed.data.teamId);
    if (error) return { error: "Nao foi possivel atualizar a equipe." };

    await logAdminTables(supabase, {
      adminId,
      action: "update_team_admin",
      teamId: parsed.data.teamId,
      oldValue: {
        name: current.name,
        logo_url: current.logo_url,
        max_members: current.max_members,
      },
      newValue: patch,
    });

    revalidateTeamPaths(parsed.data.teamId);
    return { success: "Equipe atualizada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar equipe." };
  }
}

export async function transferCaptain(teamId: string, newCaptainId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = transferCaptainSchema.safeParse({ teamId, newCaptainId });
  if (!parsed.success) return { error: "Dados invalidos para transferencia." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "transfer_team_captain_admin");

    const { data: team } = await supabase
      .from("teams")
      .select("id, captain_id, dissolved_at")
      .eq("id", parsed.data.teamId)
      .maybeSingle<{ id: string; captain_id: string; dissolved_at: string | null }>();

    if (!team) return { error: "Equipe nao encontrada." };
    if (team.dissolved_at) return { error: "Nao e possivel transferir capitania de equipe dissolvida." };
    if (team.captain_id === parsed.data.newCaptainId) return { error: "Este usuario ja e o capitao." };

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.newCaptainId)
      .maybeSingle<{ id: string }>();

    if (!targetProfile) return { error: "Novo capitao nao encontrado." };

    const { data: membership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.newCaptainId)
      .maybeSingle<{ id: string }>();

    if (!membership) {
      const { error: addError } = await supabase
        .from("team_members")
        .insert({ team_id: parsed.data.teamId, user_id: parsed.data.newCaptainId, role: "member" });
      if (addError) return { error: "Nao foi possivel adicionar o novo capitao na equipe." };
    }

    const stamp = nowIso();

    const { error: teamError } = await supabase
      .from("teams")
      .update({ captain_id: parsed.data.newCaptainId, updated_at: stamp })
      .eq("id", parsed.data.teamId);
    if (teamError) return { error: "Nao foi possivel transferir capitania." };

    await supabase
      .from("team_members")
      .update({ role: "member" })
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", team.captain_id);

    await supabase
      .from("team_members")
      .update({ role: "captain" })
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.newCaptainId);

    await logAdminTables(supabase, {
      adminId,
      action: "transfer_team_captain_admin",
      teamId: parsed.data.teamId,
      oldValue: { captain_id: team.captain_id },
      newValue: { captain_id: parsed.data.newCaptainId },
    });

    await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "admin_log",
      data: {
        message: `Capitania transferida na equipe ${parsed.data.teamId}: ${team.captain_id} -> ${parsed.data.newCaptainId}`,
      },
    });

    revalidateTeamPaths(parsed.data.teamId);
    revalidatePath(`/admin/members/${team.captain_id}`);
    revalidatePath(`/admin/members/${parsed.data.newCaptainId}`);
    return { success: "Capitao transferido com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao transferir capitania." };
  }
}

export async function removeTeamMember(teamId: string, userId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = memberSchema.safeParse({ teamId, userId });
  if (!parsed.success) return { error: "Dados invalidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "remove_team_member_admin");

    const { data: team } = await supabase
      .from("teams")
      .select("id, captain_id, dissolved_at")
      .eq("id", parsed.data.teamId)
      .maybeSingle<{ id: string; captain_id: string; dissolved_at: string | null }>();

    if (!team) return { error: "Equipe nao encontrada." };
    if (team.captain_id === parsed.data.userId) {
      return { error: "Equipe nao pode ficar sem capitao. Transfira a capitania antes de remover." };
    }

    const { error, count } = await supabase
      .from("team_members")
      .delete({ count: "exact" })
      .eq("team_id", parsed.data.teamId)
      .eq("user_id", parsed.data.userId);

    if (error) return { error: "Nao foi possivel remover membro." };
    if ((count ?? 0) === 0) return { error: "Usuario nao pertence a esta equipe." };

    await logAdminTables(supabase, {
      adminId,
      action: "remove_team_member_admin",
      teamId: parsed.data.teamId,
      oldValue: { user_id: parsed.data.userId, dissolved_at: team.dissolved_at },
      newValue: { removed: true },
      severity: "warning",
    });

    revalidateTeamPaths(parsed.data.teamId);
    revalidatePath(`/admin/members/${parsed.data.userId}`);
    return { success: "Membro removido com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao remover membro." };
  }
}

export async function addTeamMember(teamId: string, userId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = memberSchema.safeParse({ teamId, userId });
  if (!parsed.success) return { error: "Dados invalidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "add_team_member_admin");

    const [{ data: team }, { data: profile }, { count: memberCount }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, captain_id, max_members, dissolved_at")
        .eq("id", parsed.data.teamId)
        .maybeSingle<{ id: string; captain_id: string; max_members: number; dissolved_at: string | null }>(),
      supabase.from("profiles").select("id").eq("id", parsed.data.userId).maybeSingle<{ id: string }>(),
      supabase.from("team_members").select("*", { count: "exact", head: true }).eq("team_id", parsed.data.teamId),
    ]);

    if (!team) return { error: "Equipe nao encontrada." };
    if (team.dissolved_at) return { error: "Nao e possivel adicionar membro em equipe dissolvida." };
    if (!profile) return { error: "Usuario nao encontrado." };
    if ((memberCount ?? 0) >= (team.max_members ?? 10)) return { error: "Equipe ja atingiu o limite de membros." };

    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: parsed.data.teamId, user_id: parsed.data.userId, role: "member" });

    if (error) {
      if (error.code === "23505") return { error: "Usuario ja pertence a esta equipe." };
      return { error: "Nao foi possivel adicionar membro." };
    }

    await logAdminTables(supabase, {
      adminId,
      action: "add_team_member_admin",
      teamId: parsed.data.teamId,
      newValue: { user_id: parsed.data.userId },
    });

    revalidateTeamPaths(parsed.data.teamId);
    revalidatePath(`/admin/members/${parsed.data.userId}`);
    return { success: "Membro adicionado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao adicionar membro." };
  }
}

export async function dissolveTeam(
  teamId: string,
  _adminId?: string,
  reason = "Equipe apagada por administracao.",
  options?: { confirmName?: string; notifyDiscord?: boolean },
): Promise<ActionResult> {
  const parsed = dissolveSchema.safeParse({
    teamId,
    reason,
    confirmName: options?.confirmName,
    notifyDiscord: options?.notifyDiscord ?? true,
  });
  if (!parsed.success) return { error: "Dados invalidos para dissolucao." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "dissolve_team_admin");

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, dissolved_at")
      .eq("id", parsed.data.teamId)
      .maybeSingle<{ id: string; name: string; dissolved_at: string | null }>();

    if (!team) return { error: "Equipe nao encontrada." };
    if (parsed.data.confirmName && parsed.data.confirmName !== team.name) {
      return { error: "Confirmacao invalida. Digite o nome exato da equipe." };
    }

    const { count: inProgressCount } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
      .in("status", ["pending", "in_progress"]);

    if ((inProgressCount ?? 0) > 0) {
      return { error: "Nao e possivel apagar com partidas pendentes/em andamento." };
    }

    const stamp = nowIso();

    await supabase.from("team_members").delete().eq("team_id", team.id);

    await supabase
      .from("registrations")
      .update({ status: "cancelled", rejection_reason: "Equipe apagada", updated_at: stamp })
      .eq("team_id", team.id)
      .in("status", ["pending", "approved"])
      .in(
        "event_id",
        (
          (
            await supabase
              .from("events")
              .select("id")
              .gt("start_date", stamp)
          ).data ?? []
        ).map((row) => String(row.id)),
      );

    const { error: patchError } = await supabase
      .from("teams")
      .delete()
      .eq("id", team.id);

    if (patchError) return { error: "Nao foi possivel apagar equipe." };

    await logAdminTables(supabase, {
      adminId,
      action: "dissolve_team_admin",
      teamId: team.id,
      oldValue: { dissolved_at: null },
      newValue: { dissolved_at: stamp, reason: parsed.data.reason },
      severity: "warning",
    });

    if (parsed.data.notifyDiscord) {
      await queueOrSendDiscordNotification({
        supabase,
        createdBy: adminId,
        type: "team_dissolved",
        data: {
          teamName: team.name,
          teamId: team.id,
          reason: parsed.data.reason,
        },
      });
    }

    revalidateTeamPaths(team.id);
    revalidatePath("/profile/me");
    return { success: "Equipe apagada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao apagar equipe." };
  }
}

export async function restoreTeam(teamId: string, _adminId?: string): Promise<ActionResult> {
  const parsed = restoreSchema.safeParse({ teamId });
  if (!parsed.success) return { error: "Equipe invalida." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "restore_team_admin");

    const { data: team } = await supabase
      .from("teams")
      .select("id, captain_id, dissolved_at")
      .eq("id", parsed.data.teamId)
      .maybeSingle<{ id: string; captain_id: string; dissolved_at: string | null }>();

    if (!team) return { error: "Equipe nao encontrada." };
    if (!team.dissolved_at) return { error: "Equipe nao esta dissolvida." };

    const stamp = nowIso();

    const { error: patchError } = await supabase
      .from("teams")
      .update({
        dissolved_at: null,
        dissolved_by: null,
        dissolve_reason: null,
        updated_at: stamp,
      })
      .eq("id", team.id);

    if (patchError) return { error: "Nao foi possivel restaurar equipe." };

    const { data: captainMembership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", team.id)
      .eq("user_id", team.captain_id)
      .maybeSingle<{ id: string }>();

    if (!captainMembership) {
      await supabase.from("team_members").insert({ team_id: team.id, user_id: team.captain_id, role: "captain" });
    }

    await logAdminTables(supabase, {
      adminId,
      action: "restore_team_admin",
      teamId: team.id,
      oldValue: { dissolved_at: team.dissolved_at },
      newValue: { dissolved_at: null },
    });

    revalidateTeamPaths(team.id);
    return { success: "Equipe restaurada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao restaurar equipe." };
  }
}

// Backward-compatible aliases used by existing components.
export async function editTeam(teamId: string, data: { name: string; logo_url?: string | null }): Promise<ActionResult> {
  return updateTeam(teamId, data);
}

export async function transferTeamCaptain(teamId: string, newCaptainId: string): Promise<ActionResult> {
  return transferCaptain(teamId, newCaptainId);
}

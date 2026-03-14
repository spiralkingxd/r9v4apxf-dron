"use server";

import { assertAdminAccess } from "@/app/admin/_lib";

type DashboardStat = {
  totalUsers: number;
  newUsersThisMonth: number;
  totalTeams: number;
  activeTeams: number;
  activeTournaments: number;
  matchesToday: number;
  bannedUsers: number;
  pendingJoinRequests: number;
};

type LinePoint = {
  label: string;
  total: number;
};

type PiePoint = {
  name: string;
  value: number;
};

export type DashboardStatsPayload = {
  generatedAt: string;
  stats: DashboardStat;
  tournamentStatus: PiePoint[];
};

export type DashboardActivityPayload = {
  latestUsers: Array<{ id: string; kind: "user"; title: string; createdAt: string; href: string }>;
  latestTeams: Array<{ id: string; kind: "team"; title: string; createdAt: string; href: string }>;
  latestAdminActions: Array<{ id: string; kind: "admin"; title: string; createdAt: string; href: string }>;
};

export type DashboardAlertsPayload = {
  lowMemberTeams: Array<{ id: string; name: string; members: number }>;
  staleJoinRequests48h: Array<{ id: string; teamId: string; teamName: string; userId: string; userName: string; createdAt: string }>;
  staleMatches72h: Array<{ id: string; eventId: string; scheduledAt: string | null; createdAt: string }>;
  potentialMultiAccounts: Array<{ email: string; count: number; users: string[] }>;
};

type ExportType = "overview" | "users" | "teams" | "events" | "registrations";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return `${head}\n${body}`;
}

export async function getDashboardStats(): Promise<DashboardStatsPayload> {
  const { supabase } = await assertAdminAccess();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    { count: totalUsers },
    { count: newUsersThisMonth },
    { count: bannedUsers },
    teamsRes,
    teamMembersRes,
    { count: activeTournaments },
    { count: matchesToday },
    { count: pendingJoinRequests },
    eventsStatusRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
    supabase.from("teams").select("id, dissolved_at"),
    supabase.from("team_members").select("team_id"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("event_kind", "tournament").eq("status", "active"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", startOfDay(now).toISOString())
      .lte("scheduled_at", endOfDay(now).toISOString()),
    supabase.from("team_join_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("events").select("status").eq("event_kind", "tournament"),
  ]);

  const membersByTeam = new Map<string, number>();
  for (const row of teamMembersRes.data ?? []) {
    const teamId = String(row.team_id ?? "");
    if (!teamId) continue;
    membersByTeam.set(teamId, (membersByTeam.get(teamId) ?? 0) + 1);
  }
  const activeTeams = (teamsRes.data ?? []).filter((team) => {
    if (team.dissolved_at) return false;
    const members = membersByTeam.get(String(team.id)) ?? 0;
    return members >= 2;
  }).length;

  const statusCounts = new Map<string, number>([
    ["draft", 0],
    ["active", 0],
    ["finished", 0],
    ["published", 0],
    ["paused", 0],
  ]);
  for (const row of eventsStatusRes.data ?? []) {
    const status = String(row.status ?? "").toLowerCase();
    if (!statusCounts.has(status)) continue;
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const tournamentStatus: PiePoint[] = [
    { name: "Ativos", value: statusCounts.get("active") ?? 0 },
    { name: "Finalizados", value: statusCounts.get("finished") ?? 0 },
    {
      name: "Em planejamento",
      value: (statusCounts.get("draft") ?? 0) + (statusCounts.get("published") ?? 0) + (statusCounts.get("paused") ?? 0),
    },
  ];

  return {
    generatedAt: now.toISOString(),
    stats: {
      totalUsers: totalUsers ?? 0,
      newUsersThisMonth: newUsersThisMonth ?? 0,
      totalTeams: (teamsRes.data ?? []).length,
      activeTeams,
      activeTournaments: activeTournaments ?? 0,
      matchesToday: matchesToday ?? 0,
      bannedUsers: bannedUsers ?? 0,
      pendingJoinRequests: pendingJoinRequests ?? 0,
    },
    tournamentStatus,
  };
}

export async function getWeeklyUsers(): Promise<LinePoint[]> {
  const { supabase } = await assertAdminAccess();
  const now = new Date();
  const weekCount = 8;
  const firstWeek = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (weekCount - 1) * 7));

  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", firstWeek.toISOString());

  const weekMap = new Map<string, number>();
  for (let i = 0; i < weekCount; i += 1) {
    const weekDate = startOfWeek(new Date(firstWeek.getFullYear(), firstWeek.getMonth(), firstWeek.getDate() + i * 7));
    weekMap.set(isoDateKey(weekDate), 0);
  }

  for (const row of data ?? []) {
    const created = row.created_at ? new Date(String(row.created_at)) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = isoDateKey(startOfWeek(created));
    if (!weekMap.has(key)) continue;
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }

  return Array.from(weekMap.entries()).map(([key, total]) => ({
    label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(key)),
    total,
  }));
}

export async function getMonthlyTeams(): Promise<LinePoint[]> {
  const { supabase } = await assertAdminAccess();
  const now = new Date();
  const months = 6;
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data } = await supabase
    .from("teams")
    .select("created_at")
    .gte("created_at", firstMonth.toISOString());

  const byMonth = new Map<string, number>();
  for (let i = 0; i < months; i += 1) {
    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
    byMonth.set(`${date.getFullYear()}-${date.getMonth()}`, 0);
  }

  for (const row of data ?? []) {
    const created = row.created_at ? new Date(String(row.created_at)) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    if (!byMonth.has(key)) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  return Array.from(byMonth.entries()).map(([key, total]) => {
    const [year, month] = key.split("-").map((value) => Number(value));
    return { label: monthLabel(new Date(year, month, 1)), total };
  });
}

export async function getRecentActivity(limit = 5): Promise<DashboardActivityPayload> {
  const { supabase } = await assertAdminAccess();

  const safeLimit = Math.max(1, Math.min(limit, 30));

  const [usersRes, teamsRes, adminLogsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(5, safeLimit)),
    supabase
      .from("teams")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(3, safeLimit)),
    supabase
      .from("admin_logs")
      .select("id, action, entity_type, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(5, safeLimit)),
  ]);

  const latestUsers = (usersRes.data ?? []).map((row) => ({
    id: String(row.id),
    kind: "user" as const,
    title: `Novo usuário: ${String(row.display_name ?? row.username ?? "Usuário")}`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    href: `/admin/members/${row.id}`,
  }));

  const latestTeams = (teamsRes.data ?? []).map((row) => ({
    id: String(row.id),
    kind: "team" as const,
    title: `Equipe criada: ${String(row.name ?? "Equipe")}`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    href: `/admin/teams/${row.id}`,
  }));

  const latestAdminActions = (adminLogsRes.data ?? []).map((row) => ({
    id: String(row.id),
    kind: "admin" as const,
    title: `Ação admin: ${String(row.action)} (${String(row.entity_type)})`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    href:
      row.entity_type === "user" && row.entity_id
        ? `/admin/members/${row.entity_id}`
        : row.entity_type === "team" && row.entity_id
          ? `/admin/teams/${row.entity_id}`
          : row.entity_type === "match" && row.entity_id
            ? `/admin/matches/${row.entity_id}`
            : (row.entity_type === "event" || row.entity_type === "tournament") && row.entity_id
              ? `/admin/tournaments/${row.entity_id}`
              : "/admin/logs",
  }));

  return {
    latestUsers,
    latestTeams,
    latestAdminActions,
  };
}

export async function getSystemAlerts(): Promise<DashboardAlertsPayload> {
  const { supabase } = await assertAdminAccess();

  const now = new Date();
  const before48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const before72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  const [teamsRes, teamMembersRes, staleJoinRequestsRes, staleMatchesRes, profilesRes] = await Promise.all([
    supabase.from("teams").select("id, name, dissolved_at"),
    supabase.from("team_members").select("team_id"),
    supabase
      .from("team_join_requests")
      .select("id, team_id, user_id, created_at")
      .eq("status", "pending")
      .lte("created_at", before48h.toISOString())
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("matches")
      .select("id, event_id, scheduled_at, created_at")
      .in("status", ["pending", "in_progress"])
      .lte("created_at", before72h.toISOString())
      .order("created_at", { ascending: true })
      .limit(50),
    supabase.from("profiles").select("id, display_name, username, email"),
  ]);

  const memberCounts = new Map<string, number>();
  for (const row of teamMembersRes.data ?? []) {
    const teamId = String(row.team_id ?? "");
    if (!teamId) continue;
    memberCounts.set(teamId, (memberCounts.get(teamId) ?? 0) + 1);
  }

  const lowMemberTeams = (teamsRes.data ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "Equipe"),
      members: memberCounts.get(String(row.id)) ?? 0,
    }))
    .filter((row) => {
      const team = (teamsRes.data ?? []).find((item) => String(item.id) === row.id);
      if (team?.dissolved_at) return false;
      return row.members < 2;
    })
    .slice(0, 20);

  const profileNameById = new Map<string, string>();
  const emailToNames = new Map<string, string[]>();
  for (const row of profilesRes.data ?? []) {
    const profileId = String(row.id);
    const name = String(row.display_name ?? row.username ?? "Usuário");
    profileNameById.set(profileId, name);

    const email = String(row.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const list = emailToNames.get(email) ?? [];
    list.push(name);
    emailToNames.set(email, list);
  }

  const teamNameById = new Map<string, string>();
  for (const row of teamsRes.data ?? []) {
    teamNameById.set(String(row.id), String(row.name ?? "Equipe"));
  }

  const staleJoinRequests48h = (staleJoinRequestsRes.data ?? []).map((row) => ({
    id: String(row.id),
    teamId: String(row.team_id),
    teamName: teamNameById.get(String(row.team_id)) ?? "Equipe",
    userId: String(row.user_id),
    userName: profileNameById.get(String(row.user_id)) ?? "Usuário",
    createdAt: String(row.created_at),
  }));

  const staleMatches72h = (staleMatchesRes.data ?? [])
    .filter((row) => {
      const base = row.scheduled_at ? new Date(String(row.scheduled_at)) : new Date(String(row.created_at));
      if (Number.isNaN(base.getTime())) return false;
      return base <= before72h;
    })
    .map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id),
      scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
      createdAt: String(row.created_at),
    }));

  const potentialMultiAccounts = Array.from(emailToNames.entries())
    .filter(([, users]) => users.length > 1)
    .map(([email, users]) => ({
      email,
      count: users.length,
      users: users.slice(0, 4),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    lowMemberTeams,
    staleJoinRequests48h,
    staleMatches72h,
    potentialMultiAccounts,
  };
}

export async function getAlerts(): Promise<DashboardAlertsPayload> {
  return getSystemAlerts();
}

export async function exportData(type: ExportType) {
  const { supabase } = await assertAdminAccess();

  if (type === "overview") {
    const dashboard = await getDashboardStats();
    const csv = toCsv(
      ["metric", "value"],
      [
        ["total_users", dashboard.stats.totalUsers],
        ["new_users_this_month", dashboard.stats.newUsersThisMonth],
        ["total_teams", dashboard.stats.totalTeams],
        ["active_teams", dashboard.stats.activeTeams],
        ["active_tournaments", dashboard.stats.activeTournaments],
        ["matches_today", dashboard.stats.matchesToday],
        ["banned_users", dashboard.stats.bannedUsers],
        ["pending_join_requests", dashboard.stats.pendingJoinRequests],
      ],
    );

    return {
      fileName: `dashboard-overview-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (type === "users") {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, email, role, is_banned, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);

    const csv = toCsv(
      ["id", "display_name", "username", "email", "role", "is_banned", "created_at"],
      (data ?? []).map((row) => [
        row.id,
        row.display_name,
        row.username,
        row.email,
        row.role,
        row.is_banned,
        row.created_at,
      ]),
    );

    return {
      fileName: `users-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (type === "teams") {
    const { data } = await supabase
      .from("teams")
      .select("id, name, captain_id, created_at, max_members")
      .order("created_at", { ascending: false })
      .limit(10000);

    const csv = toCsv(
      ["id", "name", "captain_id", "max_members", "created_at"],
      (data ?? []).map((row) => [row.id, row.name, row.captain_id, row.max_members, row.created_at]),
    );

    return {
      fileName: `teams-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (type === "events") {
    const { data } = await supabase
      .from("events")
      .select("id, title, status, start_date, end_date, prize_pool, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);

    const csv = toCsv(
      ["id", "title", "status", "start_date", "end_date", "prize_pool", "created_at"],
      (data ?? []).map((row) => [
        row.id,
        row.title,
        row.status,
        row.start_date,
        row.end_date,
        row.prize_pool,
        row.created_at,
      ]),
    );

    return {
      fileName: `events-${new Date().toISOString().slice(0, 10)}.csv`,
      content: csv,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  const { data } = await supabase
    .from("registrations")
    .select("id, event_id, team_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  const csv = toCsv(
    ["id", "event_id", "team_id", "status", "created_at"],
    (data ?? []).map((row) => [row.id, row.event_id, row.team_id, row.status, row.created_at]),
  );

  return {
    fileName: `registrations-${new Date().toISOString().slice(0, 10)}.csv`,
    content: csv,
    mimeType: "text/csv;charset=utf-8",
  };
}

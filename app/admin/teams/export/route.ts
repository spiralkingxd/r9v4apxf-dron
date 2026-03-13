import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: "user" | "admin" | "owner" }>();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const ids = idsParam
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const baseQuery = supabase
    .from("teams")
    .select("id, name, logo_url, captain_id, max_members, created_at, updated_at, dissolved_at, dissolve_reason")
    .order("created_at", { ascending: false })
    .limit(3000);

  const { data: teamsRaw } = ids.length ? await baseQuery.in("id", ids) : await baseQuery;

  const teamIds = (teamsRaw ?? []).map((row) => String(row.id));

  const [{ data: membersRaw }, { data: registrationsRaw }, { data: profilesRaw }] = await Promise.all([
    teamIds.length ? supabase.from("team_members").select("team_id").in("team_id", teamIds) : Promise.resolve({ data: [] as never[] }),
    teamIds.length ? supabase.from("registrations").select("team_id, status").in("team_id", teamIds) : Promise.resolve({ data: [] as never[] }),
    supabase.from("profiles").select("id, display_name, username"),
  ]);

  const captainMap = new Map<string, string>();
  for (const row of profilesRaw ?? []) {
    captainMap.set(String(row.id), String(row.display_name ?? row.username ?? "Capitao"));
  }

  const memberCountMap = new Map<string, number>();
  for (const row of membersRaw ?? []) {
    const teamId = String(row.team_id);
    memberCountMap.set(teamId, (memberCountMap.get(teamId) ?? 0) + 1);
  }

  const tournamentCountMap = new Map<string, number>();
  for (const row of registrationsRaw ?? []) {
    const status = String(row.status ?? "");
    if (status === "cancelled" || status === "rejected") continue;
    const teamId = String(row.team_id);
    tournamentCountMap.set(teamId, (tournamentCountMap.get(teamId) ?? 0) + 1);
  }

  const rows = (teamsRaw ?? []).map((row) => {
    const teamId = String(row.id);
    const memberCount = memberCountMap.get(teamId) ?? 0;
    const dissolvedAt = (row.dissolved_at as string | null) ?? null;
    const status = dissolvedAt
      ? "dissolved"
      : memberCount <= 1
        ? "empty"
        : memberCount <= 4
          ? "incomplete"
          : "active";

    return {
      id: teamId,
      name: String(row.name),
      logo_url: (row.logo_url as string | null) ?? null,
      captain_id: String(row.captain_id),
      captain_name: captainMap.get(String(row.captain_id)) ?? "Capitao",
      members: memberCount,
      max_members: Number(row.max_members ?? 10),
      tournaments_count: tournamentCountMap.get(teamId) ?? 0,
      status,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at ?? row.created_at),
      dissolved_at: dissolvedAt,
      dissolve_reason: (row.dissolve_reason as string | null) ?? null,
    };
  });

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: {
        "content-disposition": "attachment; filename=teams-export.json",
      },
    });
  }

  const lines = [
    "id,name,logo_url,captain_id,captain_name,members,max_members,tournaments_count,status,created_at,updated_at,dissolved_at,dissolve_reason",
    ...rows.map((row) => [
      row.id,
      row.name,
      row.logo_url,
      row.captain_id,
      row.captain_name,
      row.members,
      row.max_members,
      row.tournaments_count,
      row.status,
      row.created_at,
      row.updated_at,
      row.dissolved_at,
      row.dissolve_reason,
    ].map(csvCell).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=teams-export.csv",
    },
  });
}

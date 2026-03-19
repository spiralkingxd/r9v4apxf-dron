"use server";

import { assertAdminAccess } from "@/app/admin/_lib";

export type AdminSearchUserOption = {
  id: string;
  title: string;
  subtitle: string;
};

export type AdminSearchTeamOption = {
  id: string;
  title: string;
  subtitle: string;
};

export async function searchAdminUsers(query: string): Promise<AdminSearchUserOption[]> {
  const safe = query.trim();
  if (safe.length < 2) return [];

  try {
    const { supabase } = await assertAdminAccess();
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, xbox_gamertag, discord_id")
      .or(`display_name.ilike.%${safe}%,username.ilike.%${safe}%,xbox_gamertag.ilike.%${safe}%,discord_id.ilike.%${safe}%`)
      .is("deleted_at", null)
      .limit(12);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.display_name ?? row.username ?? "Usuario"),
      subtitle: `@${String(row.username ?? "sem-username")} | Xbox: ${String(row.xbox_gamertag ?? "-")} | Discord: ${String(row.discord_id ?? "-")}`,
    }));
  } catch {
    return [];
  }
}

export async function searchAdminTeams(query: string): Promise<AdminSearchTeamOption[]> {
  const safe = query.trim();
  if (safe.length < 2) return [];

  try {
    const { supabase } = await assertAdminAccess();
    const { data } = await supabase
      .from("teams")
      .select("id, name, captain_id")
      .ilike("name", `%${safe}%`)
      .is("dissolved_at", null)
      .limit(12);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.name ?? "Equipe"),
      subtitle: `ID: ${String(row.id)}`,
    }));
  } catch {
    return [];
  }
}

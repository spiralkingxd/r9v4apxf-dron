"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  type: "user" | "tournament" | "team";
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  url: string;
};

function sanitizeSearchTerm(input: string) {
  return input.replace(/[^a-zA-Z0-9 _-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

export async function globalSearchAction(query: string, filter?: "user" | "tournament" | "team" | "all"): Promise<SearchResult[]> {
  const supabase = await createClient();
  const safeQuery = sanitizeSearchTerm(query);
  if (safeQuery.length < 2) return [];

  const results: SearchResult[] = [];
  const limitPerType = filter && filter !== "all" ? 15 : 5;

  const typeFilter = filter || "all";

  if (typeFilter === "all" || typeFilter === "user") {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, display_name, username, xbox_gamertag, avatar_url")
      .or(`display_name.ilike.%${safeQuery}%,username.ilike.%${safeQuery}%,xbox_gamertag.ilike.%${safeQuery}%`)
      .limit(limitPerType);

    if (users) {
      users.forEach(u => results.push({
        type: "user",
        id: u.id,
        title: u.display_name || u.username || "Usuário",
        subtitle: u.xbox_gamertag || "@" + u.username,
        imageUrl: u.avatar_url,
        url: `/profile/${u.id}`
      }));
    }
  }

  if (typeFilter === "all" || typeFilter === "tournament") {
    const { data: tournaments } = await supabase
      .from("events")
      .select("id, name, event_type, banner_url")
      .ilike("name", `%${safeQuery}%`)
      .limit(limitPerType);

    if (tournaments) {
      tournaments.forEach(t => results.push({
        type: "tournament",
        id: t.id.toString(),
        title: t.name,
        subtitle: t.event_type || "Competição",
        imageUrl: t.banner_url,
        url: `/tournaments/${t.id}`
      }));
    }
  }

  if (typeFilter === "all" || typeFilter === "team") {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, logo_url")
      .ilike("name", `%${safeQuery}%`)
      .limit(limitPerType);

    if (teams) {
      teams.forEach(t => results.push({
        type: "team",
        id: t.id.toString(),
        title: t.name,
        subtitle: "Equipe",
        imageUrl: t.logo_url,
        url: `/teams/${t.id}`
      }));
    }
  }

  return results;
}

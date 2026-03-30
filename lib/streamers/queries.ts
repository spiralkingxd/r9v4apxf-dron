import { createPublicServerClient } from "@/lib/supabase/public-server";
import type { CommunityStreamer, StreamersQuery } from "@/lib/streamers/types";

function normalizeStatus(value?: string): "all" | "live" | "offline" {
  if (value === "live" || value === "offline") return value;
  return "all";
}

function normalizeText(value?: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTag(value?: string) {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getCommunityStreamers(query: StreamersQuery = {}): Promise<CommunityStreamer[]> {
  const supabase = createPublicServerClient();

  const { data, error } = await supabase.rpc("get_madnessarena_streamers", {
    p_search: normalizeText(query.q),
    p_status: normalizeStatus(query.status),
    p_secondary_tag: normalizeTag(query.tag),
  });

  if (error || !data) {
    console.error("[streamers] failed to load streamers", error);
    return [];
  }

  return (data as CommunityStreamer[]).map((row) => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
  }));
}

export async function getCommunityTags(): Promise<Array<{ slug: string; name: string }>> {
  const supabase = createPublicServerClient();
  const { data, error } = await supabase
    .from("streamer_tags")
    .select("slug, name")
    .neq("slug", "madnessarena")
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("[streamers] failed to load tags", error);
    return [];
  }

  return data;
}

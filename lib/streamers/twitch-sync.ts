import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type TwitchStream = {
  user_id: string;
  user_login: string;
  title: string;
  game_name: string;
  viewer_count: number;
  started_at: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getTwitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: now + Math.max(60, data.expires_in - 120) * 1000,
  };
  return data.access_token;
}

function chunk<T>(rows: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size));
  }
  return result;
}

async function fetchTwitchStreams(logins: string[]) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const token = await getTwitchAppToken();
  if (!clientId || !token || logins.length === 0) return [];

  const all: TwitchStream[] = [];
  for (const part of chunk(logins, 100)) {
    const params = new URLSearchParams();
    for (const login of part) {
      params.append("user_login", login);
    }
    const response = await fetch(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as { data: TwitchStream[] };
    all.push(...(payload.data ?? []));
  }
  return all;
}

export async function syncTwitchStreamersStatus() {
  const supabase = createAdminClient();
  if (!supabase) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY missing" };
  }

  const { data: rows, error } = await supabase
    .from("streamers")
    .select("id, username, twitch_login")
    .eq("is_active", true)
    .eq("platform", "twitch");

  if (error) {
    return { ok: false, message: error.message };
  }

  const streamers = (rows ?? []).map((row) => ({
    id: String(row.id),
    login: String(row.twitch_login ?? row.username ?? "").trim().toLowerCase(),
  })).filter((row) => row.login.length > 0);

  if (streamers.length === 0) {
    return { ok: true, checked: 0, live: 0 };
  }

  const streams = await fetchTwitchStreams(streamers.map((row) => row.login));
  const byLogin = new Map<string, TwitchStream>();
  for (const stream of streams) {
    byLogin.set(stream.user_login.toLowerCase(), stream);
  }

  const nowIso = new Date().toISOString();
  const updates = streamers.map((streamer) => {
    const stream = byLogin.get(streamer.login);
    if (!stream) {
      return supabase.from("streamers").update({
        is_live: false,
        live_title: null,
        live_game: null,
        viewers: 0,
        live_started_at: null,
        last_checked_at: nowIso,
      }).eq("id", streamer.id);
    }
    return supabase.from("streamers").update({
      is_live: true,
      live_title: stream.title,
      live_game: stream.game_name,
      viewers: stream.viewer_count,
      live_started_at: stream.started_at,
      last_seen_online: nowIso,
      last_checked_at: nowIso,
    }).eq("id", streamer.id);
  });

  await Promise.all(updates);

  return { ok: true, checked: streamers.length, live: streams.length };
}

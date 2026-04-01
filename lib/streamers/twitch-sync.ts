import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasMadnessArenaTag, normalizeTagList } from "@/lib/streamers/tag-normalize";

type TwitchStream = {
  user_id: string;
  user_login: string;
  title: string;
  game_name: string;
  viewer_count: number;
  started_at: string;
};

type TwitchSearchChannel = {
  id: string;
  broadcaster_login: string;
  display_name: string;
  title: string;
  game_name: string;
  is_live: boolean;
  thumbnail_url: string;
  started_at?: string;
};

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

type TwitchChannelInfo = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  title: string;
  game_name: string;
  tags?: string[];
};

let cachedToken: { value: string; expiresAt: number } | null = null;
const STREAMERS_DEBUG = process.env.STREAMERS_DEBUG?.trim() === "true";

function debugLog(event: string, payload?: Record<string, unknown>) {
  if (!STREAMERS_DEBUG) return;
  console.log(`[streamers/${event}]`, payload ?? {});
}

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

  if (!response.ok) {
    debugLog("token_error", { status: response.status });
    return null;
  }
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

async function fetchTwitchStreamsByIds(userIds: string[]) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const token = await getTwitchAppToken();
  if (!clientId || !token || userIds.length === 0) return [];

  const all: TwitchStream[] = [];
  for (const part of chunk(userIds, 100)) {
    const params = new URLSearchParams();
    for (const userId of part) {
      params.append("user_id", userId);
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

async function fetchTwitchUsersByIds(userIds: string[]) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const token = await getTwitchAppToken();
  if (!clientId || !token || userIds.length === 0) return [];

  const all: TwitchUser[] = [];
  for (const part of chunk(userIds, 100)) {
    const params = new URLSearchParams();
    for (const userId of part) {
      params.append("id", userId);
    }
    const response = await fetch(`https://api.twitch.tv/helix/users?${params.toString()}`, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as { data: TwitchUser[] };
    all.push(...(payload.data ?? []));
  }
  return all;
}

async function fetchTwitchChannelInformation(broadcasterId: string) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const token = await getTwitchAppToken();
  if (!clientId || !token) return null;

  const params = new URLSearchParams({ broadcaster_id: broadcasterId });
  const response = await fetch(`https://api.twitch.tv/helix/channels?${params.toString()}`, {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    debugLog("channel_info_error", { broadcasterId, status: response.status });
    return null;
  }
  const payload = (await response.json()) as { data?: TwitchChannelInfo[] };
  return payload.data?.[0] ?? null;
}

async function fetchTwitchSearchChannels(query: string) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const token = await getTwitchAppToken();
  if (!clientId || !token) return [];

  let cursor: string | null = null;
  const rows: TwitchSearchChannel[] = [];

  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({
      query,
      first: "100",
      live_only: "true",
    });
    if (cursor) params.set("after", cursor);

    const response = await fetch(`https://api.twitch.tv/helix/search/channels?${params.toString()}`, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      debugLog("search_channels_error", { status: response.status, query });
      break;
    }
    const payload = (await response.json()) as {
      data?: TwitchSearchChannel[];
      pagination?: { cursor?: string };
    };
    rows.push(...(payload.data ?? []));
    cursor = payload.pagination?.cursor ?? null;
    if (!cursor) break;
  }

  return rows;
}

async function upsertStreamerFromTwitch(input: {
  twitchId: string;
  login: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isLive: boolean;
  liveTitle?: string | null;
  liveGame?: string | null;
  viewers?: number | null;
  liveStartedAt?: string | null;
  twitchTags: string[];
}) {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false };

  const nowIso = new Date().toISOString();
  const hasMainTag = hasMadnessArenaTag(input.twitchTags);
  const payload = {
    username: input.login,
    display_name: input.displayName || input.login,
    platform: "twitch",
    channel_url: `https://twitch.tv/${input.login}`,
    avatar_url: input.avatarUrl ?? null,
    twitch_id: input.twitchId,
    twitch_login: input.login,
    community_enabled: true,
    stream_origin: "community_auto",
    is_live: input.isLive,
    live_title: input.isLive ? input.liveTitle ?? null : null,
    live_game: input.isLive ? input.liveGame ?? null : null,
    viewers: input.isLive ? Number(input.viewers ?? 0) : 0,
    live_started_at: input.isLive ? input.liveStartedAt ?? null : null,
    last_checked_at: nowIso,
    last_seen_online: input.isLive ? nowIso : null,
    twitch_live_tags: input.twitchTags,
    has_madnessarena_tag: hasMainTag,
    tag_checked_at: nowIso,
  };

  const { error } = await supabase.from("streamers").upsert(payload, {
    onConflict: "twitch_id",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error("[streamers/upsert] failed", error);
    return { ok: false };
  }
  debugLog("upsert_ok", {
    twitchId: input.twitchId,
    login: input.login,
    isLive: input.isLive,
    hasMainTag,
    tagsCount: input.twitchTags.length,
  });

  return { ok: true, hasMainTag };
}

export async function processTwitchStreamOnline(broadcasterId: string) {
  const [channel, users, streams] = await Promise.all([
    fetchTwitchChannelInformation(broadcasterId),
    fetchTwitchUsersByIds([broadcasterId]),
    fetchTwitchStreamsByIds([broadcasterId]),
  ]);

  const user = users[0];
  const stream = streams[0];
  const login = String(channel?.broadcaster_login ?? user?.login ?? stream?.user_login ?? "").trim().toLowerCase();
  if (!login) {
    return { ok: false, message: "Unable to resolve broadcaster login" };
  }

  const rawTags = normalizeTagList(channel?.tags ?? []);
  debugLog("online_tags", {
    broadcasterId,
    login,
    tags: rawTags,
    hasMainTag: hasMadnessArenaTag(rawTags),
  });
  const result = await upsertStreamerFromTwitch({
    twitchId: broadcasterId,
    login,
    displayName: channel?.broadcaster_name ?? user?.display_name ?? login,
    avatarUrl: user?.profile_image_url ?? null,
    isLive: true,
    liveTitle: stream?.title ?? channel?.title ?? null,
    liveGame: stream?.game_name ?? channel?.game_name ?? null,
    viewers: stream?.viewer_count ?? 0,
    liveStartedAt: stream?.started_at ?? null,
    twitchTags: rawTags,
  });

  return { ok: result.ok, included: result.ok && Boolean(result.hasMainTag) };
}

export async function processTwitchStreamOffline(broadcasterId: string) {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY missing" };

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("streamers")
    .update({
      is_live: false,
      live_title: null,
      live_game: null,
      viewers: 0,
      live_started_at: null,
      last_checked_at: nowIso,
    })
    .eq("twitch_id", broadcasterId);
  debugLog("offline_processed", { broadcasterId, ok: !error });

  return { ok: !error };
}

export async function processTwitchChannelUpdate(broadcasterId: string) {
  const channel = await fetchTwitchChannelInformation(broadcasterId);
  if (!channel) return { ok: false };

  const normalizedTags = normalizeTagList(channel.tags ?? []);
  const hasMainTag = hasMadnessArenaTag(normalizedTags);
  debugLog("channel_update_tags", {
    broadcasterId,
    tags: normalizedTags,
    hasMainTag,
  });
  const supabase = createAdminClient();
  if (!supabase) return { ok: false };

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("streamers")
    .update({
      live_title: channel.title || null,
      live_game: channel.game_name || null,
      twitch_live_tags: normalizedTags,
      has_madnessarena_tag: hasMainTag,
      tag_checked_at: nowIso,
      last_checked_at: nowIso,
    })
    .eq("twitch_id", broadcasterId);

  return { ok: !error };
}

export async function discoverMadnessArenaStreamers() {
  const supabase = createAdminClient();
  if (!supabase) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY missing" };
  }

  const channels = await fetchTwitchSearchChannels("madnessarena");
  debugLog("discover_search_result", { total: channels.length });
  if (channels.length === 0) {
    return { ok: true, discovered: 0, upserted: 0 };
  }

  let upserted = 0;
  let included = 0;
  let ignored = 0;
  const samples: Array<{ login: string; included: boolean }> = [];

  for (const channel of channels) {
    const username = String(channel.broadcaster_login ?? "").trim().toLowerCase();
    const twitchId = String(channel.id ?? "").trim();
    if (!username || !twitchId) continue;
    const processed = await processTwitchStreamOnline(twitchId);
    if (processed.ok) {
      upserted += 1;
      if (processed.included) {
        included += 1;
        if (samples.length < 10) samples.push({ login: username, included: true });
      } else {
        ignored += 1;
        if (samples.length < 10) samples.push({ login: username, included: false });
      }
    }
  }

  const result = { ok: true, discovered: channels.length, upserted, included, ignored, samples };
  debugLog("discover_result", result);
  return result;
}

export async function syncTwitchStreamersStatus() {
  const supabase = createAdminClient();
  if (!supabase) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY missing" };
  }

  const { data: rows, error } = await supabase
    .from("streamers")
    .select("id, username, twitch_login, twitch_id")
    .eq("community_enabled", true)
    .eq("stream_origin", "community_auto")
    .eq("platform", "twitch");

  if (error) {
    return { ok: false, message: error.message };
  }

  const streamers = (rows ?? []).map((row) => ({
    id: String(row.id),
    twitchId: String(row.twitch_id ?? "").trim(),
    login: String(row.twitch_login ?? row.username ?? "").trim().toLowerCase(),
  })).filter((row) => row.login.length > 0 && row.twitchId.length > 0);

  if (streamers.length === 0) {
    return { ok: true, checked: 0, live: 0 };
  }

  const streams = await fetchTwitchStreams(streamers.map((row) => row.login));
  const byLogin = new Map<string, TwitchStream>();
  for (const stream of streams) {
    byLogin.set(stream.user_login.toLowerCase(), stream);
  }

  const nowIso = new Date().toISOString();
  let liveWithTag = 0;
  let liveWithoutTag = 0;
  let offline = 0;
  const samples: Array<{ login: string; status: "live_with_tag" | "live_without_tag" | "offline" }> = [];

  const updates = streamers.map(async (streamer) => {
    const stream = byLogin.get(streamer.login);
    if (!stream) {
      offline += 1;
      if (samples.length < 20) samples.push({ login: streamer.login, status: "offline" });
      return processTwitchStreamOffline(streamer.twitchId);
    }

    const channel = await fetchTwitchChannelInformation(stream.user_id);
    const user = (await fetchTwitchUsersByIds([stream.user_id]))[0];
    const tags = normalizeTagList(channel?.tags ?? []);
    const hasMainTag = hasMadnessArenaTag(tags);
    if (hasMainTag) {
      liveWithTag += 1;
      if (samples.length < 20) samples.push({ login: streamer.login, status: "live_with_tag" });
    } else {
      liveWithoutTag += 1;
      if (samples.length < 20) samples.push({ login: streamer.login, status: "live_without_tag" });
    }
    return upsertStreamerFromTwitch({
      twitchId: stream.user_id,
      login: streamer.login,
      displayName: channel?.broadcaster_name ?? user?.display_name ?? streamer.login,
      avatarUrl: user?.profile_image_url ?? null,
      isLive: true,
      liveTitle: stream.title,
      liveGame: stream.game_name,
      viewers: stream.viewer_count,
      liveStartedAt: stream.started_at,
      twitchTags: tags,
    });
  });

  await Promise.all(updates);

  const result = {
    ok: true,
    checked: streamers.length,
    live: streams.length,
    liveWithTag,
    liveWithoutTag,
    offline,
    at: nowIso,
    samples,
  };
  debugLog("sync_result", result);
  return result;
}

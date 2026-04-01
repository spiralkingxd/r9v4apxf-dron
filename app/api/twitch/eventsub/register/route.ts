import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
};

async function getTwitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

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
  const data = (await response.json()) as TwitchTokenResponse;
  return data.access_token;
}

function resolveCallbackUrl(request: Request) {
  const explicit = process.env.TWITCH_EVENTSUB_WEBHOOK_URL?.trim();
  if (explicit) return explicit;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return `${appUrl}/api/twitch/eventsub`;

  try {
    const url = new URL(request.url);
    return `${url.origin}/api/twitch/eventsub`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const expected = process.env.STREAMERS_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const secret = process.env.TWITCH_EVENTSUB_SECRET?.trim();
  const callback = resolveCallbackUrl(request);
  const missing: string[] = [];
  if (!clientId) missing.push("TWITCH_CLIENT_ID");
  if (!secret) missing.push("TWITCH_EVENTSUB_SECRET");
  if (!callback) missing.push("TWITCH_EVENTSUB_WEBHOOK_URL or NEXT_PUBLIC_APP_URL");

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing ${missing.join(", ")}` },
      { status: 500 },
    );
  }
  const resolvedClientId = clientId as string;
  const resolvedSecret = secret as string;
  const resolvedCallback = callback as string;

  const token = await getTwitchAppToken();
  if (!token) {
    return NextResponse.json({ error: "Unable to get Twitch app token" }, { status: 500 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });
  }

  const { data: rows, error } = await supabase
    .from("streamers")
    .select("id, twitch_id")
    .eq("community_enabled", true)
    .eq("platform", "twitch")
    .not("twitch_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const twitchIds = (rows ?? []).map((row) => String(row.twitch_id ?? "").trim()).filter(Boolean);
  if (twitchIds.length === 0) {
    return NextResponse.json({ ok: true, registered: 0, skipped: 0 });
  }

  let registered = 0;
  let skipped = 0;

  for (const broadcasterUserId of twitchIds) {
    for (const type of ["stream.online", "stream.offline", "channel.update"] as const) {
      const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          "Client-ID": resolvedClientId,
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type,
          version: "1",
          condition: { broadcaster_user_id: broadcasterUserId },
          transport: {
            method: "webhook",
            callback: resolvedCallback,
            secret: resolvedSecret,
          },
        }),
      });

      if (response.ok) {
        registered += 1;
      } else if (response.status === 409) {
        skipped += 1;
      } else {
        const text = await response.text();
        console.error("[eventsub/register] failed", { broadcasterUserId, type, status: response.status, text });
      }
    }
  }

  return NextResponse.json({ ok: true, registered, skipped, callback: resolvedCallback });
}

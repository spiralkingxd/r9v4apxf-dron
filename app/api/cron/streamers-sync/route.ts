import { NextResponse } from "next/server";

import { discoverMadnessArenaStreamers, syncTwitchStreamersStatus } from "@/lib/streamers/twitch-sync";

export async function GET(request: Request) {
  const expected = process.env.STREAMERS_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");

  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const discovery = await discoverMadnessArenaStreamers();
  const sync = await syncTwitchStreamersStatus();
  const ok = Boolean(discovery.ok && sync.ok);
  const debug = process.env.STREAMERS_DEBUG?.trim() === "true";
  if (debug) {
    console.log("[streamers/cron] completed", { ok, discovery, sync });
  }

  return NextResponse.json(
    {
      ok,
      discovery,
      sync,
    },
    { status: ok ? 200 : 500 },
  );
}

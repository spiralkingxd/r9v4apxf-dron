import { NextResponse } from "next/server";

import { syncTwitchStreamersStatus } from "@/lib/streamers/twitch-sync";

export async function GET(request: Request) {
  const expected = process.env.STREAMERS_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");

  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncTwitchStreamersStatus();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}

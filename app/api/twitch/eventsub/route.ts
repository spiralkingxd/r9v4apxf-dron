import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

function verifySignature(params: {
  messageId: string;
  timestamp: string;
  body: string;
  signature: string;
  secret: string;
}) {
  const payload = params.messageId + params.timestamp + params.body;
  const digest = crypto.createHmac("sha256", params.secret).update(payload).digest("hex");
  const expected = `sha256=${digest}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
}

export async function POST(request: Request) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "TWITCH_EVENTSUB_SECRET missing" }, { status: 500 });
  }

  const messageId = request.headers.get("Twitch-Eventsub-Message-Id");
  const timestamp = request.headers.get("Twitch-Eventsub-Message-Timestamp");
  const signature = request.headers.get("Twitch-Eventsub-Message-Signature");
  const messageType = request.headers.get("Twitch-Eventsub-Message-Type");

  if (!messageId || !timestamp || !signature || !messageType) {
    return NextResponse.json({ error: "Missing Twitch headers" }, { status: 400 });
  }

  const body = await request.text();
  const valid = verifySignature({ messageId, timestamp, body, signature, secret });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as {
    challenge?: string;
    subscription?: { type?: string };
    event?: { broadcaster_user_id?: string };
  };

  if (messageType === "webhook_callback_verification" && payload.challenge) {
    return new NextResponse(payload.challenge, { status: 200 });
  }

  if (messageType !== "notification") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });
  }

  const type = payload.subscription?.type;
  const broadcasterId = payload.event?.broadcaster_user_id;
  if (!type || !broadcasterId) {
    return NextResponse.json({ ok: true });
  }

  const nowIso = new Date().toISOString();
  if (type === "stream.online") {
    await supabase
      .from("streamers")
      .update({
        is_live: true,
        last_seen_online: nowIso,
        last_checked_at: nowIso,
      })
      .eq("twitch_id", broadcasterId);
  } else if (type === "stream.offline") {
    await supabase
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
  }

  return NextResponse.json({ ok: true });
}

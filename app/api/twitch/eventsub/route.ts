import crypto from "node:crypto";

import { NextResponse } from "next/server";

import {
  processTwitchChannelUpdate,
  processTwitchStreamOffline,
  processTwitchStreamOnline,
} from "@/lib/streamers/twitch-sync";

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
  const debug = process.env.STREAMERS_DEBUG?.trim() === "true";
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

  const messageTimestamp = new Date(timestamp).getTime();
  if (!Number.isFinite(messageTimestamp) || Math.abs(Date.now() - messageTimestamp) > 10 * 60 * 1000) {
    return NextResponse.json({ error: "Stale EventSub message" }, { status: 400 });
  }

  const payload = JSON.parse(body) as {
    challenge?: string;
    subscription?: { type?: string };
    event?: { broadcaster_user_id?: string };
  };

  if (messageType === "webhook_callback_verification" && payload.challenge) {
    if (debug) {
      console.log("[streamers/eventsub] verification", { messageId });
    }
    return new NextResponse(payload.challenge, { status: 200 });
  }

  if (messageType !== "notification") {
    return NextResponse.json({ ok: true });
  }

  const type = payload.subscription?.type;
  const broadcasterId = payload.event?.broadcaster_user_id;
  if (!type || !broadcasterId) {
    return NextResponse.json({ ok: true });
  }
  if (debug) {
    console.log("[streamers/eventsub] notification", { type, broadcasterId, messageId });
  }

  let handled = true;
  let result: unknown = null;
  if (type === "stream.online") {
    result = await processTwitchStreamOnline(broadcasterId);
  } else if (type === "stream.offline") {
    result = await processTwitchStreamOffline(broadcasterId);
  } else if (type === "channel.update") {
    result = await processTwitchChannelUpdate(broadcasterId);
  } else {
    handled = false;
  }
  if (debug) {
    console.log("[streamers/eventsub] handled", { type, broadcasterId, handled, result });
  }

  return NextResponse.json({ ok: true, handled, type, result });
}

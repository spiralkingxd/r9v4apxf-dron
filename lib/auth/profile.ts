import type { User } from "@supabase/supabase-js";

import { fetchXboxGamertag } from "@/lib/auth/discord";
import { getOwnerDiscordId } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function getDiscordId(user: User) {
  const providerId = user.user_metadata?.provider_id;
  const sub = user.user_metadata?.sub;

  if (typeof providerId === "string" && providerId.length > 0) {
    return providerId;
  }

  if (typeof sub === "string" && sub.length > 0) {
    return sub;
  }

  return null;
}

export async function upsertProfileFromOAuth() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return;
  }

  const user = session.user;
  const metadata = user.user_metadata ?? {};
  const discordId = getDiscordId(user);
  const displayName =
    metadata.full_name ?? metadata.name ?? metadata.global_name ?? user.email?.split("@")[0] ?? "Pirata";
  const username = metadata.user_name ?? metadata.preferred_username ?? metadata.name ?? displayName;
  const avatarUrl = metadata.avatar_url ?? null;
  const xboxGamertag =
    typeof session.provider_token === "string" && session.provider_token.length > 0
      ? await fetchXboxGamertag(session.provider_token)
      : null;
  const ownerDiscordId = getOwnerDiscordId();
  const isOwner = Boolean(discordId && ownerDiscordId && discordId === ownerDiscordId);

  const profilePayload: {
    id: string;
    discord_id: string | null;
    display_name: string;
    username: string;
    email: string | null;
    avatar_url: string | null;
    xbox_gamertag: string | null;
    role?: "admin";
  } = {
    id: user.id,
    discord_id: discordId,
    display_name: displayName,
    username,
    email: user.email ?? null,
    avatar_url: avatarUrl,
    xbox_gamertag: xboxGamertag,
  };

  if (isOwner) {
    profilePayload.role = "admin";
  }

  await supabase.from("profiles").upsert(
    profilePayload,
    { onConflict: "id" },
  );
}
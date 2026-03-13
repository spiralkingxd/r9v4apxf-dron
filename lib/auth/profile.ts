import { fetchXboxGamertag } from "@/lib/auth/discord";
import { resolveDiscordIdFromAuthUser } from "@/lib/auth/discord-id";
import { getOwnerDiscordId } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type UpsertProfileOptions = {
  providerAccessToken?: string | null;
};

function resolveUsername(metadata: Record<string, unknown>, displayName: string) {
  const base =
    (typeof metadata.user_name === "string" && metadata.user_name) ||
    (typeof metadata.preferred_username === "string" && metadata.preferred_username) ||
    (typeof metadata.name === "string" && metadata.name) ||
    displayName;
  const discriminator =
    typeof metadata.discriminator === "string" ? metadata.discriminator : null;

  if (discriminator && discriminator !== "0" && !base.includes("#")) {
    return `${base}#${discriminator}`;
  }

  return base;
}

export async function upsertProfileFromOAuth(options?: UpsertProfileOptions) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return;
  }

  const user = session.user;
  const metadata = user.user_metadata ?? {};
  const discordId = resolveDiscordIdFromAuthUser(user) ?? user.id;
  const displayName =
    metadata.full_name ?? metadata.name ?? metadata.global_name ?? user.email?.split("@")[0] ?? "Pirata";
  const username = resolveUsername(metadata, displayName);
  const avatarUrl = metadata.avatar_url ?? null;

  const tokenFromOption =
    typeof options?.providerAccessToken === "string" && options.providerAccessToken.length > 0
      ? options.providerAccessToken
      : null;
  const tokenFromSession =
    typeof session.provider_token === "string" && session.provider_token.length > 0
      ? session.provider_token
      : null;
  const providerAccessToken = tokenFromOption ?? tokenFromSession;

  let xboxUpdate: { xbox_gamertag: string | null } | {} = {};
  if (providerAccessToken) {
    const { xboxGamertag, synced } = await fetchXboxGamertag(providerAccessToken);
    if (synced) {
      xboxUpdate = { xbox_gamertag: xboxGamertag };
    }
  }

  const ownerDiscordId = getOwnerDiscordId();
  const isOwner = Boolean(discordId && ownerDiscordId && discordId === ownerDiscordId);

  const profilePayload: {
    id: string;
    discord_id: string;
    display_name: string;
    username: string;
    email: string | null;
    avatar_url: string | null;
    xbox_gamertag?: string | null;
    updated_at: string;
    role?: "admin" | "owner";
  } = {
    id: user.id,
    discord_id: discordId,
    display_name: displayName,
    username,
    email: user.email ?? null,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
    ...xboxUpdate,
  };

  if (isOwner) {
    profilePayload.role = "owner";
  }

  await supabase.from("profiles").upsert(
    profilePayload,
    { onConflict: "id" },
  );
}
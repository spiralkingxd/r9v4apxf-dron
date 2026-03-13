const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ownerDiscordIdRaw = process.env.OWNER_DISCORD_ID;
const adminDiscordIdsRaw = process.env.ADMIN_DISCORD_IDS;
const DISCORD_SNOWFLAKE_REGEX = /^[0-9]{15,22}$/;

let ownerEnvWarningPrinted = false;
let adminEnvWarningPrinted = false;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function isDiscordSnowflake(value: string) {
  return DISCORD_SNOWFLAKE_REGEX.test(value.trim());
}

export function getOwnerDiscordId() {
  const normalized = ownerDiscordIdRaw?.trim();

  if (!normalized) {
    if (process.env.NODE_ENV !== "production" && !ownerEnvWarningPrinted) {
      console.warn("[owner-env] OWNER_DISCORD_ID nao configurado. Promocao automatica de owner esta desativada.");
      ownerEnvWarningPrinted = true;
    }
    return null;
  }

  if (!isDiscordSnowflake(normalized)) {
    if (process.env.NODE_ENV !== "production" && !ownerEnvWarningPrinted) {
      console.warn("[owner-env] OWNER_DISCORD_ID invalido. Use apenas numeros (15 a 22 digitos).");
      ownerEnvWarningPrinted = true;
    }
    return null;
  }

  return normalized;
}

export function getAdminDiscordIds() {
  const raw = adminDiscordIdsRaw?.trim();
  if (!raw) return [];

  const parsed = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const valid = parsed.filter(isDiscordSnowflake);
  const invalid = parsed.filter((id) => !isDiscordSnowflake(id));

  if (invalid.length > 0 && process.env.NODE_ENV !== "production" && !adminEnvWarningPrinted) {
    console.warn("[owner-env] ADMIN_DISCORD_IDS contem IDs invalidos. Use somente numeros (15 a 22 digitos).", {
      invalid,
    });
    adminEnvWarningPrinted = true;
  }

  return valid;
}

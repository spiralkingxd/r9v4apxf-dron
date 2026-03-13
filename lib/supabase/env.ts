import "server-only";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ownerDiscordIdRaw = process.env.OWNER_DISCORD_ID;
const DISCORD_SNOWFLAKE_REGEX = /^[0-9]{15,22}$/;

let ownerEnvWarningPrinted = false;

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

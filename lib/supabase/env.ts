const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ownerDiscordIdRaw = process.env.OWNER_DISCORD_ID;
const ownerDiscordId2Raw = process.env.OWNER_DISCORD_ID2;
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

export function getOwnerDiscordIds(): string[] {
  const normalized = ownerDiscordIdRaw?.trim();
  const normalized2 = ownerDiscordId2Raw?.trim();
  let owners: string[] = [];

  if (normalized) {
    if (normalized.includes(',')) {
       owners = [...owners, ...normalized.split(',').map(id => id.trim())];     
    } else {
       owners.push(normalized);
    }
  }

  if (normalized2) {
    if (normalized2.includes(',')) {
       owners = [...owners, ...normalized2.split(',').map(id => id.trim())];    
    } else {
       owners.push(normalized2);
    }
  }

  const uniqueOwners = Array.from(new Set(owners));
  const validOwners = uniqueOwners.filter(isDiscordSnowflake);
  if (validOwners.length === 0) {
    if (process.env.NODE_ENV !== "production" && !ownerEnvWarningPrinted) {
      console.warn("[owner-env] OWNER_DISCORD_ID nao configurado corretamente. Promocao automatica de owner esta desativada.");
      ownerEnvWarningPrinted = true;
    }
  }

  return validOwners;
}

export function getOwnerDiscordId() {
  const owners = getOwnerDiscordIds();
  return owners.length > 0 ? owners[0] : null;
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

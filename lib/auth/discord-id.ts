type MaybeRecord = Record<string, unknown>;

function toSnowflake(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (/^[0-9]{15,22}$/.test(raw)) return raw;

  const afterPipe = raw.includes("|") ? raw.split("|").at(-1)?.trim() ?? "" : "";
  if (/^[0-9]{15,22}$/.test(afterPipe)) return afterPipe;

  return null;
}

function asRecord(value: unknown): MaybeRecord {
  return value && typeof value === "object" ? (value as MaybeRecord) : {};
}

export function resolveDiscordIdFromAuthUser(user: unknown): string | null {
  const userRecord = asRecord(user);
  const metadata = asRecord(userRecord.user_metadata);

  const fromMetadata =
    toSnowflake(metadata.provider_id) ||
    toSnowflake(metadata.provider_user_id) ||
    toSnowflake(metadata.sub);

  if (fromMetadata) return fromMetadata;

  const identities = Array.isArray(userRecord.identities) ? userRecord.identities : [];
  for (const identity of identities) {
    const identityRecord = asRecord(identity);
    const provider = String(identityRecord.provider ?? "").toLowerCase();
    const identityData = asRecord(identityRecord.identity_data);

    if (provider === "discord") {
      const fromIdentity =
        toSnowflake(identityData.provider_id) ||
        toSnowflake(identityData.sub) ||
        toSnowflake(identityRecord.id);
      if (fromIdentity) return fromIdentity;
    }
  }

  return null;
}

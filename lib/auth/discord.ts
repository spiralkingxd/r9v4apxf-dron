type DiscordConnection = {
  id?: string;
  type?: string;
  name?: string;
  verified?: boolean;
};

export async function fetchXboxGamertag(discordAccessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/connections", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${discordAccessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const connections = (await response.json()) as DiscordConnection[];
  const xbox = connections.find((connection) => connection.type === "xbox");

  if (!xbox) {
    return null;
  }

  return xbox.name ?? xbox.id ?? null;
}
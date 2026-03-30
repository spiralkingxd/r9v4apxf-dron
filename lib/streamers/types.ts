export type StreamerTag = {
  name: string;
  slug: string;
  is_highlight: boolean;
};

export type CommunityStreamer = {
  id: string;
  display_name: string;
  username: string;
  platform: "twitch" | "youtube";
  channel_url: string;
  avatar_url: string | null;
  bio: string | null;
  is_live: boolean;
  live_title: string | null;
  live_game: string | null;
  viewers: number;
  is_featured: boolean;
  last_seen_online: string | null;
  tags: StreamerTag[];
};

export type StreamersQuery = {
  q?: string;
  status?: "all" | "live" | "offline";
  tag?: string;
};

import { Users } from "lucide-react";

import { MembersTable } from "@/components/admin/members-table";
import { createClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  avatar_url: string | null;
  display_name: string;
  username: string;
  discord_id: string | null;
  xbox_gamertag: string | null;
  email: string | null;
  role: "user" | "admin" | "owner";
  is_banned: boolean;
  created_at: string;
  team_count: number;
};

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: adminProfile } = user
    ? await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle<{ id: string; role: "user" | "admin" | "owner" }>()
    : { data: null as { id: string; role: "user" | "admin" | "owner" } | null };

  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, avatar_url, display_name, username, discord_id, xbox_gamertag, email, role, is_banned, created_at")
    .order("created_at", { ascending: false })
    .limit(1200);

  const profiles = (profilesRaw ?? []) as Omit<MemberRow, "team_count">[];
  const ids = profiles.map((p) => p.id);

  const { data: membershipsRaw } = ids.length
    ? await supabase.from("team_members").select("user_id").in("user_id", ids)
    : { data: [] as never[] };

  const teamCountMap = new Map<string, number>();
  for (const row of membershipsRaw ?? []) {
    const uid = row.user_id as string;
    teamCountMap.set(uid, (teamCountMap.get(uid) ?? 0) + 1);
  }

  const rows: MemberRow[] = profiles.map((profile) => ({
    ...profile,
    avatar_url: profile.avatar_url ?? null,
    discord_id: profile.discord_id ?? null,
    xbox_gamertag: profile.xbox_gamertag ?? null,
    email: profile.email ?? null,
    role: profile.role,
    is_banned: profile.is_banned,
    created_at: profile.created_at,
    team_count: teamCountMap.get(profile.id) ?? 0,
  }));

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Users className="h-6 w-6 text-cyan-300" />
          Gerenciamento de Membros
        </h1>
        <p className="mt-2 text-sm text-slate-400">Administre roles, status e participação em equipes.</p>
      </header>

      <MembersTable
        rows={rows}
        currentAdminId={adminProfile?.id ?? user?.id ?? ""}
        currentAdminRole={adminProfile?.role === "owner" ? "owner" : "admin"}
      />
    </section>
  );
}

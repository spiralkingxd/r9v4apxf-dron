import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function MyTeamRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/my-team");
  }

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, role, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1);

  const membership = (memberships?.[0] as { team_id: string; role: "captain" | "member"; joined_at: string } | undefined) ?? null;

  if (membership?.team_id) {
    redirect(`/teams/${membership.team_id}`);
  }

  redirect("/teams");
}

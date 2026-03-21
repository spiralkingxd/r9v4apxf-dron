import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminMatchLegacyPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("event_id")
    .eq("id", id)
    .maybeSingle<{ event_id: string }>();
  if (data?.event_id) {
    redirect(`/admin/tournaments/${data.event_id}/matches/${id}`);
  }
  redirect("/admin/tournaments");
}


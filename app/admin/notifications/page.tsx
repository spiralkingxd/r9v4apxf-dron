import { Bell } from "lucide-react";

import { NotificationsCenter } from "@/components/admin/notifications-center";
import { createClient } from "@/lib/supabase/server";
import { getNotificationsAdminData } from "@/app/admin/notifications/_data";

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: "user" | "admin" | "owner" }>()
    : { data: null };

  const { templates, history, settings, users } = await getNotificationsAdminData();

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Bell className="h-6 w-6 text-cyan-300" />
          <h1 className="text-2xl font-bold text-white">Notificacoes e Discord</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Configure webhooks, templates e acompanhe o historico de entregas com suporte a reenvio de falhas.
        </p>
      </header>

      <NotificationsCenter
        templates={templates}
        history={history}
        settings={settings}
        users={users}
        isOwner={profile?.role === "owner"}
      />
    </section>
  );
}

import { Settings } from "lucide-react";

import { SettingsAdminPanel } from "@/components/admin/settings-admin-panel";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("system_settings")
    .select("platform_name, tournament, discord, email")
    .eq("id", 1)
    .maybeSingle();

  const settings = {
    platform_name: String(data?.platform_name ?? "MadnessArena"),
    tournament: (data?.tournament as Record<string, unknown>) ?? {},
    discord: (data?.discord as Record<string, unknown>) ?? {},
    email: (data?.email as Record<string, unknown>) ?? {},
  };

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border admin-surface p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <Settings className="h-6 w-6 text-[color:var(--accent-cyan)]" />
          <h1 className="text-2xl font-bold text-[color:var(--text-strong)]">Configurações do Sistema</h1>
        </div>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Centralize parâmetros globais da plataforma, eventos, ranking e integrações operacionais.
        </p>
      </header>

      <SettingsAdminPanel settings={settings} />
    </section>
  );
}

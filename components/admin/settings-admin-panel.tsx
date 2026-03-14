"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";

import { updateSystemSettings } from "@/app/admin/final-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { useAdminToast } from "@/components/admin/admin-toast";

type Props = {
  settings: {
    platform_name: string;
    tournament: Record<string, unknown>;
    discord: Record<string, unknown>;
    email: Record<string, unknown>;
  };
};

export function SettingsAdminPanel({ settings }: Props) {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  const initialState = useMemo(() => {
    const tournament = settings.tournament ?? {};
    const discord = settings.discord ?? {};
    const email = settings.email ?? {};

    return {
      platform_name: String(settings.platform_name ?? "MadnessArena"),
      support_email: String(email.support_email ?? ""),
      default_event_visibility: String(tournament.default_event_visibility ?? "public"),
      default_event_type: String(tournament.default_event_type ?? "special"),
      max_team_size: Number(tournament.max_team_size ?? 5),
      allow_registration: Boolean(tournament.allow_registration ?? true),
      discord_notifications_enabled: Boolean(discord.notifications_enabled ?? true),
      ranking_k_factor: Number(tournament.ranking_k_factor ?? 32),
      maintenance_mode: Boolean(tournament.maintenance_mode ?? false),
    };
  }, [settings]);

  const [form, setForm] = useState(initialState);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSystemSettings({
        platform_name: form.platform_name,
        tournament: {
          default_event_visibility: form.default_event_visibility,
          default_event_type: form.default_event_type,
          max_team_size: form.max_team_size,
          allow_registration: form.allow_registration,
          ranking_k_factor: form.ranking_k_factor,
          maintenance_mode: form.maintenance_mode,
        },
        discord: {
          notifications_enabled: form.discord_notifications_enabled,
        },
        email: {
          support_email: form.support_email,
        },
      });
      if (res.error) {
        pushToast("error", res.error);
        return;
      }

      pushToast("success", res.success ?? "Configurações atualizadas.");
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="admin-surface space-y-6 rounded-2xl p-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Geral</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
              <span>Nome da plataforma</span>
              <input
                value={form.platform_name}
                onChange={(e) => setField("platform_name", e.target.value)}
                className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
              />
            </label>
            <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
              <span>Email de suporte</span>
              <input
                type="email"
                value={form.support_email}
                onChange={(e) => setField("support_email", e.target.value)}
                className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-strong)]">Eventos e Ranking</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
              <span>Visibilidade padrão</span>
              <select
                value={form.default_event_visibility}
                onChange={(e) => setField("default_event_visibility", e.target.value)}
                className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
              >
                <option value="public">Público</option>
                <option value="private">Privado</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
              <span>Tipo de evento padrão</span>
              <select
                value={form.default_event_type}
                onChange={(e) => setField("default_event_type", e.target.value)}
                className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
              >
                <option value="special">Especial</option>
                <option value="ranked">Rankeado</option>
                <option value="tournament">Torneio</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
              <span>Tamanho máximo do time</span>
              <input
                type="number"
                min={2}
                max={15}
                value={form.max_team_size}
                onChange={(e) => setField("max_team_size", Number(e.target.value) || 2)}
                className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
              />
            </label>
            <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
              <span>K-Factor global</span>
              <input
                type="number"
                min={1}
                max={128}
                value={form.ranking_k_factor}
                onChange={(e) => setField("ranking_k_factor", Number(e.target.value) || 32)}
                className="w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-strong)]">Operação</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)]">
              <span>Registro habilitado</span>
              <input
                type="checkbox"
                checked={form.allow_registration}
                onChange={(e) => setField("allow_registration", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)]">
              <span>Notificações Discord</span>
              <input
                type="checkbox"
                checked={form.discord_notifications_enabled}
                onChange={(e) => setField("discord_notifications_enabled", e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)]">
              <span>Modo manutenção</span>
              <input
                type="checkbox"
                checked={form.maintenance_mode}
                onChange={(e) => setField("maintenance_mode", e.target.checked)}
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <AdminButton type="submit" disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Salvando..." : "Salvar configurações"}
          </AdminButton>
        </div>
      </form>
    </>
  );
}

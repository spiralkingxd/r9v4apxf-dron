import { createClient } from "@/lib/supabase/server";

export type NotificationTemplateItem = {
  type: string;
  label: string;
  template: string;
  enabled: boolean;
  updated_at: string;
};

export type NotificationHistoryItem = {
  id: string;
  type: string;
  webhook_kind: "announcements" | "admin_logs";
  status: "scheduled" | "sent" | "failed" | "cancelled";
  rendered_message: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  attempts: number;
  response_code: number | null;
  error_message: string | null;
  created_at: string;
};

export type DiscordSettingsData = {
  announcements_webhook_url: string;
  admin_logs_webhook_url: string;
  announcement_channel: string;
  participant_role: string;
  verification_enabled: boolean;
  event_map: Record<string, boolean>;
};

export type AdminNotificationUserOption = {
  id: string;
  display_name: string;
  username: string;
};

export async function getNotificationsAdminData() {
  const supabase = await createClient();

  const [{ data: templatesRaw }, { data: historyRaw }, { data: settingsRaw }, { data: usersRaw }] = await Promise.all([
    supabase
      .from("notification_templates")
      .select("type, label, template, enabled, updated_at")
      .order("type", { ascending: true }),
    supabase
      .from("notifications_outbox")
      .select("id, type, webhook_kind, status, rendered_message, scheduled_at, sent_at, failed_at, attempts, response_code, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("system_settings")
      .select("discord")
      .eq("id", 1)
      .maybeSingle<{ discord: Record<string, unknown> | null }>(),
    supabase
      .from("profiles")
      .select("id, display_name, username")
      .is("deleted_at", null)
      .order("display_name", { ascending: true })
      .limit(3000),
  ]);

  const discordRaw = (settingsRaw?.discord ?? {}) as Record<string, unknown>;

  const settings: DiscordSettingsData = {
    announcements_webhook_url: String(discordRaw.announcements_webhook_url ?? ""),
    admin_logs_webhook_url: String(discordRaw.admin_logs_webhook_url ?? ""),
    announcement_channel: String(discordRaw.announcement_channel ?? ""),
    participant_role: String(discordRaw.participant_role ?? ""),
    verification_enabled: Boolean(discordRaw.verification_enabled ?? false),
    event_map: (discordRaw.event_map as Record<string, boolean> | undefined) ?? {},
  };

  return {
    templates: (templatesRaw ?? []) as NotificationTemplateItem[],
    history: (historyRaw ?? []) as NotificationHistoryItem[],
    settings,
    users: (usersRaw ?? []).map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name ?? row.username ?? "Usuário"),
      username: String(row.username ?? "usuario"),
    })) as AdminNotificationUserOption[],
  };
}

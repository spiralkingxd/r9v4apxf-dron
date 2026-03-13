type WebhookKind = "announcements" | "admin_logs";

export const DISCORD_NOTIFICATION_TYPES = [
  "tournament_published",
  "event_finalized",
  "registration_approved",
  "registration_rejected",
  "match_scheduled",
  "match_result_published",
  "ranking_updated",
  "user_banned",
  "team_dissolved",
  "admin_log",
] as const;

export type DiscordNotificationType = (typeof DISCORD_NOTIFICATION_TYPES)[number];

type NotificationTemplateRow = {
  type: DiscordNotificationType;
  template: string;
  enabled: boolean;
};

type OutboxRow = {
  id: string;
  type: DiscordNotificationType;
  webhook_kind: WebhookKind;
  payload: Record<string, unknown>;
  rendered_message: string | null;
  status: "scheduled" | "sent" | "failed" | "cancelled";
  scheduled_at: string | null;
  attempts: number;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
    insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => any;
    update: (payload: Record<string, unknown>) => any;
  };
};

const DEFAULT_TEMPLATES: Record<DiscordNotificationType, string> = {
  tournament_published: "Novo torneio publicado: {{title}}. Inicio: {{startDate}}.",
  event_finalized: "Evento finalizado: {{title}}.",
  registration_approved: "Inscricao aprovada para {{teamName}} em {{eventTitle}}.",
  registration_rejected: "Inscricao rejeitada para {{teamName}} em {{eventTitle}}. Motivo: {{reason}}.",
  match_scheduled: "Partida agendada em {{eventTitle}}: {{teamA}} vs {{teamB}} em {{scheduledAt}}.",
  match_result_published: "Resultado em {{eventTitle}}: {{teamA}} {{scoreA}}x{{scoreB}} {{teamB}}. Vencedor: {{winner}}.",
  ranking_updated: "Ranking atualizado por {{source}}.",
  user_banned: "Usuario banido: {{userId}}. Motivo: {{reason}}.",
  team_dissolved: "Equipe dissolvida: {{teamName}}.",
  admin_log: "[ADMIN] {{message}}",
};

const WEBHOOK_KIND_BY_TYPE: Record<DiscordNotificationType, WebhookKind> = {
  tournament_published: "announcements",
  event_finalized: "announcements",
  registration_approved: "announcements",
  registration_rejected: "announcements",
  match_scheduled: "announcements",
  match_result_published: "announcements",
  ranking_updated: "announcements",
  user_banned: "admin_logs",
  team_dissolved: "admin_logs",
  admin_log: "admin_logs",
};

function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = payload[key];
    if (value === undefined || value === null) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

async function loadDiscordSettings(supabase: SupabaseLike) {
  const response = await supabase
    .from("system_settings")
    .select("discord")
    .eq("id", 1)
    .maybeSingle();

  const data = response?.data as { discord: Record<string, unknown> | null } | null;

  return (data?.discord ?? {}) as Record<string, unknown>;
}

async function loadTemplate(supabase: SupabaseLike, type: DiscordNotificationType) {
  const response = await supabase
    .from("notification_templates")
    .select("type, template, enabled")
    .eq("type", type)
    .maybeSingle();

  const data = response?.data as NotificationTemplateRow | null;

  if (!data) {
    return { template: DEFAULT_TEMPLATES[type], enabled: true };
  }

  return { template: data.template, enabled: data.enabled };
}

function asIsoOrNull(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

async function sendWebhook(url: string, message: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
    cache: "no-store",
  });

  return { ok: response.ok, status: response.status, text: response.statusText };
}

export async function queueOrSendDiscordNotification(input: {
  supabase: SupabaseLike;
  createdBy?: string | null;
  type: DiscordNotificationType;
  data: Record<string, unknown>;
  scheduledAt?: string | null;
  force?: boolean;
  webhookKindOverride?: WebhookKind;
}) {
  const template = await loadTemplate(input.supabase, input.type);
  if (!template.enabled) {
    return { ok: true as const, status: "cancelled" as const };
  }

  const settings = await loadDiscordSettings(input.supabase);
  const map = (settings.event_map ?? {}) as Record<string, boolean>;
  if (!input.force && map[input.type] === false) {
    return { ok: true as const, status: "cancelled" as const };
  }

  const webhookKind = input.webhookKindOverride ?? WEBHOOK_KIND_BY_TYPE[input.type];
  const rendered = renderTemplate(template.template, input.data);
  const scheduledIso = asIsoOrNull(input.scheduledAt);

  const shouldSchedule = scheduledIso && new Date(scheduledIso).getTime() > Date.now();

  const insertResponse = await input.supabase
    .from("notifications_outbox")
    .insert({
      type: input.type,
      webhook_kind: webhookKind,
      payload: input.data,
      rendered_message: rendered,
      status: shouldSchedule ? "scheduled" : "scheduled",
      scheduled_at: shouldSchedule ? scheduledIso : nowIso(),
      created_by: input.createdBy ?? null,
      attempts: 0,
    })
    .select("id")
    .single();

  const inserted = insertResponse?.data as { id: string } | null;

  const outboxId = inserted?.id;
  if (shouldSchedule) {
    return { ok: true as const, status: "scheduled" as const, id: outboxId ?? null };
  }

  if (!outboxId) {
    return { ok: false as const, status: "failed" as const, error: "Nao foi possivel criar registro de envio." };
  }

  return await deliverOutboxNotification(input.supabase, outboxId);
}

export async function deliverOutboxNotification(supabase: SupabaseLike, outboxId: string) {
  const response = await supabase
    .from("notifications_outbox")
    .select("id, type, webhook_kind, payload, rendered_message, status, scheduled_at, attempts")
    .eq("id", outboxId)
    .maybeSingle();

  const row = response?.data as OutboxRow | null;

  if (!row) return { ok: false as const, status: "failed" as const, error: "Notificacao nao encontrada." };
  if (row.status === "sent") return { ok: true as const, status: "sent" as const };

  const settings = await loadDiscordSettings(supabase);
  const webhookUrl = row.webhook_kind === "admin_logs"
    ? String(settings.admin_logs_webhook_url ?? "").trim()
    : String(settings.announcements_webhook_url ?? "").trim();

  if (!webhookUrl) {
    await supabase
      .from("notifications_outbox")
      .update({
        status: "failed",
        failed_at: nowIso(),
        attempts: (row.attempts ?? 0) + 1,
        error_message: "Webhook nao configurado.",
      })
      .eq("id", row.id);

    return { ok: false as const, status: "failed" as const, error: "Webhook nao configurado." };
  }

  const template = await loadTemplate(supabase, row.type);
  const rendered = row.rendered_message ?? renderTemplate(template.template, row.payload ?? {});

  try {
    const response = await sendWebhook(webhookUrl, rendered);
    if (!response.ok) {
      await supabase
        .from("notifications_outbox")
        .update({
          status: "failed",
          failed_at: nowIso(),
          attempts: (row.attempts ?? 0) + 1,
          response_code: response.status,
          error_message: `Erro Discord ${response.status}: ${response.text}`,
        })
        .eq("id", row.id);

      return { ok: false as const, status: "failed" as const, error: `Discord retornou ${response.status}.` };
    }

    await supabase
      .from("notifications_outbox")
      .update({
        status: "sent",
        sent_at: nowIso(),
        attempts: (row.attempts ?? 0) + 1,
        response_code: response.status,
        error_message: null,
      })
      .eq("id", row.id);

    return { ok: true as const, status: "sent" as const };
  } catch (error) {
    await supabase
      .from("notifications_outbox")
      .update({
        status: "failed",
        failed_at: nowIso(),
        attempts: (row.attempts ?? 0) + 1,
        error_message: error instanceof Error ? error.message : "Falha inesperada",
      })
      .eq("id", row.id);

    return { ok: false as const, status: "failed" as const, error: error instanceof Error ? error.message : "Falha ao enviar." };
  }
}

export async function processScheduledDiscordNotifications(supabase: SupabaseLike, limit = 20) {
  const { data: rows } = await supabase
    .from("notifications_outbox")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const result = await deliverOutboxNotification(supabase, String(row.id));
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { sent, failed, total: (rows ?? []).length };
}

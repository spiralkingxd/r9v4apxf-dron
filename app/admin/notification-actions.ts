"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, assertOwnerAccess, enforceAdminRateLimit, logAdminAction } from "@/app/admin/_lib";
import {
  DISCORD_NOTIFICATION_TYPES,
  type DiscordNotificationType,
  deliverOutboxNotification,
  processScheduledDiscordNotifications,
  queueOrSendDiscordNotification,
} from "@/lib/discord-notifications";
import { insertNotifications } from "@/lib/notifications";

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

const notificationTypeSchema = z.enum(DISCORD_NOTIFICATION_TYPES);

const sendSchema = z.object({
  type: notificationTypeSchema,
  data: z.record(z.string(), z.unknown()),
});

const scheduleSchema = z.object({
  type: notificationTypeSchema,
  data: z.record(z.string(), z.unknown()),
  scheduledAt: z.string().min(1),
});

const templateSchema = z.object({
  type: notificationTypeSchema,
  template: z.string().trim().min(3).max(2000),
});

const webhookSettingsSchema = z.object({
  announcements_webhook_url: z.union([z.literal(""), z.url()]),
  admin_logs_webhook_url: z.union([z.literal(""), z.url()]),
  announcement_channel: z.string().trim().max(120).optional(),
  participant_role: z.string().trim().max(120).optional(),
  verification_enabled: z.boolean().optional(),
  event_map: z.record(z.string(), z.boolean()).optional(),
});

const testSchema = z.object({
  webhookKind: z.enum(["announcements", "admin_logs"]).default("announcements"),
});

const inAppNotificationSchema = z.object({
  title: z.string().trim().min(3).max(150),
  message: z.string().trim().min(3).max(2000),
  severity: z.enum(["info", "warning", "danger"]),
  audience: z.enum(["single", "all"]),
  userId: z.string().uuid().optional(),
});

function revalidateNotificationPaths() {
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/dashboard");
}

export async function sendDiscordNotification(
  type: DiscordNotificationType,
  data: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = sendSchema.safeParse({ type, data });
  if (!parsed.success) return { error: "Dados invalidos para notificacao." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, `send_discord_${parsed.data.type}`);

    const result = await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: parsed.data.type,
      data: parsed.data.data,
      force: true,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "send_discord_notification",
      targetType: "notification",
      targetId: parsed.data.type,
      details: { type: parsed.data.type, deliveryStatus: result.status },
      severity: result.ok ? "info" : "warning",
      suspicious: !result.ok,
    });

    revalidateNotificationPaths();
    if (!result.ok) return { error: result.error ?? "Falha ao enviar notificacao." };

    return { success: result.status === "scheduled" ? "Notificacao agendada." : "Notificacao enviada ao Discord." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao enviar notificacao." };
  }
}

export async function testDiscordWebhook(
  webhookKind: "announcements" | "admin_logs" = "announcements",
): Promise<ActionResult> {
  const parsed = testSchema.safeParse({ webhookKind });
  if (!parsed.success) return { error: "Webhook invalido." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, `test_discord_webhook_${parsed.data.webhookKind}`);

    const result = await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: "admin_log",
      data: {
        message:
          parsed.data.webhookKind === "admin_logs"
            ? "Teste de conexao do webhook de logs administrativos"
            : "Teste de conexao do webhook de anuncios",
        requestedAt: new Date().toISOString(),
      },
      force: true,
      webhookKindOverride: parsed.data.webhookKind,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "test_discord_webhook",
      targetType: "notification",
      targetId: parsed.data.webhookKind,
      details: { webhookKind: parsed.data.webhookKind, status: result.status },
      severity: result.ok ? "info" : "warning",
      suspicious: !result.ok,
    });

    revalidateNotificationPaths();
    return result.ok ? { success: "Teste enviado com sucesso." } : { error: result.error ?? "Falha no teste." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao testar webhook." };
  }
}

export async function updateNotificationTemplate(
  type: DiscordNotificationType,
  template: string,
): Promise<ActionResult> {
  const parsed = templateSchema.safeParse({ type, template });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Template invalido." };

  try {
    const { supabase, adminId } = await assertOwnerAccess();
    await enforceAdminRateLimit(supabase, adminId, `update_notification_template_${parsed.data.type}`);

    const { data: previous } = await supabase
      .from("notification_templates")
      .select("template")
      .eq("type", parsed.data.type)
      .maybeSingle<{ template: string }>();

    const { error } = await supabase
      .from("notification_templates")
      .upsert({
        type: parsed.data.type,
        label: parsed.data.type,
        template: parsed.data.template,
        enabled: true,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "type" });

    if (error) return { error: "Nao foi possivel salvar template." };

    await logAdminAction(supabase, {
      adminId,
      action: "update_notification_template",
      targetType: "notification_template",
      targetId: parsed.data.type,
      previousState: { template: previous?.template ?? null },
      nextState: { template: parsed.data.template },
      details: { type: parsed.data.type },
      severity: "warning",
    });

    revalidateNotificationPaths();
    return { success: "Template atualizado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao atualizar template." };
  }
}

export async function scheduleNotification(
  type: DiscordNotificationType,
  data: Record<string, unknown>,
  scheduledAt: string,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse({ type, data, scheduledAt });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, `schedule_notification_${parsed.data.type}`);

    const result = await queueOrSendDiscordNotification({
      supabase,
      createdBy: adminId,
      type: parsed.data.type,
      data: parsed.data.data,
      scheduledAt: parsed.data.scheduledAt,
    });

    await logAdminAction(supabase, {
      adminId,
      action: "schedule_discord_notification",
      targetType: "notification",
      targetId: parsed.data.type,
      details: { type: parsed.data.type, scheduledAt: parsed.data.scheduledAt, status: result.status },
    });

    revalidateNotificationPaths();
    return { success: "Notificacao agendada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao agendar notificacao." };
  }
}

export async function resendFailedNotification(notificationId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(notificationId);
  if (!parsed.success) return { error: "Notificacao invalida." };

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "resend_failed_notification");

    const result = await deliverOutboxNotification(supabase, parsed.data);

    await logAdminAction(supabase, {
      adminId,
      action: "resend_failed_notification",
      targetType: "notification",
      targetId: parsed.data,
      details: { status: result.status },
      severity: result.ok ? "info" : "warning",
      suspicious: !result.ok,
    });

    revalidateNotificationPaths();
    return result.ok ? { success: "Notificacao reenviada." } : { error: result.error ?? "Falha ao reenviar notificacao." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao reenviar notificacao." };
  }
}

export async function updateDiscordWebhookSettings(input: {
  announcements_webhook_url: string;
  admin_logs_webhook_url: string;
  announcement_channel?: string;
  participant_role?: string;
  verification_enabled?: boolean;
  event_map?: Record<string, boolean>;
}): Promise<ActionResult> {
  const parsed = webhookSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };

  try {
    const { supabase, adminId } = await assertOwnerAccess();
    await enforceAdminRateLimit(supabase, adminId, "update_discord_webhook_settings");

    const { data: settings } = await supabase
      .from("system_settings")
      .select("discord")
      .eq("id", 1)
      .maybeSingle<{ discord: Record<string, unknown> | null }>();

    const previousDiscord = (settings?.discord ?? {}) as Record<string, unknown>;
    const nextDiscord = {
      ...previousDiscord,
      announcements_webhook_url: parsed.data.announcements_webhook_url || null,
      admin_logs_webhook_url: parsed.data.admin_logs_webhook_url || null,
      announcement_channel: parsed.data.announcement_channel ?? null,
      participant_role: parsed.data.participant_role ?? null,
      verification_enabled: parsed.data.verification_enabled ?? false,
      event_map: parsed.data.event_map ?? previousDiscord.event_map ?? {},
    };

    const { error } = await supabase
      .from("system_settings")
      .update({
        discord: nextDiscord,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) return { error: "Nao foi possivel salvar as configuracoes do Discord." };

    await logAdminAction(supabase, {
      adminId,
      action: "update_discord_settings",
      targetType: "system_settings",
      targetId: "discord",
      previousState: previousDiscord,
      nextState: nextDiscord,
      details: { hasAnnouncementWebhook: Boolean(nextDiscord.announcements_webhook_url), hasAdminWebhook: Boolean(nextDiscord.admin_logs_webhook_url) },
      severity: "critical",
    });

    revalidateNotificationPaths();
    return { success: "Configuracoes do Discord atualizadas." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao salvar configuracoes do Discord." };
  }
}

export async function runScheduledNotifications(): Promise<ActionResult<{ sent: number; failed: number; total: number }>> {
  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "run_scheduled_notifications");

    const summary = await processScheduledDiscordNotifications(supabase, 50);

    await logAdminAction(supabase, {
      adminId,
      action: "run_scheduled_notifications",
      targetType: "notification",
      details: summary,
    });

    revalidateNotificationPaths();
    return { success: "Fila processada.", data: summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao processar fila." };
  }
}

export async function sendCustomInAppNotification(input: {
  title: string;
  message: string;
  severity: "info" | "warning" | "danger";
  audience: "single" | "all";
  userId?: string;
}): Promise<ActionResult<{ sent: number }>> {
  const parsed = inAppNotificationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.audience === "single" && !parsed.data.userId) {
    return { error: "Selecione um usuário para envio individual." };
  }

  try {
    const { supabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(supabase, adminId, "send_custom_in_app_notification");

    let userIds: string[] = [];
    if (parsed.data.audience === "single") {
      userIds = [parsed.data.userId as string];
    } else {
      let from = 0;
      const step = 1000;
      const collected: string[] = [];

      for (;;) {
        const { data: rows, error } = await supabase
          .from("profiles")
          .select("id")
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .range(from, from + step - 1);

        if (error) return { error: "Não foi possível listar usuários para envio." };

        const pageIds = (rows ?? []).map((row) => String(row.id)).filter(Boolean);
        if (pageIds.length === 0) break;
        collected.push(...pageIds);
        if (pageIds.length < step) break;
        from += step;
      }

      userIds = collected;
    }

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) {
      return { error: "Nenhum destinatário encontrado." };
    }

    const typeBySeverity: Record<"info" | "warning" | "danger", string> = {
      info: "admin_notice_info",
      warning: "admin_notice_warning",
      danger: "admin_notice_danger",
    };

    let sent = 0;
    const chunkSize = 500;
    for (let i = 0; i < uniqueUserIds.length; i += chunkSize) {
      const chunk = uniqueUserIds.slice(i, i + chunkSize);
      const payload = chunk.map((userId) => ({
        user_id: userId,
        type: typeBySeverity[parsed.data.severity],
        title: parsed.data.title,
        message: parsed.data.message,
        data: {
          severity: parsed.data.severity,
          audience: parsed.data.audience,
          sent_by: adminId,
          source: "admin_dashboard",
        },
      }));

      const result = await insertNotifications(supabase, payload);
      if (!result.success) return { error: result.error ?? "Falha ao enviar notificação personalizada." };
      sent += chunk.length;
    }

    await logAdminAction(supabase, {
      adminId,
      action: "send_custom_in_app_notification",
      targetType: "notification",
      details: {
        title: parsed.data.title,
        severity: parsed.data.severity,
        audience: parsed.data.audience,
        sent,
      },
      severity: parsed.data.severity === "danger" ? "critical" : parsed.data.severity === "warning" ? "warning" : "info",
    });

    revalidateNotificationPaths();
    return { success: `Notificação enviada para ${sent} usuário(s).`, data: { sent } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao enviar notificação personalizada." };
  }
}

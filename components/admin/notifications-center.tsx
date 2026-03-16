"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Clock3, RefreshCcw, Send, ShieldCheck, TestTube2 } from "lucide-react";

import {
  resendFailedNotification,
  runScheduledNotifications,
  scheduleNotification,
  sendCustomInAppNotification,
  sendDiscordNotification,
  testDiscordWebhook,
  updateDiscordWebhookSettings,
  updateNotificationTemplate,
} from "@/app/admin/notification-actions";
import type { AdminNotificationUserOption, DiscordSettingsData, NotificationHistoryItem, NotificationTemplateItem } from "@/app/admin/notifications/_data";
import type { DiscordNotificationType } from "@/lib/discord-notifications";
import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminButton } from "@/components/admin/admin-button";
import { AdminTable, type AdminTableColumn } from "@/components/admin/admin-table";
import { useAdminToast } from "@/components/admin/admin-toast";

const EVENT_TRIGGER_KEYS = [
  "tournament_published",
  "registration_approved",
  "registration_rejected",
  "match_scheduled",
  "match_result_published",
  "ranking_updated",
  "user_banned",
  "team_dissolved",
] as const;

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

type Props = {
  templates: NotificationTemplateItem[];
  history: NotificationHistoryItem[];
  settings: DiscordSettingsData;
  users: AdminNotificationUserOption[];
  isOwner: boolean;
};

export function NotificationsCenter({ templates, history, settings, users, isOwner }: Props) {
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  const [announcementsWebhook, setAnnouncementsWebhook] = useState(settings.announcements_webhook_url);
  const [adminWebhook, setAdminWebhook] = useState(settings.admin_logs_webhook_url);
  const [announcementChannel, setAnnouncementChannel] = useState(settings.announcement_channel);
  const [participantRole, setParticipantRole] = useState(settings.participant_role);
  const [verificationEnabled, setVerificationEnabled] = useState(settings.verification_enabled);
  const [eventMap, setEventMap] = useState<Record<string, boolean>>(settings.event_map ?? {});

  const [selectedTemplateType, setSelectedTemplateType] = useState(templates[0]?.type ?? "tournament_published");
  const [templateText, setTemplateText] = useState(templates[0]?.template ?? "");

  const [scheduleType, setScheduleType] = useState<DiscordNotificationType>("ranking_updated");
  const [scheduleData, setScheduleData] = useState('{"source":"manual_admin"}');
  const [scheduleAt, setScheduleAt] = useState("");

  const [inAppTitle, setInAppTitle] = useState("");
  const [inAppMessage, setInAppMessage] = useState("");
  const [inAppSeverity, setInAppSeverity] = useState<"info" | "warning" | "danger">("info");
  const [inAppAudience, setInAppAudience] = useState<"single" | "all">("single");
  const [inAppUserId, setInAppUserId] = useState("");

  const templateTypes = useMemo(
    () => templates.map((item) => item.type as DiscordNotificationType),
    [templates],
  );

  const selectedTemplateTypeSafe = selectedTemplateType as DiscordNotificationType;

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.type === selectedTemplateType) ?? null,
    [templates, selectedTemplateType],
  );

  function refresh() {
    router.refresh();
  }

  const columns: AdminTableColumn<NotificationHistoryItem>[] = [
    {
      key: "type",
      header: "Tipo",
      sortable: true,
      accessor: (row) => row.type,
      render: (row) => <span className="font-medium">{row.type}</span>,
    },
    {
      key: "webhook",
      header: "Webhook",
      sortable: true,
      accessor: (row) => row.webhook_kind,
      render: (row) => <span>{row.webhook_kind}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => (
        <AdminBadge tone={row.status === "sent" ? "active" : row.status === "failed" ? "danger" : "pending"}>
          {row.status}
        </AdminBadge>
      ),
    },
    {
      key: "attempts",
      header: "Tentativas",
      sortable: true,
      accessor: (row) => row.attempts,
      render: (row) => <span>{row.attempts}</span>,
    },
    {
      key: "created_at",
      header: "Criada",
      sortable: true,
      accessor: (row) => row.created_at,
      render: (row) => <span className="text-xs">{DATE_FMT.format(new Date(row.created_at))}</span>,
    },
    {
      key: "error",
      header: "Erro",
      render: (row) => <span className="line-clamp-2 text-xs text-slate-400">{row.error_message ?? "-"}</span>,
    },
    {
      key: "actions",
      header: "Acoes",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status === "failed" ? (
            <AdminButton
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await resendFailedNotification(row.id);
                  pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                  refresh();
                })
              }
            >
              Reenviar
            </AdminButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Configuracao de Webhooks
          </h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
              Webhook de anuncios
              <input
                value={announcementsWebhook}
                onChange={(event) => setAnnouncementsWebhook(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
                placeholder="https://discord.com/api/webhooks/..."
              />
            </label>

            <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
              Webhook de logs admin
              <input
                value={adminWebhook}
                onChange={(event) => setAdminWebhook(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
                placeholder="https://discord.com/api/webhooks/..."
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
                Canal anuncios
                <input
                  value={announcementChannel}
                  onChange={(event) => setAnnouncementChannel(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
                  placeholder="#anuncios"
                />
              </label>

              <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
                Role participante
                <input
                  value={participantRole}
                  onChange={(event) => setParticipantRole(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
                  placeholder="@participante"
                />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={verificationEnabled}
                onChange={(event) => setVerificationEnabled(event.target.checked)}
              />
              Integracao de verificacoes ativada
            </label>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Mapa de eventos</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {EVENT_TRIGGER_KEYS.map((key) => (
                  <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={eventMap[key] ?? true}
                      onChange={(event) =>
                        setEventMap((prev) => ({
                          ...prev,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {key}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <AdminButton
                type="button"
                disabled={!isOwner || isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await updateDiscordWebhookSettings({
                      announcements_webhook_url: announcementsWebhook,
                      admin_logs_webhook_url: adminWebhook,
                      announcement_channel: announcementChannel,
                      participant_role: participantRole,
                      verification_enabled: verificationEnabled,
                      event_map: eventMap,
                    });
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                    refresh();
                  })
                }
              >
                Salvar webhooks
              </AdminButton>

              <AdminButton
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await testDiscordWebhook("announcements");
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                    refresh();
                  })
                }
              >
                <TestTube2 className="h-4 w-4" />
                Testar anuncios
              </AdminButton>

              <AdminButton
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await testDiscordWebhook("admin_logs");
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                    refresh();
                  })
                }
              >
                <TestTube2 className="h-4 w-4" />
                Testar logs admin
              </AdminButton>
            </div>
            {!isOwner ? <p className="text-xs text-amber-200">Somente owner pode salvar configuracoes criticas.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <BellRing className="h-5 w-5 text-amber-300" />
            Templates e Agendamento
          </h2>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-400">Template</label>
              <select
                value={selectedTemplateType}
                onChange={(event) => {
                  const type = event.target.value;
                  setSelectedTemplateType(type);
                  const found = templates.find((item) => item.type === type);
                  setTemplateText(found?.template ?? "");
                }}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              >
                {templates.map((template) => (
                  <option key={template.type} value={template.type}>{template.type}</option>
                ))}
              </select>
              <textarea
                value={templateText}
                onChange={(event) => setTemplateText(event.target.value)}
                className="h-32 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              />
              <p className="text-xs text-slate-400">Placeholders: {"{{key}}"}. Exemplo: {"{{eventTitle}}"}</p>
              <AdminButton
                type="button"
                disabled={!isOwner || isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await updateNotificationTemplate(selectedTemplateTypeSafe, templateText);
                    pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                    refresh();
                  })
                }
              >
                Salvar template
              </AdminButton>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Clock3 className="h-4 w-4" />
                Agendar notificacao
              </p>
              <select
                value={scheduleType}
                onChange={(event) => setScheduleType(event.target.value as DiscordNotificationType)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              >
                {templateTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <textarea
                value={scheduleData}
                onChange={(event) => setScheduleData(event.target.value)}
                className="h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              />

              <div className="flex flex-wrap gap-2">
                <AdminButton
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const payload = JSON.parse(scheduleData) as Record<string, unknown>;
                        const result = await scheduleNotification(scheduleType, payload, scheduleAt);
                        pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                        refresh();
                      } catch {
                        pushToast("error", "JSON de payload invalido.");
                      }
                    })
                  }
                >
                  <Clock3 className="h-4 w-4" />
                  Agendar
                </AdminButton>

                <AdminButton
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const payload = JSON.parse(scheduleData) as Record<string, unknown>;
                        const result = await sendDiscordNotification(scheduleType, payload);
                        pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                        refresh();
                      } catch {
                        pushToast("error", "JSON de payload invalido.");
                      }
                    })
                  }
                >
                  <Send className="h-4 w-4" />
                  Enviar agora
                </AdminButton>

                <AdminButton
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await runScheduledNotifications();
                      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluido.");
                      refresh();
                    })
                  }
                >
                  <RefreshCcw className="h-4 w-4" />
                  Processar fila
                </AdminButton>
              </div>
            </div>
          </div>

          {selectedTemplate ? (
            <p className="mt-4 text-xs text-slate-400">Ultima atualizacao: {DATE_FMT.format(new Date(selectedTemplate.updated_at))}</p>
          ) : null}
        </article>
      </div>

      <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Historico de notificacoes</h2>
        <AdminTable data={history} columns={columns} pageSize={25} emptyText="Nenhuma notificacao registrada." />
      </article>

      <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
          <BellRing className="h-5 w-5 text-cyan-300" />
          Notificação personalizada (site)
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Envie notificações in-app informativas, de aviso ou alerta para um usuário específico ou para todos.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
            Título
            <input
              value={inAppTitle}
              onChange={(event) => setInAppTitle(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              placeholder="Ex.: Manutenção hoje às 23h"
              maxLength={150}
            />
          </label>

          <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
            Tipo visual
            <select
              value={inAppSeverity}
              onChange={(event) => setInAppSeverity(event.target.value as "info" | "warning" | "danger")}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
            >
              <option value="info">Informativa</option>
              <option value="warning">Aviso</option>
              <option value="danger">Alerta (danger)</option>
            </select>
          </label>

          <label className="block text-xs uppercase tracking-[0.12em] text-slate-400 md:col-span-2">
            Mensagem
            <textarea
              value={inAppMessage}
              onChange={(event) => setInAppMessage(event.target.value)}
              className="mt-1 h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              placeholder="Mensagem que aparecerá no sino de notificações"
              maxLength={2000}
            />
          </label>

          <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
            Destinatário
            <select
              value={inAppAudience}
              onChange={(event) => setInAppAudience(event.target.value as "single" | "all")}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
            >
              <option value="single">Usuário específico</option>
              <option value="all">Todos os usuários</option>
            </select>
          </label>

          {inAppAudience === "single" ? (
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-400">
              Usuário
              <select
                value={inAppUserId}
                onChange={(event) => setInAppUserId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Selecione</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name} (@{user.username})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4">
          <AdminButton
            type="button"
            disabled={
              isPending ||
              inAppTitle.trim().length < 3 ||
              inAppMessage.trim().length < 3 ||
              (inAppAudience === "single" && !inAppUserId)
            }
            onClick={() =>
              startTransition(async () => {
                const result = await sendCustomInAppNotification({
                  title: inAppTitle,
                  message: inAppMessage,
                  severity: inAppSeverity,
                  audience: inAppAudience,
                  userId: inAppAudience === "single" ? inAppUserId : undefined,
                });

                pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Concluído.");
                if (!result.error) {
                  setInAppTitle("");
                  setInAppMessage("");
                  setInAppSeverity("info");
                  setInAppAudience("single");
                  setInAppUserId("");
                }
                refresh();
              })
            }
          >
            Enviar notificação in-app
          </AdminButton>
        </div>
      </article>
    </section>
  );
}

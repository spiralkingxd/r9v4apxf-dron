"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Bell, Check, X, Users, Gift, Info, Trash2 } from "lucide-react";
import { deleteNotification, deleteReadNotifications, getNotifications, markAllAsRead, markAsRead, processInviteAction, processJoinRequestAction, Notification } from "@/app/actions/notifications";
import { createClient } from "@/lib/supabase/client"; // Assumindo que você tem isso
import { cn } from "@/lib/utils";
import { ActionToast } from "@/components/action-toast";

export function NotificationsBell() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const [supabase] = useState(() => createClient());

  // Buscar inicial
  const fetchNotifications = useCallback(async () => {
    const { data, unreadCount: unreadTotal } = await getNotifications();
    if (data) {
      setNotifications(data);
      setUnreadCount(typeof unreadTotal === "number" ? unreadTotal : data.filter((n) => !n.read).length);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const bootstrap = async () => {
      await fetchNotifications();

      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted || !user) return;

      // Inscreve apenas nas notificações do usuário logado
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();
    };

    void bootstrap();

    // Fallback para ambientes sem realtime configurado
    const intervalId = window.setInterval(() => {
      fetchNotifications();
    }, 15000);

    const handleFocus = () => fetchNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchNotifications, supabase]);

  const handleToggle = () => setOpen(!open);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllAsRead();
      await fetchNotifications();
    });
  };

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markAsRead(id);
      await fetchNotifications();
    });
  };

  const handleDeleteNotification = (id: string) => {
    startTransition(async () => {
      const previous = notifications;
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - (previous.find((item) => item.id === id && !item.read) ? 1 : 0)));
      const result = await deleteNotification(id);
      if (!result.success) {
        setNotifications(previous);
        setUnreadCount(previous.filter((item) => !item.read).length);
        setToast({ message: result.error || "Não foi possível excluir a notificação.", tone: "error" });
      }
      await fetchNotifications();
      if (result.success) {
        setToast({ message: "Notificação excluída.", tone: "success" });
      }
      setTimeout(() => setToast(null), 3000);
    });
  };

  const handleDeleteReadNotifications = () => {
    startTransition(async () => {
      const previous = notifications;
      setNotifications((prev) => prev.filter((item) => !item.read));
      const result = await deleteReadNotifications();
      if (!result.success) {
        setNotifications(previous);
        setToast({ message: result.error || "Não foi possível excluir notificações lidas.", tone: "error" });
      }
      await fetchNotifications();
      if (result.success) {
        setToast({ message: result.deletedCount ? "Notificações lidas excluídas." : "Não havia notificações lidas para excluir.", tone: "success" });
      }
      setTimeout(() => setToast(null), 3000);
    });
  };

  const handleInviteAction = (id: string, action: "accept" | "decline", teamId: string) => {
    startTransition(async () => {
      const res = await processInviteAction(id, action, teamId);
      if (res.error) {
        setToast({ message: res.error, tone: "error" });
      } else {
        setToast({ message: res.success || "", tone: "success" });
      }
      await fetchNotifications();
      setTimeout(() => setToast(null), 3000);
      setTimeout(() => setOpen(false), 2000);
    });
  };

  const handleJoinRequestAction = (id: string, action: "approved" | "rejected", requestId: string) => {
    startTransition(async () => {
      const res = await processJoinRequestAction(id, action, requestId);
      if ((res as { error?: string }).error) {
        setToast({ message: (res as { error?: string }).error || "Erro ao processar solicitação.", tone: "error" });
      } else {
        setToast({ message: (res as { success?: string }).success || "Solicitação processada.", tone: "success" });
      }
      await fetchNotifications();
      setTimeout(() => setToast(null), 3000);
    });
  };

  const readCount = notifications.filter((notification) => notification.read).length;

  return (
    <div className="relative" ref={rootRef}>
      {toast && (
        <div className="fixed bottom-4 right-4 z-[999] bg-[#0b141e] rounded-xl pr-2 flex items-center shadow-xl">
           <ActionToast message={toast.message} tone={toast.tone} />
           <button onClick={() => setToast(null)} className="ml-2 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white"><X className="h-4 w-4" /></button>
        </div>
      )}

      <button
        onClick={handleToggle}
        className="relative rounded-full p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-100"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-slate-900 dark:text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[120%] z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0b141e]/95 p-4 shadow-xl shadow-black/50 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações</h3>
            <div className="flex flex-wrap justify-end gap-2">
              {readCount > 0 && (
                <button
                  onClick={handleDeleteReadNotifications}
                  disabled={isPending}
                  className="text-xs font-semibold text-rose-400 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Excluir lidas
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="text-xs font-semibold text-cyan-400 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">Nenhuma notificação.</p>
            ) : (
              notifications.map((notif) => {
                const isInvite = notif.type === "team_invite";
                const isJoinRequest = notif.type === "team_join_request";
                const severity = String(notif.data?.severity ?? "").toLowerCase();
                const isDanger = severity === "danger" || notif.type.includes("danger") || notif.type.includes("alert");
                const isWarning = severity === "warning" || notif.type.includes("warning");
                const hasJoinRequestAction = isJoinRequest && !notif.read && Boolean(notif.data?.request_id);
                const hasInviteAction = isInvite && !notif.read && Boolean(notif.data?.team_id);
                const isActionable = hasInviteAction || hasJoinRequestAction;

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "group relative flex flex-col gap-2 rounded-xl p-3 text-left transition",
                      notif.read ? "opacity-70 hover:opacity-100" : "bg-slate-100 dark:bg-white/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-full bg-slate-100 dark:bg-white/5 p-2">
                         {isInvite ? (
                           <Users className="h-4 w-4 text-emerald-400" />
                         ) : isDanger ? (
                           <AlertTriangle className="h-4 w-4 text-rose-400" />
                         ) : isWarning ? (
                           <AlertTriangle className="h-4 w-4 text-amber-400" />
                         ) : (
                           <Info className="h-4 w-4 text-cyan-400" />
                         )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200">{notif.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{notif.message}</p>
                        
                        {/* Botões de Convite */}
                        {hasInviteAction && (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              disabled={isPending}
                              onClick={() => handleInviteAction(notif.id, "accept", notif.data.team_id)}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
                            >
                              <Check className="h-3 w-3" /> Aceitar
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => handleInviteAction(notif.id, "decline", notif.data.team_id)}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-500/20 px-2 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/30"
                            >
                              <X className="h-3 w-3" /> Recusar
                            </button>
                          </div>
                        )}

                        {hasJoinRequestAction && (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              disabled={isPending}
                              onClick={() => handleJoinRequestAction(notif.id, "approved", String(notif.data?.request_id))}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
                            >
                              <Check className="h-3 w-3" /> Aprovar
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => handleJoinRequestAction(notif.id, "rejected", String(notif.data?.request_id))}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-500/20 px-2 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/30"
                            >
                              <X className="h-3 w-3" /> Recusar
                            </button>
                          </div>
                        )}

                        <p className="mt-2 text-[10px] text-slate-500">
                          {new Date(notif.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-start opacity-0 transition group-hover:opacity-100">
                        {!notif.read && !isActionable && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            disabled={isPending}
                            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Marcar como lida"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notif.id)}
                          disabled={isPending}
                          className="rounded-md p-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Excluir notificação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { respondToJoinRequest } from "@/app/actions/team-requests";

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
};

export async function getNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { data: [], unreadCount: 0, error: "Não autenticado" };

  const [{ data, error }, { count: unreadCount, error: unreadError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
  ]);

  if (error || unreadError) {
    return { data: [], unreadCount: 0, error: error?.message ?? unreadError?.message ?? "Erro ao buscar notificações." };
  }

  return { data: data as Notification[], unreadCount: unreadCount ?? 0, error: null };
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (!error) {
    revalidatePath("/");
    return { success: true };
  }
  return { success: false };
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (!error) {
    revalidatePath("/");
    return { success: true };
  }
  return { success: false };
}

export async function deleteNotification(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: "Não foi possível excluir a notificação." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteReadNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .eq("read", true);

  if (error) {
    return { success: false, error: "Não foi possível excluir as notificações lidas." };
  }

  revalidatePath("/");
  return { success: true };
}

export async function processInviteAction(notificationId: string, action: "accept" | "decline", teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Não autenticado" };

  // Marcar como lido independentemente da ação
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId);

  if (action === "accept") {
    // 1. Verifica se já está no limite de equipes
    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count && count >= 1) { // Supondo limite de 1
      return { error: "Você já possui uma equipe. Saia da equipe atual antes de aceitar." };
    }

    // 2. Insere no time
    const { error: insertErr } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, user_id: user.id, role: "member" });

    if (insertErr) {
      return { error: insertErr.message.includes("duplicate") ? "Você já está nesta equipe." : "Erro ao aceitar convite." };
    }
  }

  // Se for decline, apenas foi marcado como lido
  revalidatePath("/profile/me");
  revalidatePath("/teams");
  return { success: "Ação processada com sucesso!" };
}

export async function processJoinRequestAction(
  notificationId: string,
  action: "approved" | "rejected",
  requestId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Não autenticado" };

  const result = await respondToJoinRequest(requestId, action);
  if (!result.success) {
    return { error: result.error ?? "Não foi possível processar a solicitação." };
  }

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  revalidatePath(`/teams`);
  revalidatePath(`/profile/me`);
  return { success: action === "approved" ? "Solicitação aprovada." : "Solicitação recusada." };
}

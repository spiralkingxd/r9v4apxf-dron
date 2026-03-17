"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getRequestContext, writeSecurityAlert } from "@/lib/security/alerts";

export async function assertAdminAccess() {
  const supabase = await createClient();
  const headerStore = await headers();
  const requestContext = getRequestContext(headerStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await writeSecurityAlert({
      action: "auth_401_admin_area",
      targetType: "admin",
      riskLevel: "high",
      context: requestContext,
    });
    throw new Error("Não autorizado");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_banned")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      role: "user" | "admin" | "owner";
      is_banned: boolean;
    }>();

  if (!profile || profile.is_banned) {
    await writeSecurityAlert({
      adminUserId: user.id,
      action: "auth_403_admin_area",
      targetType: "admin",
      targetId: user.id,
      riskLevel: "high",
      context: {
        ...requestContext,
        banned: Boolean(profile?.is_banned),
        hasProfile: Boolean(profile),
      },
    });
    throw new Error("Acesso negado");
  }

  if (profile.role !== "admin" && profile.role !== "owner") {
    await writeSecurityAlert({
      adminUserId: user.id,
      action: "auth_403_admin_role",
      targetType: "admin",
      targetId: user.id,
      riskLevel: "critical",
      context: {
        ...requestContext,
        role: profile.role,
      },
    });
    throw new Error("Acesso negado");
  }

  return { supabase, adminId: profile.id, role: profile.role };
}

export async function assertOwnerAccess() {
  const ctx = await assertAdminAccess();
  if (ctx.role !== "owner") {
    throw new Error("Apenas owners podem executar esta ação.");
  }
  return ctx;
}

export async function enforceAdminRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  action: string,
) {
  const windowStart = new Date(Date.now() - 1200).toISOString();
  const { count } = await supabase
    .from("admin_action_logs")
    .select("*", { count: "exact", head: true })
    .eq("admin_user_id", adminId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if ((count ?? 0) > 0) {
    throw new Error("Ação repetida muito rápido. Tente novamente em instantes.");
  }
}

export async function logAdminAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    details?: Record<string, unknown>;
    severity?: "info" | "warning" | "critical";
    suspicious?: boolean;
    previousState?: Record<string, unknown>;
    nextState?: Record<string, unknown>;
    ipAddress?: string | null;
  },
) {
  await supabase.from("admin_action_logs").insert({
    admin_user_id: payload.adminId,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId ?? null,
    details: payload.details ?? {},
    severity: payload.severity ?? "info",
    suspicious: payload.suspicious ?? false,
    previous_state: payload.previousState ?? null,
    next_state: payload.nextState ?? null,
    ip_address: payload.ipAddress ?? null,
  });
}

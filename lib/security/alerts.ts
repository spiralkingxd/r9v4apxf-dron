import "server-only";

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

import { createAdminClient } from "@/lib/supabase/admin";

type RiskLevel = "low" | "medium" | "high" | "critical";

type SecurityAlertInput = {
  adminUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  riskLevel?: RiskLevel;
  context?: Record<string, unknown>;
};

export function getRequestContext(headerStore: ReadonlyHeaders) {
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip")?.trim() ??
    null;

  return {
    ip,
    userAgent: headerStore.get("user-agent") ?? null,
    referer: headerStore.get("referer") ?? null,
    host: headerStore.get("host") ?? null,
  };
}

export async function writeSecurityAlert(input: SecurityAlertInput) {
  try {
    const admin = createAdminClient();
    if (!admin) return;

    await admin.from("admin_security_alerts").insert({
      admin_user_id: input.adminUserId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      risk_level: input.riskLevel ?? "medium",
      context: input.context ?? {},
    });
  } catch {
    // best-effort log
  }
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { writeSecurityAlert, getRequestContext } from "@/lib/security/alerts";
import { enforceWindowRateLimit } from "@/lib/security/rate-limit";

function getBaseUrl(originFromHeaders: string | null) {
  if (originFromHeaders) {
    return originFromHeaders;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function loginWithDiscord(formData: FormData) {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const next = String(formData.get("next") ?? "/");
  const context = getRequestContext(headerStore);

  enforceWindowRateLimit({
    key: `login:discord:${context.ip ?? "unknown"}`,
    windowMs: 60_000,
    max: 15,
  });

  const supabase = await createClient();
  const redirectTo = `${getBaseUrl(origin)}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo,
      queryParams: {
        prompt: "consent",
        scope: "identify email connections",
      },
    },
  });

  if (error || !data.url) {
    await writeSecurityAlert({
      action: "auth_oauth_start_failed",
      targetType: "auth",
      riskLevel: "medium",
      context: {
        ...context,
        provider: "discord",
        reason: error?.message ?? "oauth_start_failed",
      },
    });

    redirect(`/auth/login?error=${encodeURIComponent(error?.message ?? "oauth_start_failed")}`);
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
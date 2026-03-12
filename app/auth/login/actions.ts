"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
    redirect(`/auth/login?error=${encodeURIComponent(error?.message ?? "oauth_start_failed")}`);
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
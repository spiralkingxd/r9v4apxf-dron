import { NextResponse, type NextRequest } from "next/server";

import { upsertProfileFromOAuth } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_code", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorUrl = new URL("/auth/login", request.url);
    errorUrl.searchParams.set("error", error.message);

    return NextResponse.redirect(errorUrl);
  }

  await upsertProfileFromOAuth();

  return NextResponse.redirect(new URL(next, request.url));
}
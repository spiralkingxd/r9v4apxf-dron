import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { resolveDiscordIdFromAuthUser } from "@/lib/auth/discord-id";
import { getOwnerDiscordId, getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

const PRIVATE_PATH_PREFIXES = ["/profile/me"];
const ADMIN_PATH_PREFIX = "/admin";
const OWNER_ONLY_PATH_PREFIXES = ["/admin/settings", "/admin/backup", "/admin/logs"];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPrivatePath = PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAdminPath = pathname.startsWith(ADMIN_PATH_PREFIX);
  const isOwnerOnlyPath = OWNER_ONLY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isSupabaseConfigured()) {
    if (isPrivatePath || isAdminPath) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("reason", "supabase_not_configured");

      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  try {
    let response = NextResponse.next({ request });

    const { supabaseAnonKey, supabaseUrl } = getSupabaseEnv();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && (isPrivatePath || isAdminPath)) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);

      return NextResponse.redirect(loginUrl);
    }

    if (user && (isPrivatePath || isAdminPath)) {
      const nowIso = new Date().toISOString();
      const resolvedDiscordId = resolveDiscordIdFromAuthUser(user) ?? user.id;
      const ownerDiscordId = getOwnerDiscordId();
      const shouldBeOwner = Boolean(ownerDiscordId && resolvedDiscordId === ownerDiscordId);

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle<{ id: string; role: "user" | "admin" | "owner" }>();

      if (!existingProfile) {
        const metadata = user.user_metadata ?? {};
        const displayName =
          metadata.full_name ?? metadata.name ?? metadata.global_name ?? user.email?.split("@")[0] ?? "Pirata";
        const username = metadata.user_name ?? metadata.preferred_username ?? metadata.name ?? displayName;
        const avatarUrl = metadata.avatar_url ?? null;

        await supabase.from("profiles").upsert(
          {
            id: user.id,
            discord_id: resolvedDiscordId,
            display_name: displayName,
            username,
            email: user.email ?? null,
            avatar_url: avatarUrl,
            xbox_gamertag: null,
            role: shouldBeOwner ? "owner" : "user",
            updated_at: nowIso,
          },
          { onConflict: "id" },
        );
      } else if (shouldBeOwner && existingProfile.role !== "owner") {
        await supabase
          .from("profiles")
          .update({ role: "owner", updated_at: nowIso })
          .eq("id", user.id)
          .neq("role", "owner");
      }
    }

    if (user && isAdminPath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_banned")
        .eq("id", user.id)
        .maybeSingle<{ role: "user" | "admin" | "owner"; is_banned: boolean }>();

      if (profile?.is_banned) {
        console.warn("[banned-user-admin-attempt]", {
          userId: user.id,
          pathname,
        });
        return NextResponse.redirect(new URL("/?reason=banned", request.url));
      }

      if (profile?.role !== "admin" && profile?.role !== "owner") {
        console.warn("[admin-access-denied]", {
          userId: user.id,
          pathname,
          role: profile?.role ?? "unknown",
        });
        return NextResponse.redirect(new URL("/", request.url));
      }

      if (isOwnerOnlyPath && profile.role !== "owner") {
        console.warn("[owner-access-denied]", {
          userId: user.id,
          pathname,
          role: profile.role,
        });
        return NextResponse.redirect(new URL("/admin/dashboard?reason=owner_required", request.url));
      }
    }

    if (user && isPrivatePath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.is_banned) {
        return NextResponse.redirect(new URL("/?reason=banned", request.url));
      }
    }

    return response;
  } catch {
    if (isPrivatePath || isAdminPath) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }
}

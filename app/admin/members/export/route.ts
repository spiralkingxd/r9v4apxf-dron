import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: "user" | "admin" | "owner" }>();

  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const ids = idsParam
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const query = supabase
    .from("profiles")
    .select("id, display_name, username, discord_id, xbox_gamertag, email, role, is_banned, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  const { data } = ids.length ? await query.in("id", ids) : await query;

  if (format === "json") {
    return NextResponse.json(data ?? [], {
      headers: {
        "content-disposition": "attachment; filename=members-export.json",
      },
    });
  }

  const lines = [
    "id,display_name,username,discord_id,xbox_gamertag,email,role,is_banned,created_at",
    ...(data ?? []).map((row) => {
      const values = [
        row.id,
        row.display_name,
        row.username,
        row.discord_id,
        row.xbox_gamertag,
        row.email,
        row.role,
        String(row.is_banned),
        row.created_at,
      ].map((v) => `"${String(v ?? "").replaceAll("\"", "\"\"")}"`);
      return values.join(",");
    }),
  ];

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=members-export.csv",
    },
  });
}

import { ShieldAlert } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminAccess, enforceAdminRateLimit } from "@/app/admin/_lib";
import { createClient } from "@/lib/supabase/server";
import { AdminButton as Button } from "@/components/admin/admin-button";

export const metadata = {
  title: "Admin - Community Streamers",
};

type StreamerRow = {
  id: string;
  username: string;
  display_name: string | null;
  platform: "twitch" | "youtube" | null;
  channel_url: string | null;
  is_live: boolean | null;
  viewers: number | null;
  live_title: string | null;
  community_enabled: boolean | null;
  is_featured: boolean | null;
  stream_origin: "manual_event" | "community_auto" | null;
  has_madnessarena_tag: boolean | null;
  twitch_live_tags: unknown;
};

const OPS_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  eventsub_ok: { tone: "success", text: "Subscriptions EventSub registradas com sucesso." },
  eventsub_err: { tone: "error", text: "Falha ao registrar EventSub." },
  sync_ok: { tone: "success", text: "Descoberta + sincronização executadas com sucesso." },
  sync_err: { tone: "error", text: "Falha na descoberta/sincronização." },
};

async function getCommunityStreamersData() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("streamers")
    .select("*")
    .eq("stream_origin", "community_auto")
    .order("is_live", { ascending: false })
    .order("viewers", { ascending: false })
    .order("display_name", { ascending: true });

  if (error) {
    if (error.code === "42P01") return null;
    console.error("getCommunityStreamersData error", error);
    return { rows: [], tagsByStreamer: new Map<string, string[]>() };
  }

  const rows = ((data ?? []) as StreamerRow[]).filter((row) => Boolean(row.has_madnessarena_tag));
  return { rows };
}

export default async function AdminCommunityStreamersPage({
  searchParams,
}: {
  searchParams?: Promise<{ ops?: string; reason?: string }>;
}) {
  const data = await getCommunityStreamersData();
  const resolvedSearchParams = (await searchParams) ?? {};
  const opsMessage = OPS_MESSAGES[resolvedSearchParams.ops ?? ""];
  const reason = resolvedSearchParams.reason ? decodeURIComponent(resolvedSearchParams.reason) : null;

  async function registerEventSubSubscriptions() {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "community_streamers_register_eventsub");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const secret = process.env.STREAMERS_CRON_SECRET?.trim();
    if (!appUrl || !secret) redirect("/admin/community-streamers?ops=eventsub_err");

    const response = await fetch(`${appUrl}/api/twitch/eventsub/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });

    if (response.ok) {
      redirect("/admin/community-streamers?ops=eventsub_ok");
    }

    let detail = "Erro desconhecido";
    try {
      const payload = (await response.json()) as { error?: string };
      detail = payload.error ?? detail;
    } catch {
      detail = `HTTP ${response.status}`;
    }
    redirect(`/admin/community-streamers?ops=eventsub_err&reason=${encodeURIComponent(detail)}`);
  }

  async function runStreamersSyncNow() {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "community_streamers_sync_now");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const secret = process.env.STREAMERS_CRON_SECRET?.trim();
    if (!appUrl || !secret) redirect("/admin/community-streamers?ops=sync_err");

    const response = await fetch(`${appUrl}/api/cron/streamers-sync`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });

    revalidatePath("/streamers");
    redirect(`/admin/community-streamers?ops=${response.ok ? "sync_ok" : "sync_err"}`);
  }

  if (data === null) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
          Execute `supabase/community_streamers_schema.sql` para habilitar a aba de comunidade.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Community Streamers (Automático)</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Sem cadastro manual: qualquer canal encontrado ao vivo com a palavra-chave <strong>madnessarena</strong> entra automaticamente na página /streamers.
        </p>
      </div>

      {opsMessage ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            opsMessage.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {opsMessage.text}
          {reason && opsMessage.tone === "error" ? <span className="ml-2 opacity-90">Motivo: {reason}</span> : null}
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <form action={registerEventSubSubscriptions}>
          <Button type="submit" variant="ghost">Registrar EventSub</Button>
        </form>
        <form action={runStreamersSyncNow}>
          <Button type="submit" variant="primary">Descobrir + sincronizar agora</Button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        Streamers detectados: <strong>{data.rows.length}</strong>
      </div>

      <div className="mt-4 space-y-3">
        {data.rows.map((s) => {
          const tags = Array.isArray(s.twitch_live_tags)
            ? s.twitch_live_tags.map((tag) => String(tag))
            : [];
          return (
            <article key={s.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/5 p-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Streamer</p>
                  <p className="font-semibold">{s.display_name ?? s.username}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className={`font-semibold ${s.is_live ? "text-rose-300" : "text-slate-300"}`}>
                    {s.is_live ? `Ao vivo (${Number(s.viewers ?? 0).toLocaleString("pt-BR")} viewers)` : "Offline"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Plataforma</p>
                  <p className="font-semibold">{s.platform ?? "twitch"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Canal</p>
                  <a href={s.channel_url ?? `https://twitch.tv/${s.username}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 hover:underline">
                    @{s.username}
                  </a>
                </div>
              </div>
              {s.live_title ? <p className="mt-2 text-sm text-slate-200 line-clamp-2">{s.live_title}</p> : null}
              <p className="mt-2 text-xs text-slate-500">Tags Twitch: {tags.join(", ") || "sem tags"}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

import { Plus, Save, ShieldAlert } from "lucide-react";
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
  avatar_url: string | null;
  bio: string | null;
  twitch_id: string | null;
  twitch_login: string | null;
  is_featured: boolean | null;
  community_enabled: boolean | null;
};

type TagLinkRow = {
  streamer_id: string;
  streamer_tags: { slug: string } | { slug: string }[] | null;
};

const OPS_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  eventsub_ok: { tone: "success", text: "Subscriptions EventSub registradas com sucesso." },
  eventsub_err: { tone: "error", text: "Falha ao registrar EventSub." },
  sync_ok: { tone: "success", text: "Sincronização executada com sucesso." },
  sync_err: { tone: "error", text: "Falha ao sincronizar status." },
};

async function getCommunityStreamersData() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("streamers")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return null;
    console.error("getCommunityStreamersData error", error);
    return { rows: [], tagsByStreamer: new Map<string, string[]>() };
  }

  const ids = (data ?? []).map((row) => row.id);
  if (ids.length === 0) return { rows: (data ?? []) as StreamerRow[], tagsByStreamer: new Map<string, string[]>() };

  const { data: tagLinks } = await supabase
    .from("streamer_tag_links")
    .select("streamer_id, streamer_tags(slug)")
    .in("streamer_id", ids);

  const tagsByStreamer = new Map<string, string[]>();
  for (const row of (tagLinks ?? []) as TagLinkRow[]) {
    const raw = row.streamer_tags;
    const tags = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map((item) => String(item.slug ?? "").toLowerCase().trim())
      .filter(Boolean);
    tagsByStreamer.set(row.streamer_id, [...new Set([...(tagsByStreamer.get(row.streamer_id) ?? []), ...tags])]);
  }

  return { rows: (data ?? []) as StreamerRow[], tagsByStreamer };
}

function normalizeTagsInput(input: string) {
  return Array.from(new Set(input.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)));
}

export default async function AdminCommunityStreamersPage({
  searchParams,
}: {
  searchParams?: Promise<{ ops?: string }>;
}) {
  const data = await getCommunityStreamersData();
  const resolvedSearchParams = (await searchParams) ?? {};
  const opsMessage = OPS_MESSAGES[resolvedSearchParams.ops ?? ""];

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

    redirect(`/admin/community-streamers?ops=${response.ok ? "eventsub_ok" : "eventsub_err"}`);
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

  async function saveCommunityDetails(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "community_streamers_save_details");

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const displayName = String(formData.get("display_name") ?? "").trim();
    const platform = String(formData.get("platform") ?? "twitch").trim().toLowerCase();
    const channelUrl = String(formData.get("channel_url") ?? "").trim();
    const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
    const bio = String(formData.get("bio") ?? "").trim();
    const twitchId = String(formData.get("twitch_id") ?? "").trim();
    const twitchLogin = String(formData.get("twitch_login") ?? "").trim().toLowerCase();
    const isFeatured = formData.get("is_featured") === "on";
    const communityEnabled = formData.get("community_enabled") === "on";

    if (!username || !displayName || !channelUrl || (platform !== "twitch" && platform !== "youtube")) return;

    const supabase = await createClient();
    await supabase.from("streamers").update({
      username,
      display_name: displayName,
      platform,
      channel_url: channelUrl,
      avatar_url: avatarUrl || null,
      bio: bio || null,
      twitch_id: twitchId || null,
      twitch_login: twitchLogin || username,
      is_featured: isFeatured,
      community_enabled: communityEnabled,
    }).eq("id", id);

    revalidatePath("/admin/community-streamers");
    revalidatePath("/streamers");
  }

  async function addCommunityStreamer(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "community_streamers_add");

    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    if (!username) return;

    const supabase = await createClient();
    const basePayload = {
      username,
      display_name: username,
      platform: "twitch",
      channel_url: `https://twitch.tv/${username}`,
      twitch_login: username,
    };

    const attempts: Array<Record<string, unknown>> = [
      { ...basePayload, community_enabled: true },
      basePayload,
      { username },
    ];

    for (const payload of attempts) {
      const { error } = await supabase.from("streamers").insert(payload);
      if (!error) break;
      if (error.code !== "42703" && error.code !== "23502") {
        console.error("[community-streamers] add insert failed", error);
        break;
      }
    }

    revalidatePath("/admin/community-streamers");
    revalidatePath("/streamers");
  }

  async function saveCommunityTags(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "community_streamers_save_tags");

    const streamerId = String(formData.get("id") ?? "");
    const tagsRaw = String(formData.get("tags") ?? "");
    if (!streamerId) return;

    const tags = normalizeTagsInput(tagsRaw);
    const supabase = await createClient();

    if (tags.length === 0) {
      await supabase.from("streamer_tag_links").delete().eq("streamer_id", streamerId);
      revalidatePath("/admin/community-streamers");
      revalidatePath("/streamers");
      return;
    }

    const upsertRows = tags.map((slug) => ({
      slug,
      name: slug === "madnessarena" ? "MadnessArena" : slug,
      is_highlight: slug === "madnessarena",
    }));

    const { data: upserted } = await supabase
      .from("streamer_tags")
      .upsert(upsertRows, { onConflict: "slug", ignoreDuplicates: false })
      .select("id, slug");

    const tagIds = (upserted ?? []).map((row) => row.id);
    if (tagIds.length === 0) return;

    await supabase.from("streamer_tag_links").delete().eq("streamer_id", streamerId);
    await supabase.from("streamer_tag_links").insert(tagIds.map((tagId) => ({ streamer_id: streamerId, tag_id: tagId })));

    revalidatePath("/admin/community-streamers");
    revalidatePath("/streamers");
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Community Streamers</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Aba separada da comunidade (não mistura com multiview/transmissões).</p>
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
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <form action={registerEventSubSubscriptions}>
          <Button type="submit" variant="ghost">Registrar EventSub</Button>
        </form>
        <form action={runStreamersSyncNow}>
          <Button type="submit" variant="primary">Sincronizar status agora</Button>
        </form>
      </div>

      <div className="mb-6 max-w-2xl rounded-xl border border-slate-200 dark:border-white/10 bg-white/5 p-6">
        <h3 className="mb-3 text-lg font-semibold">Adicionar streamer na comunidade</h3>
        <form action={addCommunityStreamer} className="flex gap-2">
          <input name="username" required placeholder="username twitch" className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
          <Button type="submit" variant="primary"><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
        </form>
      </div>

      <div className="space-y-4">
        {data.rows.map((s) => {
          const tags = (data.tagsByStreamer.get(s.id) ?? []).join(", ");
          return (
            <article key={s.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/5 p-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <form action={saveCommunityDetails} className="space-y-2 rounded-xl border border-slate-200 dark:border-white/10 p-3">
                  <input type="hidden" name="id" value={s.id} />
                  <label className="block text-xs text-slate-500">Display name</label>
                  <input name="display_name" defaultValue={s.display_name ?? s.username} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="block text-xs text-slate-500">Username</label>
                  <input name="username" defaultValue={s.username} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="block text-xs text-slate-500">Plataforma</label>
                  <select name="platform" defaultValue={s.platform ?? "twitch"} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm">
                    <option value="twitch">Twitch</option>
                    <option value="youtube">YouTube</option>
                  </select>
                  <label className="block text-xs text-slate-500">Channel URL</label>
                  <input name="channel_url" defaultValue={s.channel_url ?? `https://twitch.tv/${s.username}`} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="block text-xs text-slate-500">Avatar URL</label>
                  <input name="avatar_url" defaultValue={s.avatar_url ?? ""} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="block text-xs text-slate-500">Bio</label>
                  <textarea name="bio" defaultValue={s.bio ?? ""} rows={2} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="block text-xs text-slate-500">Twitch ID</label>
                  <input name="twitch_id" defaultValue={s.twitch_id ?? ""} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="block text-xs text-slate-500">Twitch login</label>
                  <input name="twitch_login" defaultValue={s.twitch_login ?? s.username} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <label className="mt-1 inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" name="community_enabled" defaultChecked={Boolean(s.community_enabled ?? true)} />
                    Ativo na página /streamers
                  </label>
                  <label className="mt-1 inline-flex items-center gap-2 text-xs">
                    <input type="checkbox" name="is_featured" defaultChecked={Boolean(s.is_featured)} />
                    Destacar no topo
                  </label>
                  <Button type="submit" variant="primary"><Save className="h-4 w-4 mr-2" />Salvar dados</Button>
                </form>

                <form action={saveCommunityTags} className="space-y-2 rounded-xl border border-slate-200 dark:border-white/10 p-3">
                  <input type="hidden" name="id" value={s.id} />
                  <label className="block text-xs text-slate-500">Tags (CSV)</label>
                  <input name="tags" defaultValue={tags} placeholder="madnessarena, caster, comunidade br" className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                  <p className="text-xs text-slate-500">Para aparecer em /streamers, inclua obrigatoriamente a tag <strong>madnessarena</strong>.</p>
                  <Button type="submit" variant="primary"><Save className="h-4 w-4 mr-2" />Salvar tags</Button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

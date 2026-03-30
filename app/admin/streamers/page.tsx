import { Plus, Trash2, ShieldAlert, Star, MonitorUp, Save } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminAccess, enforceAdminRateLimit } from "@/app/admin/_lib";
import { createClient } from "@/lib/supabase/server";
import { AdminButton as Button } from "@/components/admin/admin-button";

export const metadata = {
  title: "Admin - Streamers",
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
  is_official: boolean;
  is_featured: boolean | null;
  is_active: boolean | null;
  selected_for_multiview: boolean | null;
  created_at: string;
};

type TagLinkRow = {
  streamer_id: string;
  streamer_tags: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

async function getStreamersData() {
  const supabase = await createClient();
  const { data: streamers, error } = await supabase
    .from("streamers")
    .select("id, username, display_name, platform, channel_url, avatar_url, bio, twitch_id, twitch_login, is_official, is_featured, is_active, selected_for_multiview, created_at")
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return null;
    console.error("Error fetching streamers:", error);
    return { streamers: [], tagsByStreamer: new Map<string, string[]>() };
  }

  const ids = (streamers ?? []).map((row) => row.id);
  if (ids.length === 0) {
    return { streamers: streamers ?? [], tagsByStreamer: new Map<string, string[]>() };
  }

  const { data: links } = await supabase
    .from("streamer_tag_links")
    .select("streamer_id, streamer_tags(slug, name)")
    .in("streamer_id", ids);

  const tagsByStreamer = new Map<string, string[]>();
  for (const link of (links ?? []) as TagLinkRow[]) {
    const raw = link.streamer_tags;
    const tagsArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const slugs = tagsArray
      .map((item) => String(item.slug ?? "").trim().toLowerCase())
      .filter(Boolean);
    if (!tagsByStreamer.has(link.streamer_id)) {
      tagsByStreamer.set(link.streamer_id, []);
    }
    tagsByStreamer.set(link.streamer_id, [...new Set([...(tagsByStreamer.get(link.streamer_id) ?? []), ...slugs])]);
  }

  return {
    streamers: (streamers ?? []) as StreamerRow[],
    tagsByStreamer,
  };
}

function normalizeTagsInput(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

const OPS_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  eventsub_ok: { tone: "success", text: "Subscriptions EventSub registradas com sucesso." },
  eventsub_err: { tone: "error", text: "Falha ao registrar EventSub. Verifique variáveis e logs." },
  sync_ok: { tone: "success", text: "Sincronização de status executada com sucesso." },
  sync_err: { tone: "error", text: "Falha ao sincronizar status agora." },
};

export default async function AdminStreamersPage({
  searchParams,
}: {
  searchParams?: Promise<{ ops?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const opsKey = resolvedSearchParams.ops ?? "";
  const opsMessage = OPS_MESSAGES[opsKey];
  const data = await getStreamersData();

  async function registerEventSubSubscriptions() {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_register_eventsub");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const secret = process.env.STREAMERS_CRON_SECRET?.trim();
    if (!appUrl || !secret) {
      redirect("/admin/streamers?ops=eventsub_err");
    }

    const response = await fetch(`${appUrl}/api/twitch/eventsub/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    redirect(`/admin/streamers?ops=${response.ok ? "eventsub_ok" : "eventsub_err"}`);
  }

  async function runStreamersSyncNow() {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_sync_now");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const secret = process.env.STREAMERS_CRON_SECRET?.trim();
    if (!appUrl || !secret) {
      redirect("/admin/streamers?ops=sync_err");
    }

    const response = await fetch(`${appUrl}/api/cron/streamers-sync`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });

    revalidatePath("/streamers");
    redirect(`/admin/streamers?ops=${response.ok ? "sync_ok" : "sync_err"}`);
  }

  async function addStreamer(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_add");

    const username = String(formData.get("username") ?? "").trim();
    if (!username) return;

    const normalizedUsername = username.toLowerCase();
    const supabase = await createClient();
    await supabase.from("streamers").insert({
      username: normalizedUsername,
      display_name: normalizedUsername,
      platform: "twitch",
      channel_url: `https://twitch.tv/${normalizedUsername}`,
      twitch_login: normalizedUsername,
    });

    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/streamers");
  }

  async function removeStreamer(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_remove");

    const id = String(formData.get("id") ?? "");
    const username = String(formData.get("username") ?? "");
    if (!id || username.toLowerCase() === "hwmalk") return;

    const supabase = await createClient();
    await supabase.from("streamers").delete().eq("id", id);
    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/streamers");
  }

  async function toggleOfficial(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_toggle_official");

    const id = String(formData.get("id") ?? "");
    const isOfficial = formData.get("isOfficial") === "true";
    const username = String(formData.get("username") ?? "");
    if (!id || username.toLowerCase() === "hwmalk") return;

    const supabase = await createClient();
    await supabase.from("streamers").update({ is_official: !isOfficial }).eq("id", id);
    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/streamers");
  }

  async function toggleMultiview(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_toggle_multiview");

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const supabase = await createClient();
    const { data: row } = await supabase
      .from("streamers")
      .select("is_active, selected_for_multiview, active")
      .eq("id", id)
      .maybeSingle();

    const currentValue =
      typeof row?.is_active === "boolean"
        ? row.is_active
        : typeof row?.selected_for_multiview === "boolean"
          ? row.selected_for_multiview
          : typeof row?.active === "boolean"
            ? row.active
            : true;

    const nextValue = !currentValue;
    await supabase
      .from("streamers")
      .update({ is_active: nextValue, selected_for_multiview: nextValue, active: nextValue })
      .eq("id", id);

    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/multiview");
    revalidatePath("/streamers");
  }

  async function saveStreamerDetails(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_update_details");

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
    }).eq("id", id);

    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/streamers");
  }

  async function saveStreamerTags(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_update_tags");

    const id = String(formData.get("id") ?? "");
    const tagsRaw = String(formData.get("tags") ?? "");
    if (!id) return;

    const tags = normalizeTagsInput(tagsRaw);
    const supabase = await createClient();

    if (tags.length === 0) {
      await supabase.from("streamer_tag_links").delete().eq("streamer_id", id);
      revalidatePath("/admin/streamers");
      revalidatePath("/streamers");
      return;
    }

    const tagRows = tags.map((slug) => ({
      slug,
      name: slug === "madnessarena" ? "MadnessArena" : slug,
      is_highlight: slug === "madnessarena",
    }));

    const { data: upserted } = await supabase
      .from("streamer_tags")
      .upsert(tagRows, { onConflict: "slug", ignoreDuplicates: false })
      .select("id, slug");

    const tagIds = (upserted ?? []).map((row) => row.id);
    if (tagIds.length === 0) return;

    await supabase.from("streamer_tag_links").delete().eq("streamer_id", id);
    await supabase.from("streamer_tag_links").insert(
      tagIds.map((tagId) => ({ streamer_id: id, tag_id: tagId })),
    );

    revalidatePath("/admin/streamers");
    revalidatePath("/streamers");
  }

  if (data === null) {
    return (
      <div className="p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Streamers</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Gerencie os streamers da Madness Arena.</p>
        </div>
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
          <p className="font-semibold">A tabela de streamers não foi encontrada no banco de dados.</p>
          <p className="text-sm mt-1">Execute `supabase/supabase_streamers_schema.sql` e `supabase/community_streamers_schema.sql`.</p>
        </div>
      </div>
    );
  }

  const streamers = data.streamers;
  const tagsByStreamer = data.tagsByStreamer;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gerenciar Streamers</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Administre streamers, Twitch IDs e tags da página /streamers.</p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
        A página <span className="font-semibold">/streamers</span> inclui somente quem tiver a tag <span className="font-semibold">madnessarena</span>.
      </div>

      {opsMessage ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            opsMessage.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {opsMessage.text}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={registerEventSubSubscriptions}>
          <Button type="submit" variant="ghost">Registrar EventSub</Button>
        </form>
        <form action={runStreamersSyncNow}>
          <Button type="submit" variant="primary">Sincronizar status agora</Button>
        </form>
      </div>

      <div className="mt-8 max-w-2xl bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Adicionar novo streamer</h3>
        <form action={addStreamer} className="flex gap-2">
          <input
            name="username"
            placeholder="Username da Twitch (ex: hwmalk)"
            required
            className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm"
          />
          <Button type="submit" variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </form>
      </div>

      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-semibold">Streamers cadastrados ({streamers.length})</h3>

        {streamers.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">Nenhum streamer cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {streamers.map((s) => {
              const isOrganizer = s.username.toLowerCase() === "hwmalk";
              const isMultiviewEnabled = s.is_active ?? s.selected_for_multiview ?? true;
              const tagsValue = (tagsByStreamer.get(s.id) ?? []).join(", ");

              return (
                <article key={s.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{s.display_name || s.username}</span>
                    <span className="text-xs text-slate-500">@{s.username}</span>
                    {isOrganizer ? (
                      <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                        <Star className="h-3 w-3" fill="currentColor" /> Organizador
                      </span>
                    ) : null}
                    {s.is_official ? (
                      <span className="flex items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
                        <Star className="h-3 w-3" fill="currentColor" /> Oficial
                      </span>
                    ) : null}
                    {isMultiviewEnabled ? (
                      <span className="flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                        <MonitorUp className="h-3 w-3" /> Multiview
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <form action={saveStreamerDetails} className="space-y-2 rounded-xl border border-slate-200 dark:border-white/10 p-3">
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
                      <label className="block text-xs text-slate-500">Twitch ID (EventSub)</label>
                      <input name="twitch_id" defaultValue={s.twitch_id ?? ""} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                      <label className="block text-xs text-slate-500">Twitch login</label>
                      <input name="twitch_login" defaultValue={s.twitch_login ?? s.username} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm" />
                      <label className="mt-1 inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" name="is_featured" defaultChecked={Boolean(s.is_featured)} />
                        Destacar na página /streamers
                      </label>
                      <Button type="submit" variant="primary">
                        <Save className="h-4 w-4 mr-2" />
                        Salvar dados
                      </Button>
                    </form>

                    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 p-3">
                      <form action={saveStreamerTags} className="space-y-2">
                        <input type="hidden" name="id" value={s.id} />
                        <label className="block text-xs text-slate-500">Tags (separadas por vírgula)</label>
                        <input
                          name="tags"
                          defaultValue={tagsValue}
                          placeholder="madnessarena, caster, comunidade br"
                          className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm"
                        />
                        <Button type="submit" variant="primary">
                          <Save className="h-4 w-4 mr-2" />
                          Salvar tags
                        </Button>
                      </form>

                      <div className="flex items-center gap-2 pt-2">
                        <form action={toggleOfficial}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="username" value={s.username} />
                          <input type="hidden" name="isOfficial" value={String(s.is_official)} />
                          <Button type="submit" variant="ghost" disabled={isOrganizer} className="h-10 w-10 rounded-xl p-0">
                            <Star className={`h-4 w-4 ${s.is_official ? "text-yellow-400" : "text-slate-500"}`} />
                          </Button>
                        </form>

                        <form action={toggleMultiview}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button type="submit" variant="ghost" className={`h-10 w-10 rounded-xl p-0 ${isMultiviewEnabled ? "text-cyan-300" : "text-slate-400"}`}>
                            <MonitorUp className="h-4 w-4" />
                          </Button>
                        </form>

                        <form action={removeStreamer} className="ml-auto">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="username" value={s.username} />
                          <Button
                            type="submit"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl border border-red-500/30 p-0 text-red-400 hover:bg-red-400/10 hover:text-red-300"
                            disabled={isOrganizer}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

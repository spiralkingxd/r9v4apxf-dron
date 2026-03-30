import Link from "next/link";
import { Plus, Trash2, ShieldAlert, Star, MonitorUp } from "lucide-react";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertAdminAccess, enforceAdminRateLimit } from "@/app/admin/_lib";
import { AdminButton as Button } from "@/components/admin/admin-button";

export const metadata = {
  title: "Admin - Streamers",
};

async function getStreamers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("streamers")
    .select("*")
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return null;
    console.error("Error fetching streamers:", error);
    return [];
  }
  return data;
}

export default async function AdminStreamersPage() {
  const streamers = await getStreamers();

  async function addStreamer(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_add");

    const username = String(formData.get("username") ?? "").trim();
    if (!username) return;

    const cleanUsername = username.toLowerCase();
    const supabase = await createClient();
    const basePayload = {
      username: cleanUsername,
      display_name: cleanUsername,
      platform: "twitch",
      channel_url: `https://twitch.tv/${cleanUsername}`,
      twitch_login: cleanUsername,
    };

    const attempts: Array<Record<string, unknown>> = [
      basePayload,
      { username: cleanUsername },
    ];

    for (const payload of attempts) {
      const { error } = await supabase.from("streamers").insert(payload);
      if (!error) break;
      if (error.code !== "42703" && error.code !== "23502") {
        console.error("[admin/streamers] add insert failed", error);
        break;
      }
    }

    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/multiview");
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
    revalidatePath("/multiview");
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
  }

  async function toggleMultiview(formData: FormData) {
    "use server";
    const { supabase: accessSupabase, adminId } = await assertAdminAccess();
    await enforceAdminRateLimit(accessSupabase, adminId, "streamers_toggle_multiview");

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const supabase = await createClient();
    const { data: currentRow } = await supabase
      .from("streamers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const currentValue =
      typeof currentRow?.is_active === "boolean"
        ? currentRow.is_active
        : typeof currentRow?.selected_for_multiview === "boolean"
          ? currentRow.selected_for_multiview
          : typeof currentRow?.active === "boolean"
            ? currentRow.active
            : true;

    const nextValue = !currentValue;
    await supabase
      .from("streamers")
      .update({ is_active: nextValue, selected_for_multiview: nextValue, active: nextValue })
      .eq("id", id);

    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/multiview");
  }

  if (streamers === null) {
    return (
      <div className="p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Streamers</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Gerencie os streamers da Madness Arena.</p>
        </div>
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
          <p className="font-semibold">A tabela de streamers não foi encontrada no banco de dados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gerenciar Streamers (Multiview/Transmissões)</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Esta tela controla apenas /transmissoes e /multiview.</p>
      </div>

      <div className="mb-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
        Streamers da comunidade agora ficam em uma aba separada:{" "}
        <Link href="/admin/community-streamers" className="font-bold underline">
          /admin/community-streamers
        </Link>
      </div>

      <div className="mt-8 max-w-2xl bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Adicionar Novo Streamer</h3>
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

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Streamers Cadastrados ({streamers.length})</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {streamers.map((s) => {
            const isOrganizer = s.username.toLowerCase() === "hwmalk";
            const isMultiviewEnabled = s.is_active ?? s.selected_for_multiview ?? true;
            return (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white/5 p-4 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{s.username}</span>
                  {s.is_official ? <span className="text-[10px] uppercase text-yellow-400">oficial</span> : null}
                  {isMultiviewEnabled ? <span className="text-[10px] uppercase text-cyan-300">multiview</span> : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
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
                    <Button type="submit" variant="ghost" disabled={isOrganizer} className="h-10 w-10 rounded-xl border border-red-500/30 p-0 text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

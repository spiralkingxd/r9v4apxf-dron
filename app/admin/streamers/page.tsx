
import { Suspense } from "react";
import { Loader2, Plus, Trash2, ShieldAlert, Star, MonitorUp } from "lucide-react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    if (error.code === "42P01") {
      // Table does not exist
      return null;
    }
    console.error("Error fetching streamers:", error);
    return [];
  }
  return data;
}

export default async function AdminStreamersPage() {
  const streamers = await getStreamers();

  async function addStreamer(formData: FormData) {
    "use server";
    const username = formData.get("username")?.toString();
    if (!username) return;

    // Remove espacos e transforma em lowercase se necessario, mas twitch suporta
    const cleanUsername = username.trim();

    const supabase = await createClient();
    await supabase.from("streamers").insert({ username: cleanUsername });
    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
  }

  async function removeStreamer(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString();
    const username = formData.get("username")?.toString();
    if (!id || username?.toLowerCase() === "hwmalk") return; // Nao pode remover o HWmalk

    const supabase = await createClient();
    await supabase.from("streamers").delete().eq("id", id);
    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
  }

  async function toggleOfficial(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString();
    const isOfficial = formData.get("isOfficial") === "true";
    const username = formData.get("username")?.toString();
    if (!id || username?.toLowerCase() === "hwmalk") return; // HWmalk is always official

    const supabase = await createClient();
    await supabase.from("streamers").update({ is_official: !isOfficial }).eq("id", id);
    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
  }

  async function toggleMultiview(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString();
    const isActive = formData.get("isActive") === "true";
    if (!id) return;

    const supabase = await createClient();

    const primary = await supabase.from("streamers").update({ is_active: !isActive }).eq("id", id);
    if (primary.error && primary.error.code === "42703") {
      await supabase.from("streamers").update({ selected_for_multiview: !isActive }).eq("id", id);
    }

    revalidatePath("/admin/streamers");
    revalidatePath("/transmissoes");
    revalidatePath("/multiview");
  }

  if (streamers === null) {
    return (
      <div className="p-6">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Streamers</h1><p className="text-slate-500 dark:text-slate-400 mt-2">Gerencie os streamers da Madness Arena.</p></div>
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
          <p className="font-semibold">A tabela de streamers nÝo foi encontrada no banco de dados.</p>
          <p className="text-sm mt-1">Por favor, execute o script SQL `supabase_streamers_schema.sql` no painel do Supabase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8"><h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gerenciar Streamers</h1><p className="text-slate-500 dark:text-slate-400 mt-2">Adicione e remova pessoas da pagina de transmissoes.</p></div> 

      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
        O toggle <span className="font-semibold">Multiview</span> define quem aparece na página <span className="font-semibold">/multiview</span>.
      </div>




      <div className="mt-8 max-w-2xl bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Adicionar Novo Streamer</h3>
        <form action={addStreamer} className="flex gap-2">
          <input 
            name="username" 
            placeholder="Username da Twitch (ex: hwmalk)" 
            required
            className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus-within:border-cyan-500/50" />

          <Button type="submit" variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Streamers Cadastrados ({streamers.length})</h3>
        
        {streamers.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400">Nenhum streamer cadastrado.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {streamers.map((s) => {
              const isOrganizer = s.username.toLowerCase() === "hwmalk";
              const isMultiviewEnabled = s.is_active ?? s.selected_for_multiview ?? true;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white/5 p-4 shadow-sm transition hover:border-cyan-400/30 dark:border-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-bold text-slate-900 dark:text-white">{s.username}</span>

                        {isOrganizer ? (
                          <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                            <Star className="h-3 w-3" fill="currentColor" /> Organizador
                          </span>
                        ) : null}

                        {s.is_official && !isOrganizer ? (
                          <span className="flex items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
                            <Star className="h-3 w-3" fill="currentColor" /> Oficial
                          </span>
                        ) : null}

                        {isMultiviewEnabled ? (
                          <span className="flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                            <MonitorUp className="h-3 w-3" /> Multiview
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-400/30 bg-slate-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400">
                            Oculto na Multiview
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Adicionado em: {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <form action={toggleOfficial}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="username" value={s.username} />
                      <input type="hidden" name="isOfficial" value={s.is_official.toString()} />
                      <Button
                        type="submit"
                        variant="ghost"
                        disabled={isOrganizer}
                        title={s.is_official ? "Remover cargo oficial" : "Tornar oficial"}
                        className="h-10 w-10 rounded-xl p-0"
                      >
                        <Star className={`h-4 w-4 ${s.is_official ? "text-yellow-400" : "text-slate-500"}`} />
                      </Button>
                    </form>

                    <form action={toggleMultiview}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="isActive" value={String(isMultiviewEnabled)} />
                      <Button
                        type="submit"
                        variant="ghost"
                        title={isMultiviewEnabled ? "Ocultar da Multiview" : "Mostrar na Multiview"}
                        className={`h-10 w-10 rounded-xl p-0 ${isMultiviewEnabled ? "text-cyan-300 hover:bg-cyan-400/10" : "text-slate-400"}`}
                      >
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
                        title={isOrganizer ? "Organizador não pode ser removido" : "Remover streamer"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

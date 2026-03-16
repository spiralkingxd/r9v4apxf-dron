
import { Suspense } from "react";
import { Loader2, Plus, Trash2, ShieldAlert, Star } from "lucide-react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { AdminButton as Button } from "@/components/admin/admin-button";


export const metadata = {
  title: "Streamers | Admin | Madness Arena",
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

  if (streamers === null) {
    return (
      <div className="p-6">
        <div><h1 className="text-3xl font-bold text-white tracking-tight">Streamers</h1><p className="text-slate-400 mt-2">Gerencie os streamers da Madness Arena.</p></div>
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
          <ShieldAlert className="mx-auto h-8 w-8 mb-2" />
          <p className="font-semibold">A tabela de streamers nÃo foi encontrada no banco de dados.</p>
          <p className="text-sm mt-1">Por favor, execute o script SQL `supabase_streamers_schema.sql` no painel do Supabase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-8"><h1 className="text-3xl font-bold text-white tracking-tight">Gerenciar Streamers</h1><p className="text-slate-400 mt-2">Adicione e remova pessoas da pagina de transmissoes.</p></div> 




      <div className="mt-8 max-w-2xl bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Adicionar Novo Streamer</h3>
        <form action={addStreamer} className="flex gap-2">
          <input 
            name="username" 
            placeholder="Username da Twitch (ex: hwmalk)" 
            required
            className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 focus-within:border-cyan-500/50" />

          <Button type="submit" variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Streamers Cadastrados ({streamers.length})</h3>
        
        {streamers.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-slate-400">Nenhum streamer cadastrado.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streamers.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.username}</span>
                    {s.is_official && (
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                        <Star className="h-3 w-3" fill="currentColor" /> Oficial
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">Adicionado em: {new Date(s.created_at).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <form action={toggleOfficial}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="username" value={s.username} />
                    <input type="hidden" name="isOfficial" value={s.is_official.toString()} />
                    <Button 
                      type="submit" 
                      variant="ghost" 

                      disabled={s.username.toLowerCase() === "hwmalk"}
                      title={s.is_official ? "Remover cargo oficial" : "Tornar oficial"}
                    >
                      <Star className={`h-4 w-4 ${s.is_official ? "text-yellow-400" : "text-slate-500"}`} />
                    </Button>
                  </form>

                  <form action={removeStreamer}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="username" value={s.username} />
                    <Button 
                      type="submit" 
                      variant="ghost" 

                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      disabled={s.username.toLowerCase() === "hwmalk"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

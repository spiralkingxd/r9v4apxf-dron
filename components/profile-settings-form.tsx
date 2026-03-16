"use client";

import { useActionState, useState } from "react";
import { updateProfileFeatures, syncDiscordAvatarAction } from "@/app/actions/profile-actions";
import { RefreshCcw, Settings, X, CheckCircle2 } from "lucide-react";

export function ProfileSettingsForm({ 
  initialStatus, 
  initialRole 
}: { 
  initialStatus: string | null; 
  initialRole: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProfileFeatures, null);
  const [syncState, syncAction, isSyncing] = useActionState(syncDiscordAvatarAction, null);

  const inputClass = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 transition-colors";

  return (
    <div className="flex justify-center pb-8 transition-all">
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/80 px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-sm"
      >
        <Settings className="h-4 w-4" />
        Configurar Perfil
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-left">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configurações do Perfil</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Personalize como você aparece para outros piratas</p>
            </div>

            <div className="space-y-6 text-left">
              {/* Sync Photo Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <div>
                  <span className="block text-sm font-medium text-slate-900 dark:text-slate-200">Foto de Perfil</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Usar mesma foto do Discord</span>
                </div>
                <form action={syncAction} className="w-full sm:w-auto">
                  <button 
                    type="submit"
                    disabled={isSyncing}
                    className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  >
                    <RefreshCcw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar"}
                  </button>
                </form>
              </div>
              
              {syncState?.error && <p className="text-xs text-rose-500 -mt-2">{syncState.error}</p>}
              {syncState?.success && <p className="text-xs text-emerald-500 -mt-2">{syncState.success}</p>}

              {/* Profile Edit Section */}
              <form action={formAction} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="avatar_file" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Fazer Upload de Foto (Opcional)
                  </label>
                  <input 
                    type="file"
                    id="avatar_file" 
                    name="avatar_file" 
                    accept="image/*"
                    className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-cyan-900/30 dark:file:text-cyan-400 dark:hover:file:bg-cyan-900/50 cursor-pointer border border-slate-200 dark:border-slate-800 rounded-md p-1"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom_status" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Status Customizado
                  </label>
                  <input 
                    id="custom_status" 
                    name="custom_status" 
                    placeholder="Ex: Jogando arena..." 
                    defaultValue={initialStatus || ""} 
                    maxLength={50}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="boat_role" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Função no Barco <span className="text-xs text-slate-500 font-normal ml-1">(Sea of Thieves)</span>
                  </label>
                  <select 
                    id="boat_role"
                    name="boat_role" 
                    defaultValue={initialRole || "nenhuma"}
                    className={inputClass}
                  >
                    <option value="nenhuma" className="bg-slate-900 text-white">Não especificado</option>
                    <option value="timao" className="bg-slate-900 text-white">Timão (Helm)</option>
                    <option value="reparo" className="bg-slate-900 text-white">Reparo (Bilge)</option>
                    <option value="suporte" className="bg-slate-900 text-white">Suporte (Flex)</option>
                    <option value="canhoneiro" className="bg-slate-900 text-white">Canhoneiro (Cannoneer)</option>
                  </select>
                </div>

                {state?.error && (
                  <div className="rounded-md bg-rose-500/10 p-3 flex items-center gap-2 text-rose-500 text-sm">
                    <X className="h-4 w-4 shrink-0" />
                    <p>{state.error}</p>
                  </div>
                )}
                {state?.success && (
                  <div className="rounded-md bg-emerald-500/10 p-3 flex items-center gap-2 text-emerald-500 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <p>{state.success}</p>
                  </div>
                )}

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isPending}
                    className="w-full rounded-md bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-all"
                  >
                    {isPending ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

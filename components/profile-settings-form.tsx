"use client";

import { useActionState } from "react";
import { updateProfileFeatures, syncDiscordAvatarAction } from "@/app/actions/profile-actions";
import { RefreshCcw } from "lucide-react";

export function ProfileSettingsForm({ 
  initialStatus, 
  initialRole 
}: { 
  initialStatus: string | null; 
  initialRole: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileFeatures, null);
  const [syncState, syncAction, isSyncing] = useActionState(syncDiscordAvatarAction, null);

  const inputClass = "w-full rounded-md border border-slate-300 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 transition-colors";
  
  return (
    <div className="mt-8 space-y-6 px-8 pb-8 transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 border-slate-200 dark:border-white/10 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Configurações do Perfil</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Personalize como você aparece para outros piratas</p>
        </div>
        
        <form action={syncAction} className="flex gap-4 items-center">
          <button 
            type="submit"
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-md bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50 border border-slate-200 dark:border-white/10 whitespace-nowrap"
          >
            <RefreshCcw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Foto do Discord"}
          </button>
        </form>
      </div>
      
      <div className="flex flex-col gap-4">
        {syncState?.error && <span className="text-sm text-rose-500 bg-rose-500/10 p-2 rounded max-w-md">{syncState.error}</span>}
        {syncState?.success && <span className="text-sm text-emerald-500 bg-emerald-500/10 p-2 rounded max-w-md">{syncState.success}</span>}

        <form action={formAction} className="space-y-5 max-w-md w-full border border-slate-200 dark:border-white/10 p-5 rounded-xl bg-slate-50/50 dark:bg-slate-800/20">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <label htmlFor="boat_role" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Sua Função no Barco (Sea of Thieves)
            </label>
            <select 
              id="boat_role"
              name="boat_role" 
              defaultValue={initialRole || "nenhuma"}
              className={inputClass}
            >
              <option value="nenhuma" className="bg-slate-800 text-white">Não especificado</option>
              <option value="timao" className="bg-slate-800 text-white">Timão (Helm)</option>
              <option value="reparo" className="bg-slate-800 text-white">Reparo (Bilge)</option>
              <option value="suporte" className="bg-slate-800 text-white">Suporte (Flex)</option>
              <option value="canhoneiro" className="bg-slate-800 text-white">Canhoneiro (Cannoneer)</option>
            </select>
          </div>

          {state?.error && <p className="text-sm text-rose-500 bg-rose-500/10 p-2 rounded">{state.error}</p>}
          {state?.success && <p className="text-sm text-emerald-500 bg-emerald-500/10 p-2 rounded">{state.success}</p>}

          <button 
            type="submit" 
            disabled={isPending}
            className="w-full rounded-md bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-all font-semibold"
          >
            {isPending ? "Salvando..." : "Salvar Configurações de Perfil"}
          </button>
        </form>
      </div>
    </div>
  );
}

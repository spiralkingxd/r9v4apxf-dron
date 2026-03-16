"use client";

import { useActionState, useState, useCallback } from "react";
import { updateProfileFeatures, syncDiscordAvatarAction } from "@/app/actions/profile-actions";
import { RefreshCcw, Settings, X, CheckCircle2, ImagePlus } from "lucide-react";
import Cropper, { Area } from "react-easy-crop";
import { getCroppedImg } from "@/lib/crop-image";
import Image from "next/image";

export function ProfileSettingsForm({
  initialStatus,
  initialRole,
  initialXboxGamertag
}: {
  initialStatus: string | null;
  initialRole: string | null;
  initialXboxGamertag: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Cropper states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedBase64, setCroppedBase64] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(updateProfileFeatures, null);
  const [syncState, syncAction, isSyncing] = useActionState(syncDiscordAvatarAction, null);

  const inputClass = "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 transition-colors";

  // Handle file select
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = URL.createObjectURL(file);
      setImageSrc(imageDataUrl);
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      setCroppedBase64(croppedImage);
      setImageSrc(null); // Close cropper view
    } catch (e) {
      console.error(e);
    }
  }, [imageSrc, croppedAreaPixels]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          
          {/* Main Modal */}
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
              
              {/* Sync Discord Photo */}
              <div className="flex flex-col gap-2">
                <form action={syncAction} className="flex justify-end">
                  <button 
                    type="submit"
                    disabled={isSyncing}
                    className="w-full inline-flex justify-center items-center gap-2 rounded-md bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                  >
                    <RefreshCcw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Sincronizando..." : "Usar foto do Discord"}
                  </button>
                </form>
                {syncState?.error && <p className="text-xs text-rose-500">{syncState.error}</p>}
                {syncState?.success && <p className="text-xs text-emerald-500">{syncState.success}</p>}
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase">OU UPLOAD MANUAL</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              {/* Profile Edit Section */}
              <form action={formAction} className="space-y-5">
                
                {/* Upload Imagem CROP */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Sua nova foto (opcional)
                  </label>
                  
                  {croppedBase64 ? (
                    <div className="flex items-center gap-4">
                       <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-cyan-500">
                         <Image src={croppedBase64} alt="Cropped preview" fill className="object-cover" />
                       </div>
                       <button
                         type="button"
                         onClick={() => setCroppedBase64(null)}
                         className="text-xs text-rose-500 font-medium hover:underline"
                       >
                         Remover
                       </button>
                    </div>
                  ) : (
                    <div>
                      <input 
                        type="file"
                        id="avatar_overlay" 
                        accept="image/*"
                        onChange={onFileChange}
                        className="hidden"
                      />
                      <label 
                        htmlFor="avatar_overlay"
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-8 text-sm text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ImagePlus className="h-5 w-5 text-slate-400" />
                        <span>Clique para escolher uma imagem...</span>
                      </label>
                    </div>
                  )}
                  {/* HIDDEN INPUT FOR BASE64 */}
                  <input type="hidden" name="avatar_base64" value={croppedBase64 || ""} />
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

      {/* CROP OVERLAY (Shows when user picks an image) */}
      {imageSrc && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-md h-[400px] sm:h-[500px] bg-black">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => setImageSrc(null)}
              className="px-6 py-2 rounded-full border border-slate-700 bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={showCroppedImage}
              className="px-6 py-2 rounded-full bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-400"
            >
              Recortar Foto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


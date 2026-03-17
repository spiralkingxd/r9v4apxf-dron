import { Loader2, ShipWheel } from "lucide-react";
import { getLocale } from "@/lib/i18n";

export default async function MyTeamLoading() {
  const locale = await getLocale();

  return (
    <main className="min-h-[70vh] bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] text-slate-100">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
            <ShipWheel className="h-7 w-7 text-cyan-200" />
          </div>

          <h1 className="text-xl font-bold text-white">{locale === "en" ? "Opening your team" : "Abrindo sua equipe"}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {locale === "en"
              ? "We are preparing your page. This only takes a few seconds..."
              : "Estamos preparando sua página. Isso leva só alguns segundos..."}
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 text-cyan-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">{locale === "en" ? "Loading" : "Carregando"}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

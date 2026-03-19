import Link from "next/link";
import { AlertTriangle, Clock3, ShieldBan } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" });

type SearchParams = Promise<{
  reason?: string;
  expires_at?: string;
  type?: "ban" | "suspension";
}>;

export default async function AccountBannedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reason = params.reason ?? "Conta banida pela administração.";
  const expiresAt = params.expires_at;
  const type = params.type === "suspension" ? "suspension" : "ban";

  const title = type === "suspension" ? "Conta Temporariamente Suspensa" : "Conta Banida";
  const subtitle =
    type === "suspension"
      ? "Seu acesso foi suspenso temporariamente. Aguarde o prazo expirar ou contate a administração."
      : "Seu acesso foi bloqueado por decisão administrativa.";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-6 py-16">
      <section className="rounded-2xl border border-rose-300/35 bg-gradient-to-b from-rose-100/90 to-white p-8 text-slate-900 shadow-xl dark:border-rose-400/30 dark:from-rose-950/30 dark:to-slate-950/70 dark:text-slate-100">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
          <ShieldBan className="h-4 w-4" />
          Acesso Restrito
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{subtitle}</p>

        <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-black/20">
          <p className="text-sm">
            <strong>Motivo:</strong> {reason}
          </p>
          <p className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Clock3 className="h-4 w-4" />
            {expiresAt ? `Expira em: ${dateFmt.format(new Date(expiresAt))}` : "Bloqueio permanente"}
          </p>
        </div>

        <div className="mt-4 inline-flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-100/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Em caso de recurso, entre em contato com a staff no Discord oficial com seu ID de usuário.</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          >
            Voltar para Início
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Tentar novo login
          </Link>
        </div>
      </section>
    </main>
  );
}


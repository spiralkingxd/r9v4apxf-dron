import Link from "next/link";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" });

type SearchParams = Promise<{
  reason?: string;
  expires_at?: string;
}>;

export default async function AccountBannedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reason = params.reason ?? "Conta banida pela administração.";
  const expiresAt = params.expires_at;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-6 py-16">
      <section className="rounded-2xl border border-rose-400/30 bg-rose-950/20 p-8 text-slate-100">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Acesso Restrito</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Conta Banida</h1>
        <p className="mt-4 text-sm text-slate-200">{reason}</p>
        <p className="mt-2 text-xs text-slate-300">
          {expiresAt ? `Expira em: ${dateFmt.format(new Date(expiresAt))}` : "Banimento permanente"}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Voltar para Início
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Tentar novo login
          </Link>
        </div>
      </section>
    </main>
  );
}

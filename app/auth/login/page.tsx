import Link from "next/link";

import { loginWithDiscord } from "@/app/auth/login/actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSearchParamValue(params.next, "/");
  const reason = getSearchParamValue(params.reason);
  const error = getSearchParamValue(params.error);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] px-6 py-12 text-slate-100">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/50 p-8 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Autenticação</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Entrar com Discord</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          O login utiliza Supabase Auth com provider Discord e sincroniza automaticamente perfil e conexão Xbox.
        </p>

        {reason === "supabase_not_configured" ? (
          <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            Configure suas variáveis de ambiente do Supabase antes de autenticar.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            Falha no login: {error}
          </p>
        ) : null}

        <form action={loginWithDiscord} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Login com Discord
          </button>
        </form>

        <Link href="/" className="mt-4 inline-flex text-sm text-cyan-200 hover:text-cyan-100">
          Voltar para a home
        </Link>
      </section>
    </main>
  );
}
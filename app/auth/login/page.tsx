import Link from "next/link";
import { loginWithDiscord } from "@/app/auth/login/actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSearchParamValue(params.next, "/");
  const reason = getSearchParamValue(params.reason);
  const error = getSearchParamValue(params.error);

  return (
    <main className={"min-h-[calc(100vh-72px)] bg-slate-50 dark:bg-[radial-gradient(circle_at_top,_#13293d_0%,_#0b1826_40%,_#050b12_100%)] px-6 py-12 text-slate-800 dark:text-slate-100"}>
      <section className={"mx-auto w-full max-w-xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/50 p-8 shadow-xl dark:shadow-2xl shadow-black/5 dark:shadow-black/30"}>
        <p className={"text-xs uppercase tracking-[0.2em] font-semibold text-cyan-600 dark:text-cyan-200/80"}>Autenticação</p>
        <h1 className={"mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white"}>Entrar com Discord</h1>
        <p className={"mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300"}>
          Conecte sua conta do Discord para acessar a plataforma, participar de torneios e sincronizar automaticamente seu perfil Xbox.
        </p>

        {reason === "supabase_not_configured" ? (
          <p className={"mt-4 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-300/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100"}>
            Configure suas variáveis de ambiente do Supabase antes de autenticar.
          </p>
        ) : null}

        {error ? (
          <p className={"mt-4 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-300/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-100"}>
            Falha no login: {error}
          </p>
        ) : null}

        <form action={loginWithDiscord} className={"mt-8 space-y-4"}>
          <input type={"hidden"} name={"next"} value={next} />
          <button
            type={"submit"}
            className={"inline-flex w-full items-center justify-center rounded-xl bg-[#5865F2] hover:bg-[#4752C4] px-5 py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-50"}
          >
            Conectar com Discord
          </button>
        </form>

        <Link href={"/"} className={"mt-6 inline-flex font-medium text-sm text-cyan-600 dark:text-cyan-200 transition hover:text-cyan-500 dark:hover:text-cyan-100"}>
           Voltar para a home
        </Link>
      </section>
    </main>
  );
}

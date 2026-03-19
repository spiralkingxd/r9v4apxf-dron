import { Book } from "lucide-react";

import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { getDictionary, getLocale } from "@/lib/i18n";
import { translatePtToEnOnTheFly } from "@/lib/i18n/runtime-translate";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Regras",
  description: "Conheça as regras dos campeonatos da Madness Arena",
};

type RuleItem = {
  id: string;
  order: number;
  title: string;
  content: string;
};

const FALLBACK_RULES: RuleItem[] = [
  {
    id: "fallback-1",
    order: 1,
    title: "Conduta e Fair Play",
    content:
      "Todos os participantes devem manter o respeito. Comportamento tóxico, racismo ou qualquer tipo de discriminação resultará em banimento imediato e permanente.",
  },
  {
    id: "fallback-2",
    order: 2,
    title: "Inscrições e Equipes",
    content:
      "Capitães são responsáveis por inscrever sua equipe nos eventos. Verifique o tamanho exigido da equipe para cada campeonato (Sloop, Brigantine ou Galleon).",
  },
  {
    id: "fallback-3",
    order: 3,
    title: "Horários",
    content:
      "Tolerância máxima de 10 minutos de atraso para check-in. Caso a equipe não esteja pronta, perderá a partida por W.O.",
  },
  {
    id: "fallback-4",
    order: 4,
    title: "Gravação e Provas",
    content:
      "É obrigatório que pelo menos um jogador de cada tripulação grave a partida, ou transmita na Twitch, para validação de resultados em caso de disputa.",
  },
];

const FALLBACK_FOOTER =
  "Estas regras estão sujeitas a atualizações antes do início de cada temporada. Mantenha-se informado através do nosso Discord.";

export default async function RegrasPage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: rulesRaw }, { data: settingsRaw }] = await Promise.all([
    supabase.from("rules_content").select("id, order, title, content").order("order", { ascending: true }),
    supabase.from("system_settings").select("general_rules").eq("id", 1).maybeSingle<{ general_rules: string | null }>(),
  ]);

  const rules: RuleItem[] =
    (rulesRaw ?? []).map((row) => ({
      id: String(row.id),
      order: Number(row.order ?? 0),
      title: String(row.title ?? ""),
      content: String(row.content ?? ""),
    })) ?? [];

  const orderedRules = rules.length > 0 ? rules : FALLBACK_RULES;
  const footer = settingsRaw?.general_rules?.trim() || FALLBACK_FOOTER;

  const localizedRules =
    locale === "en"
      ? await Promise.all(
          orderedRules.map(async (rule) => ({
            ...rule,
            title: await translatePtToEnOnTheFly(rule.title),
            content: await translatePtToEnOnTheFly(rule.content),
          })),
        )
      : orderedRules;

  const localizedFooter = locale === "en" ? await translatePtToEnOnTheFly(footer) : footer;
  const singleDocument = orderedRules.length === 1 && orderedRules[0]?.title.trim().toLowerCase() === "regras";

  return (
    <main className="page-shell px-3 py-10 sm:px-4 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300/80">{dict.rules.badge}</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-white">
            <Book className="h-8 w-8 text-amber-600 dark:text-amber-500" />
            {dict.rules.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{dict.rules.desc}</p>
          {locale === "en" && <p className="mt-2 text-xs text-cyan-700 dark:text-cyan-300/80">{dict.rules.runtimeTranslationInfo}</p>}
        </div>

        <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm md:p-8">
          <div className="space-y-6">
          {singleDocument ? (
            <MarkdownRenderer className="text-sm text-slate-700 dark:text-slate-300" content={localizedRules[0].content} />
          ) : (
            <div className="space-y-6">
              {localizedRules.map((rule, index) => (
                <article key={rule.id}>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{index + 1}. {rule.title}</h3>
                  <MarkdownRenderer className="mt-3 text-sm text-slate-700 dark:text-slate-300" content={rule.content} />
                </article>
              ))}
            </div>
          )}

            <hr className="border-slate-200 dark:border-white/10" />
            <MarkdownRenderer className="text-sm text-slate-600 dark:text-slate-400" content={localizedFooter} />
          </div>
        </section>
      </div>
    </main>
  );
}

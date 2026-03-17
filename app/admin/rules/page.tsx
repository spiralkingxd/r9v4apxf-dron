import { BookText } from "lucide-react";

import { RulesAdminPanel } from "@/components/admin/rules-admin-panel";
import { createClient } from "@/lib/supabase/server";

type RuleRow = {
  id: string;
  order: number;
  title: string;
  content: string;
};

export default async function AdminRulesPage() {
  const supabase = await createClient();

  const [{ data: rulesRaw }, { data: settingsRaw }] = await Promise.all([
    supabase.from("rules_content").select("id, order, title, content").order("order", { ascending: true }),
    supabase.from("system_settings").select("general_rules").eq("id", 1).maybeSingle<{ general_rules: string | null }>(),
  ]);

  const rules: RuleRow[] = (rulesRaw ?? []).map((row) => ({
    id: String(row.id),
    order: Number(row.order ?? 0),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
  }));

  const fallbackRules: RuleRow[] = [
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

  const initialRules = rules.length > 0 ? rules : fallbackRules;

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border admin-surface p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Admin</p>
        <div className="mt-2 flex items-center gap-3">
          <BookText className="h-6 w-6 text-[color:var(--accent-cyan)]" />
          <h1 className="text-2xl font-bold text-[color:var(--text-strong)]">Editor de Regras</h1>
        </div>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Edite e publique um único documento Markdown para a página pública de Regras e Conduta.
        </p>
      </header>

      <RulesAdminPanel
        initialRules={initialRules}
        initialFooter={String(settingsRaw?.general_rules ?? "")}
      />
    </section>
  );
}

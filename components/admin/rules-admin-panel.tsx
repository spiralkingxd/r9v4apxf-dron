"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";

import { saveRulesContent } from "@/app/admin/rules-actions";
import { AdminButton } from "@/components/admin/admin-button";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { useAdminToast } from "@/components/admin/admin-toast";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type Props = {
  initialRules: Array<{ id: string; order: number; title: string; content: string }>;
  initialFooter: string;
};

const SINGLE_RULE_TITLE = "Regras";

function serializeRules(rules: Array<{ title: string; content: string }>) {
  return rules
    .map((rule) => {
      const title = rule.title.trim();
      const content = rule.content.trim();

      if (!title && !content) {
        return "";
      }

      if (!title) {
        return content;
      }

      if (!content) {
        return `## ${title}`;
      }

      return `## ${title}\n\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n")
    .trim();
}

export function RulesAdminPanel({ initialRules, initialFooter }: Props) {
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  const initialDocument = useMemo(
    () =>
      serializeRules(
        initialRules
          .sort((a, b) => a.order - b.order)
          .map((item) => ({ title: item.title, content: item.content })),
      ),
    [initialRules],
  );

  const [rulesDocument, setRulesDocument] = useState(initialDocument);
  const [footer, setFooter] = useState(initialFooter);

  function submit() {
    startTransition(async () => {
      const content = rulesDocument.trim();

      if (!content) {
        pushToast("error", "Adicione o conteúdo das regras antes de salvar.");
        return;
      }

      const result = await saveRulesContent({
        rules: [
          {
            title: SINGLE_RULE_TITLE,
            content,
          },
        ],
        footer,
      });
      pushToast(result.error ? "error" : "success", result.error ?? result.success ?? "Atualização concluída.");
    });
  }

  return (
    <section className="admin-surface rounded-2xl border p-5 md:p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Editor</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Edite um único documento Markdown para todas as regras públicas.
          </p>
        </div>
        <div className="text-xs font-medium text-[color:var(--text-muted)]">
          {rulesDocument.trim().length.toLocaleString("pt-BR")} caracteres
        </div>
      </div>

      <MarkdownEditor
        label="Regras em Markdown"
        value={rulesDocument}
        onChange={setRulesDocument}
        minHeight={640}
        placeholder="## Conduta e Fair Play\n\nDescreva aqui as regras completas em Markdown..."
        helperText="Uma única área de edição com preview automático. Use headings, listas, checkboxes, links, tabelas e blocos de código quando precisar."
        previewLabel="Preview automático"
      />

      <div className="mt-5 space-y-2">
        <label className="space-y-1 text-sm text-[color:var(--text-strong)]">
          <span>Rodapé informativo</span>
          <textarea
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={3}
            placeholder="Texto exibido abaixo das regras na página pública"
            className="w-full resize-y rounded-xl border border-[color:var(--surface-border)] bg-black/15 px-3 py-2 text-sm text-[color:var(--text-strong)] outline-none focus:border-[color:var(--accent-cyan)]"
          />
        </label>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_45%)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Preview do rodapé</p>
          <MarkdownRenderer
            className="text-sm text-slate-400"
            content={
              footer ||
              "Estas regras estão sujeitas a atualizações antes do início de cada temporada. Mantenha-se informado através do nosso Discord."
            }
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <AdminButton type="button" onClick={submit} disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Salvando..." : "Salvar Regras"}
        </AdminButton>
      </div>
    </section>
  );
}

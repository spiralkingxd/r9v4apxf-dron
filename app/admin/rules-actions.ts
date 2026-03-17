"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdminAccess, logAdminAction } from "@/app/admin/_lib";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = {
  success?: string;
  error?: string;
};

function withDbHint(prefix: string, errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  const permissionError =
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("42501");
  const missingTable =
    lower.includes("relation") && lower.includes("rules_content") && lower.includes("does not exist");

  if (missingTable) {
    return `${prefix} ${errorMessage} (A tabela rules_content não existe no banco. Aplique o SQL do editor de regras.)`;
  }

  if (permissionError) {
    return `${prefix} ${errorMessage} (Sem permissão no banco. Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.)`;
  }

  return `${prefix} ${errorMessage}`;
}

const ruleSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "O título da regra é obrigatório.").max(180, "Título muito longo."),
  content: z.string().trim().min(1, "O conteúdo da regra é obrigatório.").max(6000, "Conteúdo muito longo."),
});

const saveRulesSchema = z.object({
  footer: z.string().trim().max(120000).default(""),
  rules: z.array(ruleSchema).min(1, "Adicione pelo menos uma regra."),
});

export async function saveRulesContent(input: z.input<typeof saveRulesSchema>): Promise<ActionResult> {
  const parsed = saveRulesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const { supabase, adminId } = await assertAdminAccess();
    const writeClient = createAdminClient() ?? supabase;

    const { data: beforeRows } = await supabase
      .from("rules_content")
      .select("id, title, content, order, updated_at")
      .order("order", { ascending: true });

    const previousRules = (beforeRows ?? []).map((row) => ({
      id: String(row.id),
      order: Number(row.order ?? 0),
      title: String(row.title ?? ""),
      content: String(row.content ?? ""),
      updated_at: String(row.updated_at ?? ""),
    }));

    const { data: beforeSettings } = await supabase
      .from("system_settings")
      .select("general_rules")
      .eq("id", 1)
      .maybeSingle<{ general_rules: string | null }>();

    const normalizedRows = parsed.data.rules.map((rule, index) => ({
      order: index + 1,
      title: rule.title.trim(),
      content: rule.content.trim(),
    }));

    const existingIds = (beforeRows ?? []).map((row) => String(row.id)).filter(Boolean);
    if (existingIds.length > 0) {
      const { error: clearError } = await writeClient.from("rules_content").delete().in("id", existingIds);
      if (clearError) {
        return {
          error: withDbHint("Não foi possível limpar regras antigas.", clearError.message),
        };
      }
    }

    const { error: insertError } = await writeClient.from("rules_content").insert(normalizedRows);
    if (insertError) {
      return {
        error: withDbHint("Não foi possível salvar as regras.", insertError.message),
      };
    }

    const { error: settingsError } = await writeClient
      .from("system_settings")
      .update({ general_rules: parsed.data.footer.trim() || null })
      .eq("id", 1);
    if (settingsError) {
      return {
        error: withDbHint(
          "As regras foram salvas, mas o rodapé não pôde ser atualizado.",
          settingsError.message,
        ),
      };
    }

    await logAdminAction(supabase, {
      adminId,
      action: "save_rules_content",
      targetType: "rules_content",
      details: {
        count: normalizedRows.length,
      },
      previousState: {
        rules: previousRules,
        footer: beforeSettings?.general_rules ?? null,
      },
      nextState: {
        rules: normalizedRows,
        footer: parsed.data.footer.trim() || null,
      },
      severity: "warning",
    });

    revalidatePath("/admin/rules");
    revalidatePath("/regras");

    return { success: "Regras atualizadas com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao salvar regras." };
  }
}

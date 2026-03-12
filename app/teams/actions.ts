"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(50, "O nome pode ter no máximo 50 caracteres.")
    .trim(),
});

export type CreateTeamState = {
  error?: string | null;
};

export async function createTeam(
  _prevState: CreateTeamState,
  formData: FormData,
): Promise<CreateTeamState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Você precisa estar logado para criar uma equipe." };
  }

  const parsed = createTeamSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({ name: parsed.data.name, captain_id: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma equipe com esse nome. Tente outro." };
    }
    return { error: "Não foi possível criar a equipe. Tente novamente." };
  }

  revalidatePath("/teams");
  redirect(`/teams/${data.id}`);
}

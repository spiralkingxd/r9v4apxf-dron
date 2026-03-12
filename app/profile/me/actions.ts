"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Você precisa estar logado para atualizar o perfil.",
    };
  }

  const bioValue = String(formData.get("bio") ?? "").trim();
  const bio = bioValue.length > 0 ? bioValue.slice(0, 240) : null;

  const { error } = await supabase
    .from("profiles")
    .update({ bio })
    .eq("id", user.id);

  if (error) {
    return {
      error: "Não foi possível atualizar o perfil.",
    };
  }

  revalidatePath("/profile/me");

  return {
    success: "Perfil atualizado com sucesso.",
  };
}
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileFeatures(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado" };
  }

  const customStatus = formData.get("custom_status");
  const boatRole = formData.get("boat_role");

  const updates: any = {};
  if (customStatus !== null) updates.custom_status = String(customStatus).trim().substring(0, 50);
  if (boatRole !== null) updates.boat_role = String(boatRole);

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile/me");
  revalidatePath(`/profile/${user.id}`);
  return { success: "Perfil atualizado com sucesso!" };
}

export async function syncDiscordAvatarAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Sem usuário" };

  // Sync is tricky via simple action unless we have the provider_token/avatar_url handy from the identities table, 
  // or trigger a sign-in cycle.
  // Instead, let's just attempt to pull the identity data 
  const { data: identities, error: idError } = await supabase.auth.getUserIdentities();
  
  if (identities && identities.identities.length > 0) {
    const discordIdentity = identities.identities.find(id => id.provider === "discord");
    if (discordIdentity && discordIdentity.identity_data?.avatar_url) {
       await supabase.from("profiles").update({ avatar_url: discordIdentity.identity_data.avatar_url }).eq("id", user.id);
    }
  }

  revalidatePath("/profile/me");
  return { success: "Sincronizado!" };
}

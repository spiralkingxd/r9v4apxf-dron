"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileFeatures(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado" };
  }

  const customStatus = formData.get("custom_status");
  const boatRole = formData.get("boat_role");
  const avatarFile = formData.get("avatar_file") as File | null;

  const updates: any = {};
  if (customStatus !== null) updates.custom_status = String(customStatus).trim().substring(0, 50);
  if (boatRole !== null) updates.boat_role = String(boatRole);

  if (avatarFile && avatarFile.size > 0) {
    const fileExt = avatarFile.name.split('.').pop();
    const filePath = `${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true });

    if (uploadError) {
      return { error: `Erro no upload da imagem: ${uploadError.message}. Certifique-se que o bucket "avatars" existe no Supabase e é público.` };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    updates.avatar_url = publicUrl;
  }

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

export async function syncDiscordAvatarAction(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Sem usuário" };

  const { data: identities, error: idError } = await supabase.auth.getUserIdentities();
  
  if (identities && identities.identities.length > 0) {
    const discordIdentity = identities.identities.find(id => id.provider === "discord");
    if (discordIdentity && discordIdentity.identity_data?.avatar_url) {
       await supabase.from("profiles").update({ avatar_url: discordIdentity.identity_data.avatar_url }).eq("id", user.id);
    }
  }

  revalidatePath("/profile/me");
  return { success: "Sincronizado via Discord!" };
}

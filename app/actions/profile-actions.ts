"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileFeatures(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado" };
  }

  const customStatus = formData.get("custom_status"); const boatRoleArray = formData.getAll("boat_role_array");
  const boatRole = boatRoleArray.length > 0 ? boatRoleArray.join(", ") : formData.get("boat_role"); const avatarBase64 = formData.get("avatar_base64") as string | null; const xboxGamertag = formData.get("xbox_gamertag") as string | null; if (xboxGamertag?.trim()) { const { data: existingProfile } = await supabase.from("profiles").select("xbox_gamertag").eq("id", user.id).single(); if (existingProfile && existingProfile.xbox_gamertag) { return { error: "A conta Xbox já foi vinculada e não pode ser alterada. Contate um admin." }; } } const updates: any = {}; if (customStatus !== null) updates.custom_status = String(customStatus).trim().substring(0, 50); if (boatRole !== null) updates.boat_role = String(boatRole); if (xboxGamertag && xboxGamertag.trim()) updates.xbox_gamertag = xboxGamertag.trim();

  if (avatarBase64 && avatarBase64.startsWith('data:image')) {
    try {
      // Create a buffer from the base64 string
      const base64Data = avatarBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileExt = avatarBase64.split(';')[0].split('/')[1] || 'jpeg';
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, buffer, { 
          upsert: true,
          contentType: `image/${fileExt}` 
        });

      if (uploadError) {
        return { error: `Erro no upload da imagem: ${uploadError.message}. Verifique o bucket "avatars" no Supabase.` };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      updates.avatar_url = publicUrl;
    } catch (e) {
      console.error(e);
      return { error: "Falha ao processar a imagem." }
    }
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

export async function removeProfileAvatarAction(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Sem usuário" };

  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);

  revalidatePath("/profile/me");
  return { success: "Foto removida com sucesso!" };
}

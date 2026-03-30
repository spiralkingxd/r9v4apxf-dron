"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type CreateTeamState = {
  error?: string | null;
  success?: string | null;
  teamId?: string | null;
};

export type SearchUsersResult = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}[];

function sanitizeSearchTerm(input: string) {
  return input.replace(/[^a-zA-Z0-9 _-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

function toFriendlyTeamError(message?: string | null): string {
  const msg = (message ?? "").toLowerCase();

  if (msg.includes("1 equipe") || msg.includes("limite máximo")) {
    return "Você já participa de uma equipe";
  }
  if (msg.includes("10 membros") || msg.includes("equipe atingiu")) {
    return "Esta equipe está cheia (10/10)";
  }
  if (msg.includes("duplicate") || msg.includes("já existe")) {
    return "Este nome de equipe já está em uso";
  }

  return "Não foi possível concluir a ação. Tente novamente.";
}

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const createTeamSchema = z.object({
  name: z
    .string()
    .min(3, "O nome deve ter pelo menos 3 caracteres.")
    .max(30, "O nome pode ter no máximo 30 caracteres.")
    .trim(),
  logo_url: z
    .string()
    .url("URL do logo inválida.")
    .or(z.literal(""))
    .default(""),
  member_ids: z
    .array(z.string().uuid())
    .max(9, "Você pode adicionar no máximo 9 membros além de você.")
    .default([]),
});

// ---------------------------------------------------------------------------
// Busca de usuários (chamada por Client Component via Server Action)
// ---------------------------------------------------------------------------

export async function searchUsers(term: string): Promise<SearchUsersResult> {
  const q = sanitizeSearchTerm(term);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(10);

  const profileRows = (data ?? []) as {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  }[];

  if (profileRows.length === 0) return [];

  const ids = profileRows.map((row) => row.id);
  const { data: membershipLinks } = await supabase
    .from("team_members")
    .select("user_id")
    .in("user_id", ids);

  const membershipMap = new Map<string, number>();
  for (const row of membershipLinks ?? []) {
    const uid = row.user_id as string;
    membershipMap.set(uid, (membershipMap.get(uid) ?? 0) + 1);
  }

  return profileRows
    .filter((row) => (membershipMap.get(row.id) ?? 0) < 1)
    .slice(0, 10) as SearchUsersResult;
}

// ---------------------------------------------------------------------------
// Verificar disponibilidade de nome (debounce gerenciado pelo cliente)
// ---------------------------------------------------------------------------

export async function checkTeamNameAvailable(
  name: string,
): Promise<{ available: boolean }> {
  const q = name.trim();
  if (q.length < 3) return { available: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id")
    .ilike("name", q)
    .maybeSingle();

  return { available: !data };
}

export async function getCurrentUserTeamCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Criação da equipe
// ---------------------------------------------------------------------------

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

  const { data: profile } = await supabase.from("profiles").select("xbox_gamertag").eq("id", user.id).single(); let finalXbox = profile?.xbox_gamertag; const providedXbox = formData.get("xbox_gamertag") as string | null; if (!finalXbox && providedXbox?.trim()) { await supabase.from("profiles").update({ xbox_gamertag: providedXbox.trim() }).eq("id", user.id); finalXbox = providedXbox.trim(); } if (!finalXbox) { return { error: "Você precisa informar sua Xbox Gamertag para criar uma equipe." }; } // Verifica limite de 1 equipe por conta.
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 1) {
    return { error: "Você já participa de uma equipe" };
  }

  // Puxar configurações de sistema para o tamanho máximo da equipe
  const { data: sysSettings } = await supabase
    .from("system_settings")
    .select("tournament")
    .eq("id", 1)
    .maybeSingle();

  const maxTeamSize = Number((sysSettings?.tournament as any)?.max_team_size ?? 5);

  const rawMemberIds: string[] = [];
  for (const val of formData.getAll("member_id")) {
    if (typeof val === "string" && val) rawMemberIds.push(val);
  }

  if (rawMemberIds.length > maxTeamSize - 1) {
    return { error: `Você pode adicionar no máximo ${maxTeamSize - 1} membros nesta equipe (total: ${maxTeamSize}).` };
  }

  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    logo_url: formData.get("logo_url") ?? "",
    member_ids: rawMemberIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { name, logo_url, member_ids } = parsed.data;

  // Insere a equipe — o trigger sync_team_captain_membership adiciona o capitão
  // em team_members automaticamente.
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      name,
      logo_url: logo_url || null,
      captain_id: user.id,
      max_members: maxTeamSize,
    })
    .select("id")
    .single();

  if (teamError) {
    if (teamError.code === "23505") {
      return { error: "Este nome de equipe já está em uso" };
    }
    return { error: toFriendlyTeamError(teamError.message) };
  }

  // Adiciona membros extras selecionados.
  if (member_ids.length > 0) {
    const memberRows = member_ids.map((uid) => ({
      team_id: team.id,
      user_id: uid,
      role: "member" as const,
    }));

    const { error: memberError } = await supabase
      .from("team_members")
      .insert(memberRows);

    if (memberError) {
      // Equipe já criada; não desfeita aqui para evitar orphan — apenas avisa.
      return {
        error: toFriendlyTeamError(memberError.message),
        success: "Equipe criada com sucesso.",
        teamId: team.id,
      };
    }
  }

  revalidatePath("/teams");
  revalidatePath("/profile/me");

  return {
    success: "Equipe criada com sucesso.",
    teamId: team.id,
  };
}


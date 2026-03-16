"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { teamRequestMessages, translateTeamRequestError } from "@/lib/team-request-messages";

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

type JoinRequestStatus = "pending" | "approved" | "rejected";

type JoinRequestRow = {
  id: string;
  team_id: string;
  user_id: string;
  status: JoinRequestStatus;
};

const createJoinRequestSchema = z.object({
  teamId: z.string().uuid("Equipe inválida."),
});

const respondSchema = z.object({
  requestId: z.string().uuid("Solicitação inválida."),
  status: z.enum(["approved", "rejected"]),
});

const cancelSchema = z.object({
  requestId: z.string().uuid("Solicitação inválida."),
});

async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "Você precisa estar logado." as string };
  }

  return { supabase, user, error: null as string | null };
}

// ---------------------------------------------------------------------------
// Validações utilitárias (reutilizáveis)
// ---------------------------------------------------------------------------

export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export async function hasPendingRequest(teamId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_join_requests")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  return Boolean(data);
}

export async function getUserTeamCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
}

export async function getTeamMemberCount(teamId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId);

  return count ?? 0;
}

export async function isTeamCaptain(teamId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("captain_id", userId)
    .maybeSingle();

  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createJoinRequest(teamId: string, providedXbox?: string): Promise<ActionResult<JoinRequestRow>> {
  const parsed = createJoinRequestSchema.safeParse({ teamId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const auth = await requireAuthenticatedUser();
  if (auth.error || !auth.user) {
    return { success: false, error: auth.error ?? "Você precisa estar logado." };
  }

  const { supabase, user } = auth;
  const validTeamId = parsed.data.teamId;

  try {
    const [alreadyMember, pending, myTeamCount, currentMembers] = await Promise.all([
      isTeamMember(validTeamId, user.id),
      hasPendingRequest(validTeamId, user.id),
      getUserTeamCount(user.id),
      getTeamMemberCount(validTeamId),
    ]);

    if (alreadyMember) {
      return { success: false, error: teamRequestMessages.ALREADY_MEMBER };
    }

    if (pending) {
      return {
        success: false,
        error: `${teamRequestMessages.PENDING_REQUEST}. ${teamRequestMessages.WAIT_CAPTAIN}`,
      };
    }

    if (myTeamCount >= 1) {
      return { success: false, error: teamRequestMessages.TEAM_LIMIT };
    }

    if (currentMembers >= 10) {
      return { success: false, error: teamRequestMessages.TEAM_FULL };
    }

    const { data, error } = await supabase
      .from("team_join_requests")
      .insert({ team_id: validTeamId, user_id: user.id, status: "pending" })
      .select("id, team_id, user_id, status")
      .single<JoinRequestRow>();

    if (error) {
      console.error("[createJoinRequest] Supabase error:", error);
      return { success: false, error: translateTeamRequestError(error.message) };
    }

    revalidatePath(`/teams/${validTeamId}`);
    revalidatePath("/teams");
    revalidatePath("/profile/me");

    return { success: true, data };
  } catch (error) {
    console.error("[createJoinRequest] unexpected error:", error);
    return { success: false, error: "Não foi possível enviar sua solicitação." };
  }
}

export async function respondToJoinRequest(
  requestId: string,
  status: "approved" | "rejected",
): Promise<ActionResult<JoinRequestRow>> {
  const parsed = respondSchema.safeParse({ requestId, status });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const auth = await requireAuthenticatedUser();
  if (auth.error || !auth.user) {
    return { success: false, error: auth.error ?? "Você precisa estar logado." };
  }

  const { supabase, user } = auth;

  try {
    const { data: request, error: requestError } = await supabase
      .from("team_join_requests")
      .select("id, team_id, user_id, status")
      .eq("id", parsed.data.requestId)
      .maybeSingle<JoinRequestRow>();

    if (requestError) {
      console.error("[respondToJoinRequest] fetch request error:", requestError);
      return { success: false, error: "Solicitação não encontrada" };
    }

    if (!request) {
      return { success: false, error: teamRequestMessages.REQUEST_NOT_FOUND };
    }

    if (request.status !== "pending") {
      return { success: false, error: "Esta solicitação já foi respondida." };
    }

    const captain = await isTeamCaptain(request.team_id, user.id);
    if (!captain) {
      return { success: false, error: teamRequestMessages.NOT_CAPTAIN };
    }

    if (parsed.data.status === "approved") {
      const [teamMembers, targetUserTeams, targetAlreadyMember] = await Promise.all([
        getTeamMemberCount(request.team_id),
        getUserTeamCount(request.user_id),
        isTeamMember(request.team_id, request.user_id),
      ]);

      if (targetAlreadyMember) {
        return { success: false, error: teamRequestMessages.ALREADY_MEMBER };
      }

      if (teamMembers >= 10) {
        return { success: false, error: teamRequestMessages.TEAM_FULL };
      }

      if (targetUserTeams >= 1) {
        return { success: false, error: teamRequestMessages.TEAM_LIMIT };
      }

      const { error: memberError } = await supabase
        .from("team_members")
        .insert({ team_id: request.team_id, user_id: request.user_id, role: "member" });

      if (memberError) {
        console.error("[respondToJoinRequest] insert team member error:", memberError);
        return { success: false, error: translateTeamRequestError(memberError.message) };
      }
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from("team_join_requests")
      .update({
        status: parsed.data.status,
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq("id", request.id)
      .eq("status", "pending")
      .select("id, team_id, user_id, status")
      .single<JoinRequestRow>();

    if (updateError) {
      console.error("[respondToJoinRequest] update request error:", updateError);
      return { success: false, error: translateTeamRequestError(updateError.message) };
    }

    revalidatePath(`/teams/${request.team_id}`);
    revalidatePath("/teams");
    revalidatePath("/profile/me");

    return { success: true, data: updatedRequest };
  } catch (error) {
    console.error("[respondToJoinRequest] unexpected error:", error);
    return { success: false, error: "Não foi possível responder à solicitação." };
  }
}

export async function cancelJoinRequest(requestId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = cancelSchema.safeParse({ requestId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const auth = await requireAuthenticatedUser();
  if (auth.error || !auth.user) {
    return { success: false, error: auth.error ?? "Você precisa estar logado." };
  }

  const { supabase, user } = auth;

  try {
    const { data: request, error: requestError } = await supabase
      .from("team_join_requests")
      .select("id, team_id, user_id, status")
      .eq("id", parsed.data.requestId)
      .maybeSingle<JoinRequestRow>();

    if (requestError) {
      console.error("[cancelJoinRequest] fetch request error:", requestError);
      return { success: false, error: "Solicitação não encontrada" };
    }

    if (!request) {
      return { success: false, error: teamRequestMessages.REQUEST_NOT_FOUND };
    }

    if (request.user_id !== user.id) {
      return { success: false, error: "Você não pode cancelar esta solicitação." };
    }

    if (request.status !== "pending") {
      return { success: false, error: "A solicitação não está mais pendente." };
    }

    const { error: deleteError } = await supabase
      .from("team_join_requests")
      .delete()
      .eq("id", request.id)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (deleteError) {
      console.error("[cancelJoinRequest] delete request error:", deleteError);
      return { success: false, error: translateTeamRequestError(deleteError.message) };
    }

    revalidatePath(`/teams/${request.team_id}`);
    revalidatePath("/teams");
    revalidatePath("/profile/me");

    return { success: true, data: { id: request.id } };
  } catch (error) {
    console.error("[cancelJoinRequest] unexpected error:", error);
    return { success: false, error: "Não foi possível cancelar a solicitação." };
  }
}



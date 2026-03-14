export const teamRequestMessages = {
  ALREADY_MEMBER: "Você já é membro desta equipe",
  PENDING_REQUEST: "Você já solicitou entrada nesta equipe",
  WAIT_CAPTAIN: "Aguarde a resposta do capitão",
  TEAM_FULL: "Esta equipe está cheia (10/10)",
  TEAM_LIMIT: "Você já participa de uma equipe",
  NOT_CAPTAIN: "Apenas o capitão pode realizar esta ação",
  REQUEST_NOT_FOUND: "Solicitação não encontrada",
  REQUEST_CREATED: "Solicitação criada com sucesso",
  REQUEST_APPROVED: "Solicitação aprovada",
  REQUEST_REJECTED: "Solicitação rejeitada",
  REQUEST_CANCELLED: "Solicitação cancelada",
  GENERIC_ERROR: "Não foi possível concluir a ação. Tente novamente.",
} as const;

export function translateTeamRequestError(message?: string | null): string {
  const msg = (message ?? "").toLowerCase();

  if (msg.includes("já é membro")) return teamRequestMessages.ALREADY_MEMBER;
  if (msg.includes("já existe uma solicitação pendente") || msg.includes("duplicate") || msg.includes("23505")) {
    return teamRequestMessages.PENDING_REQUEST;
  }
  if (msg.includes("10 membros") || msg.includes("equipe atingiu")) return teamRequestMessages.TEAM_FULL;
  if (msg.includes("1 equipe") || msg.includes("limite máximo")) return teamRequestMessages.TEAM_LIMIT;
  if (msg.includes("captain") || msg.includes("capitão")) return teamRequestMessages.NOT_CAPTAIN;
  if (msg.includes("não encontrada")) return teamRequestMessages.REQUEST_NOT_FOUND;

  return teamRequestMessages.GENERIC_ERROR;
}
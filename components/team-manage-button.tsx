"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";

import type { JoinRequestHistoryItem, JoinRequestPendingItem } from "@/components/join-request-list";
import { ManageTeamModal } from "@/components/manage-team-modal";

type MemberRow = {
  user_id: string;
  role: "captain" | "member";
  joined_at: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  xbox_gamertag: string | null;
};

type TeamInfo = {
  id: string;
  name: string;
  logo_url: string | null;
  max_members: number;
  captain_id: string;
};

export function TeamManageButton({
  team,
  members,
  pendingRequests,
  historyRequests,
}: {
  team: TeamInfo;
  members: MemberRow[];
  pendingRequests: JoinRequestPendingItem[];
  historyRequests: JoinRequestHistoryItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
      >
        <Settings2 className="h-4 w-4" />
        Gerenciar equipe
      </button>

      {open ? (
        <ManageTeamModal
          team={team}
          initialMembers={members}
          initialPendingRequests={pendingRequests}
          initialHistoryRequests={historyRequests}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
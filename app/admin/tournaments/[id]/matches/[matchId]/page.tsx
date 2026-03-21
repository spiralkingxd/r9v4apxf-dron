import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getMatchDetail } from "@/app/admin/matches/_data";
import { MatchDetailEditor } from "@/components/admin/match-detail-editor";

type Props = {
  params: Promise<{ id: string; matchId: string }>;
};

export default async function TournamentMatchDetailPage({ params }: Props) {
  const { id, matchId } = await params;
  const { detail, history } = await getMatchDetail(matchId);

  return (
    <section className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/admin/tournaments" className="hover:text-slate-700 dark:hover:text-slate-200">
          Torneios
        </Link>
        <span>/</span>
        <Link href={`/admin/tournaments/${id}`} className="hover:text-slate-700 dark:hover:text-slate-200">
          {detail.event_title}
        </Link>
        <span>/</span>
        <Link href={`/admin/tournaments/${id}/matches`} className="hover:text-slate-700 dark:hover:text-slate-200">
          Partidas
        </Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-200">Detalhe</span>
      </nav>

      <Link
        href={`/admin/tournaments/${id}/matches`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para partidas
      </Link>

      <MatchDetailEditor detail={detail} history={history} />
    </section>
  );
}

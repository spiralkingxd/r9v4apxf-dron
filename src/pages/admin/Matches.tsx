import { useEffect, useState } from 'react';
import { AdminTable } from '../../components/admin/AdminTable';
import api from '../../lib/api';
import { Swords, Edit } from 'lucide-react';
import { format } from 'date-fns';

interface Match {
  id: string;
  event: { title: string };
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  score_a: number;
  score_b: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  start_time: string;
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/matches', {
        params: { page, limit: 10 },
      });
      setMatches(data.data);
      setTotalPages(Math.ceil(data.count / 10));
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [page]);

  const columns = [
    {
      header: 'Event',
      accessorKey: 'event' as keyof Match,
      cell: (match: Match) => <span className="text-sm text-slate-300">{match.event?.title}</span>,
    },
    {
      header: 'Matchup',
      cell: (match: Match) => (
        <div className="flex items-center space-x-2 text-sm text-slate-200">
          <span className={match.score_a > match.score_b ? 'text-emerald-400 font-bold' : ''}>{match.team_a?.name || 'TBD'}</span>
          <span className="text-slate-500">vs</span>
          <span className={match.score_b > match.score_a ? 'text-emerald-400 font-bold' : ''}>{match.team_b?.name || 'TBD'}</span>
        </div>
      ),
    },
    {
      header: 'Score',
      cell: (match: Match) => (
        <div className="text-sm font-mono text-slate-300">
          {match.score_a} - {match.score_b}
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status' as keyof Match,
      cell: (match: Match) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
          ${match.status === 'live' ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : ''}
          ${match.status === 'scheduled' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' : ''}
          ${match.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
        `}>
          {match.status}
        </span>
      ),
    },
    {
      header: 'Start Time',
      accessorKey: 'start_time' as keyof Match,
      cell: (match: Match) => <span className="text-xs text-slate-400">{match.start_time ? format(new Date(match.start_time), 'MMM d, HH:mm') : 'TBD'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Matches Management</h1>
      </div>

      <AdminTable
        data={matches}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        actions={(match) => (
          <div className="flex justify-end space-x-2">
              <button className="text-slate-400 hover:text-emerald-400 p-1" title="Edit Result">
                <Edit className="h-4 w-4" />
              </button>
          </div>
        )}
      />
    </div>
  );
}

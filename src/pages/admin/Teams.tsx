import { useEffect, useState } from 'react';
import { AdminTable } from '../../components/admin/AdminTable';
import api from '../../lib/api';
import { Shield, ShieldAlert, Trash2, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';

interface Team {
  id: string;
  name: string;
  captain: {
    full_name: string;
    email: string;
  };
  status: 'active' | 'banned';
  created_at: string;
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/teams', {
        params: { page, limit: 10, search },
      });
      setTeams(data.data);
      setTotalPages(Math.ceil(data.count / 10));
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [page, search]);

  const handleBan = async (teamId: string) => {
    if (!window.confirm('Are you sure you want to ban this team?')) return;
    try {
      await api.post(`/admin/teams/${teamId}/ban`);
      fetchTeams();
    } catch (error) {
      console.error('Failed to ban team:', error);
      alert('Failed to ban team');
    }
  };

  const handleUnban = async (teamId: string) => {
    if (!window.confirm('Are you sure you want to unban this team?')) return;
    try {
      await api.post(`/admin/teams/${teamId}/unban`);
      fetchTeams();
    } catch (error) {
      console.error('Failed to unban team:', error);
      alert('Failed to unban team');
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!window.confirm('Are you sure you want to delete this team? This action is irreversible.')) return;
    try {
      await api.delete(`/admin/teams/${teamId}`);
      fetchTeams();
    } catch (error) {
      console.error('Failed to delete team:', error);
      alert('Failed to delete team');
    }
  };

  const columns = [
    {
      header: 'Nome da Equipe',
      accessorKey: 'name' as keyof Team,
      cell: (team: Team) => (
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-md bg-slate-800 flex items-center justify-center border border-slate-700">
            <Shield className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{team.name}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Capitão',
      accessorKey: 'captain' as keyof Team,
      cell: (team: Team) => (
        <div>
          <p className="text-sm text-slate-300">{team.captain?.full_name || 'Desconhecido'}</p>
          <p className="text-xs text-slate-500">{team.captain?.email}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status' as keyof Team,
      cell: (team: Team) => (
        team.status === 'banned' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Banido</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
        )
      ),
    },
    {
      header: 'Criado em',
      accessorKey: 'created_at' as keyof Team,
      cell: (team: Team) => <span className="text-xs text-slate-400">{format(new Date(team.created_at), 'd MMM, yyyy')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gerenciamento de Equipes</h1>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Exportar CSV
        </button>
      </div>

      <AdminTable
        data={teams}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSearch={setSearch}
        loading={loading}
        searchPlaceholder="Buscar equipes..."
        actions={(team) => (
          <div className="flex justify-end space-x-2">
             {team.status === 'banned' ? (
                <button onClick={() => handleUnban(team.id)} className="text-emerald-400 hover:text-emerald-300 p-1" title="Desbanir">
                  <UserCheck className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={() => handleBan(team.id)} className="text-red-400 hover:text-red-300 p-1" title="Banir">
                  <UserX className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => handleDelete(team.id)} className="text-slate-500 hover:text-red-500 p-1" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
          </div>
        )}
      />
    </div>
  );
}

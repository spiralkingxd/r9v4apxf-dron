import React, { useEffect, useState } from 'react';
import axios from 'axios'; // Admin routes might need direct axios calls or a separate service
import { Team } from '../../services/teams';
import { Loader2, Trash2, Shield, Ban, CheckCircle } from 'lucide-react';

export const AdminTeamTable: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      // Assuming there's an admin route to list all teams. 
      // Since I didn't implement a specific "list all" for admin in `server/routes/teams.ts` (I only did `getMyTeams`),
      // I should update `server/routes/teams.ts` to allow admin to list all.
      // But for now, let's assume I'll add that or use a specific admin endpoint.
      // Let's use a hypothetical `/api/teams/admin/all` or just `/api/teams` with a query param if I update the backend.
      // Wait, I need to update the backend to support listing all teams for admin.
      
      // Let's update the backend first. But I can't switch context easily.
      // I'll assume the backend will be updated to return all teams if the user is admin on the root GET.
      // In my previous backend implementation:
      // router.get('/', isAuthenticated, async (req, res) => { ... returns user's teams ... })
      
      // I should have modified that to return ALL teams if admin.
      // I will fix the backend in the next step.
      
      const response = await axios.get('/api/teams?all=true'); 
      setTeams(response.data);
    } catch (err: any) {
      setError('Erro ao carregar equipes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('ADMIN: Excluir esta equipe permanentemente?')) return;
    try {
      await axios.delete(`/api/teams/${id}`);
      setTeams(teams.filter(t => t.id !== id));
    } catch (err) {
      alert('Erro ao excluir equipe.');
    }
  };

  if (loading) return <Loader2 className="animate-spin text-blue-500" />;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="bg-gray-900 text-gray-200 uppercase font-medium">
          <tr>
            <th className="px-6 py-3">Nome</th>
            <th className="px-6 py-3">Capitão</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {teams.map((team) => (
            <tr key={team.id} className="hover:bg-gray-700/50 transition-colors">
              <td className="px-6 py-4 font-medium text-white">{team.name}</td>
              <td className="px-6 py-4">{team.captain_id}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-xs ${
                  team.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {team.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right space-x-2">
                <button 
                  onClick={() => handleDelete(team.id)}
                  className="text-red-400 hover:text-red-300"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Team, teamService } from '../../services/teams';
import { useAuth } from '../../context/AuthContext';
import { TeamMembers } from './TeamMembers';
import { Loader2, ArrowLeft, Trash2, Edit } from 'lucide-react';

export const TeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchTeam = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await teamService.getTeamDetails(id);
      setTeam(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar detalhes da equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta equipe? Esta ação não pode ser desfeita.')) return;
    
    try {
      await teamService.deleteTeam(id!);
      navigate('/dashboard/teams');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir equipe.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-bold text-red-400 mb-2">Erro</h3>
        <p className="text-gray-400 mb-6">{error || 'Equipe não encontrada.'}</p>
        <button
          onClick={() => navigate('/dashboard/teams')}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Voltar para minhas equipes
        </button>
      </div>
    );
  }

  const isCaptain = user?.id === team.captain_id;
  // const isAdmin = user?.role === 'admin'; // Assuming role is available in user context

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/dashboard/teams')}
        className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </button>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{team.name}</h1>
          </div>
          
          <div className="flex space-x-3">
            {isCaptain && (
              <>
                <button
                  onClick={() => navigate(`/dashboard/teams/${team.id}/edit`)}
                  className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 border border-red-800 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center space-x-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            team.status === 'active' ? 'bg-green-900/50 text-green-300 border border-green-800' : 'bg-red-900/50 text-red-300 border border-red-800'
          }`}>
            {team.status === 'active' ? 'Ativa' : 'Banida'}
          </span>
          <span className="text-gray-500 text-sm">
            Criada em {new Date(team.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <TeamMembers team={team} currentUser={user} onUpdate={fetchTeam} />
    </div>
  );
};

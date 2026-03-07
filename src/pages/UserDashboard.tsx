import { useAuth } from '../context/AuthContext';
import { Shield, Swords, Calendar, Edit3, Bell, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { teamService } from '../services/teams';
import { Modal } from '../components/Modal';
import { TeamForm } from '../components/teams/TeamForm';
import { TeamMembers } from '../components/teams/TeamMembers';
import { ProfileCard } from '../components/profile/ProfileCard';
import { XboxStatus } from '../components/profile/XboxStatus';
import { profileService, Profile } from '../services/profile';

interface Team {
  id: string;
  name: string;
  captain_id: string;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (!user) return;
      setIsLoading(true);
      
      const [profileData, teamsData] = await Promise.all([
        profileService.getUserProfile(user.id),
        supabase.from('teams').select('*').eq('captain_id', user.id)
      ]);

      setProfile(profileData);
      setMyTeams(teamsData.data || []);
      
      if (editingTeam) {
        const updatedTeam = teamsData.data?.find(t => t.id === editingTeam.id);
        if (updatedTeam) setEditingTeam(updatedTeam);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyTeams = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('captain_id', user.id);

      if (error) throw error;
      setMyTeams(data || []);
    } catch (error) {
      console.error('Erro ao buscar minhas equipes:', error);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setIsModalOpen(true);
  };

  const handleDelete = async (teamId: string) => {
    if (confirm('Tem certeza que deseja deletar esta equipe? Esta ação não pode ser desfeita.')) {
      try {
        await teamService.deleteTeam(teamId);
        fetchMyTeams();
      } catch (error) {
        console.error('Erro ao deletar equipe:', error);
        alert('Erro ao deletar equipe.');
      }
    }
  };

  // Mock history for now as 'matches' table logic is complex to join without a view
  // In a real app, we would fetch matches where team_id is in myTeams
  const history = [
    { id: 1, event: 'Batalha de The Wilds', result: '1º Lugar', date: '15 Mar, 2026' },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTeam(null); }} title={editingTeam ? "Editar Equipe" : "Registrar Equipe"}>
        <TeamForm team={editingTeam || undefined} onClose={() => { setIsModalOpen(false); setEditingTeam(null); }} />
        {editingTeam && (
          <div className="mt-6 border-t border-ocean-lighter pt-6">
            <TeamMembers team={editingTeam} currentUser={user} onUpdate={fetchMyTeams} />
          </div>
        )}
      </Modal>
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ProfileCard profile={profile} />
          </div>
          <div className="lg:col-span-1">
            <XboxStatus xboxLinked={profile.xbox_linked} xboxGamertag={profile.xbox_gamertag} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Minhas Equipes */}
        <div className="glass-panel rounded-2xl p-6 border border-gold/10">
          <div className="flex items-center justify-between mb-6 border-b border-ocean-lighter pb-4">
            <h2 className="text-xl font-serif font-bold text-gold uppercase tracking-wider flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Minhas Equipes
            </h2>
            <button
              onClick={() => { setEditingTeam(null); setIsModalOpen(true); }}
              className="px-4 py-2 bg-gold text-ocean font-bold rounded-lg text-sm hover:bg-gold-light transition-colors"
            >
              Registrar Equipe
            </button>
          </div>
          
          {myTeams.length > 0 ? (
            <div className="space-y-4">
              {myTeams.map((team) => (
                <div key={team.id} className="p-4 bg-ocean-lighter/50 rounded-xl border border-ocean-light hover:border-gold/30 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-serif font-bold text-lg text-parchment">{team.name}</h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(team)}
                        className="p-1 hover:text-gold transition-colors"
                        title="Editar Equipe"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(team.id)}
                        className="p-1 hover:text-red-500 transition-colors"
                        title="Deletar Equipe"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <span className="px-2 py-1 bg-emerald-light/20 text-emerald-light text-xs font-bold rounded uppercase tracking-wider">
                        Capitão
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-parchment-muted font-mono">{team.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-parchment-muted">
              <p>Você ainda não faz parte de nenhuma equipe.</p>
            </div>
          )}
        </div>

        {/* Histórico de Eventos */}
        <div className="glass-panel rounded-2xl p-6 border border-gold/10">
          <div className="flex items-center justify-between mb-6 border-b border-ocean-lighter pb-4">
            <h2 className="text-xl font-serif font-bold text-gold uppercase tracking-wider flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Histórico de Batalhas
            </h2>
          </div>
          
          <div className="space-y-4">
            {history.map((item, index) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-ocean-lighter/50 rounded-xl border border-ocean-light"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-ocean-light rounded-lg">
                    <Swords className="w-5 h-5 text-gold/70" />
                  </div>
                  <div>
                    <h3 className="font-medium text-parchment">{item.event}</h3>
                    <p className="text-xs text-parchment-muted font-mono">{item.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-serif font-bold text-gold">{item.result}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

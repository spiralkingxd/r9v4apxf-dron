import { useState, useEffect } from 'react';
import { Ship, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { TeamForm } from '../components/teams/TeamForm';

interface Team {
  id: string;
  name: string;
  status: string;
  created_at: string;
  logo_url?: string;
  members?: any[];
}

export default function Teams() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Data State
  const [teams, setTeams] = useState<Team[]>([]);

  // Fetch Teams on Mount
  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('*, team_members(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);
      alert('Erro ao carregar equipes. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Equipe">
        <TeamForm onClose={() => setIsModalOpen(false)} />
      </Modal>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gradient-gold uppercase tracking-wider mb-2">
            Equipes
          </h1>
          <p className="text-parchment-muted text-lg">
            Gerencie sua tripulação ou explore as lendas dos mares.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-gold text-ocean font-bold rounded-lg hover:bg-gold-light transition-colors"
        >
          Registrar Equipe
        </button>
      </div>

      {/* Teams List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      ) : teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team.id} className="glass-panel rounded-2xl p-6 border border-gold/10 hover:border-gold/30 transition-all group cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-ocean-light rounded-lg flex items-center justify-center text-gold">
                      <Ship className="w-6 h-6" />
                    </div>
                  )}
                  <h3 className="font-serif text-xl font-bold text-parchment group-hover:text-gold transition-colors">
                    {team.name}
                  </h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 border-t border-ocean-lighter pt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-parchment-muted">Membros</p>
                  <p className="font-mono text-lg text-gold font-bold">{team.members?.length || 0}/10</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 glass-panel rounded-2xl border border-gold/10">
          <Ship className="w-12 h-12 text-gold/30 mx-auto mb-4" />
          <h3 className="text-xl font-serif font-bold text-parchment mb-2">Nenhuma equipe encontrada</h3>
          <p className="text-parchment-muted">Seja o primeiro a registrar sua tripulação!</p>
        </div>
      )}
    </div>
  );
}

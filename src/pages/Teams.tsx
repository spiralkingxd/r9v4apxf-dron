import { useState, useEffect, FormEvent } from 'react';
import { Users, Ship, Shield, Plus, X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Team {
  id: string;
  name: string;
  ship_name: string;
  captain_id: string;
  members: string[]; // Stored as JSONB in DB
  stats: {
    wins: number;
    losses: number;
  };
}

export default function Teams() {
  const { user } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [teamName, setTeamName] = useState('');
  const [shipName, setShipName] = useState('');
  const [discordLink, setDiscordLink] = useState('');
  const [members, setMembers] = useState(['', '', '', '']);

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
        .select('*')
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

  const handleMemberChange = (index: number, value: string) => {
    const newMembers = [...members];
    newMembers[index] = value;
    setMembers(newMembers);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Você precisa estar logado para criar uma equipe.');

    setIsSubmitting(true);
    try {
      // Filter empty members
      const activeMembers = members.filter(m => m.trim() !== '');

      const { data, error } = await supabase
        .from('teams')
        .insert([
          {
            name: teamName,
            ship_name: shipName,
            discord_link: discordLink,
            captain_id: user.id,
            members: activeMembers,
            stats: { wins: 0, losses: 0 }
          }
        ])
        .select();

      if (error) throw error;

      // Reset form and refresh list
      setTeamName('');
      setShipName('');
      setDiscordLink('');
      setMembers(['', '', '', '']);
      setIsRegistering(false);
      fetchTeams();
      alert('Equipe criada com sucesso! Boa sorte nos mares!');

    } catch (error: any) {
      console.error('Erro ao criar equipe:', error);
      alert(`Erro ao criar equipe: ${error.message || 'Verifique os dados e tente novamente.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate K/D safely
  const calculateKD = (wins: number, losses: number) => {
    if (losses === 0) return wins > 0 ? wins : 0;
    return (wins / losses).toFixed(1);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gradient-gold uppercase tracking-wider mb-2">
            Equipes
          </h1>
          <p className="text-parchment-muted text-lg">
            Gerencie sua tripulação ou explore as lendas dos mares.
          </p>
        </div>
        
        {user && (
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="flex items-center px-6 py-3 bg-ocean-lighter border border-gold/40 text-gold rounded-lg font-serif font-bold uppercase tracking-wider hover:bg-gold/10 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all"
          >
            {isRegistering ? (
              <>
                <X className="w-5 h-5 mr-2" />
                Cancelar
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Nova Equipe
              </>
            )}
          </button>
        )}
      </div>

      {isRegistering && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-panel rounded-2xl p-8 border border-gold/30 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold-dark via-gold to-gold-light"></div>
          <h2 className="text-2xl font-serif font-bold text-parchment mb-6 uppercase tracking-wider flex items-center">
            <Shield className="w-6 h-6 mr-3 text-gold" />
            Alistar Tripulação
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-parchment-muted uppercase tracking-wider mb-2">
                  Nome da Equipe
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-3 text-parchment focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all font-mono"
                  placeholder="Ex: The Salty Dogs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-parchment-muted uppercase tracking-wider mb-2">
                  Tipo de Navio
                </label>
                <select
                  required
                  value={shipName}
                  onChange={(e) => setShipName(e.target.value)}
                  className="w-full bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-3 text-parchment focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all font-mono appearance-none"
                >
                  <option value="" disabled>Selecione seu navio</option>
                  <option value="Sloop">Sloop (1-2 Jogadores)</option>
                  <option value="Brigantim">Brigantim (2-3 Jogadores)</option>
                  <option value="Galeão">Galeão (3-4 Jogadores)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-parchment-muted uppercase tracking-wider mb-2">
                Link do Discord (Convite)
              </label>
              <input
                type="url"
                required
                value={discordLink}
                onChange={(e) => setDiscordLink(e.target.value)}
                className="w-full bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-3 text-parchment focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all font-mono"
                placeholder="https://discord.gg/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-parchment-muted uppercase tracking-wider mb-4">
                Gamertags dos Membros (Xbox/Steam)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {members.map((member, index) => (
                  <div key={index} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users className="h-5 w-5 text-parchment-muted" />
                    </div>
                    <input
                      type="text"
                      required={index < 2} // At least 2 members required
                      value={member}
                      onChange={(e) => handleMemberChange(index, e.target.value)}
                      className="w-full bg-ocean-light border border-ocean-lighter rounded-lg pl-10 pr-4 py-3 text-parchment focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all font-mono"
                      placeholder={`Membro ${index + 1} ${index >= 2 ? '(Opcional)' : '*'}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-gold to-gold-light text-ocean font-serif font-bold uppercase tracking-wider rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Confirmar Registro'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

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
                <h3 className="font-serif text-xl font-bold text-parchment group-hover:text-gold transition-colors">
                  {team.name}
                </h3>
                <div className="p-2 bg-ocean-lighter rounded-lg border border-ocean-light">
                  <Ship className="w-5 h-5 text-gold/70" />
                </div>
              </div>
              
              <div className="inline-block px-3 py-1 bg-ocean-lighter border border-gold/20 rounded-full text-xs font-mono text-parchment-muted mb-6">
                {team.ship_name}
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-ocean-lighter pt-4">
                <div className="text-center">
                  <p className="text-xs text-parchment-muted uppercase tracking-wider mb-1">Vitórias</p>
                  <p className="font-mono text-lg text-emerald-light font-bold">{team.stats?.wins || 0}</p>
                </div>
                <div className="text-center border-x border-ocean-lighter">
                  <p className="text-xs text-parchment-muted uppercase tracking-wider mb-1">Derrotas</p>
                  <p className="font-mono text-lg text-red-400 font-bold">{team.stats?.losses || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-parchment-muted uppercase tracking-wider mb-1">K/D</p>
                  <p className="font-mono text-lg text-gold font-bold">
                    {calculateKD(team.stats?.wins || 0, team.stats?.losses || 0)}
                  </p>
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

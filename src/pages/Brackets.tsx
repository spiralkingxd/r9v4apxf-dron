import { Swords, Trophy, Skull, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Match {
  id: string;
  round_name: string;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  winner_id: string | null;
  score_a: number;
  score_b: number;
  status: string;
}

interface GroupedMatches {
  title: string;
  matches: Match[];
}

export default function Brackets() {
  const [rounds, setRounds] = useState<GroupedMatches[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setIsLoading(true);
      // Fetch matches with team names
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          team_a:teams!team_a_id(name),
          team_b:teams!team_b_id(name)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by round_name
      const grouped = (data || []).reduce((acc: any, match: any) => {
        const round = match.round_name || 'Outros';
        if (!acc[round]) {
          acc[round] = [];
        }
        acc[round].push(match);
        return acc;
      }, {});

      // Convert to array
      const roundsArray = Object.keys(grouped).map(key => ({
        title: key,
        matches: grouped[key]
      }));

      // Sort rounds if needed (e.g., Quartas -> Semis -> Final)
      // For now, relying on insertion order or simple logic
      const order = ['Quartas de Final', 'Semifinais', 'Grande Final'];
      roundsArray.sort((a, b) => {
        return order.indexOf(a.title) - order.indexOf(b.title);
      });

      setRounds(roundsArray);
    } catch (error) {
      console.error('Erro ao buscar chaves:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-ocean-lighter text-parchment-muted rounded border border-ocean-light">Finalizado</span>;
      case 'live':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 rounded border border-red-500/30 animate-pulse">Ao Vivo</span>;
      case 'scheduled':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-gold/10 text-gold rounded border border-gold/30">Agendado</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gradient-gold uppercase tracking-wider mb-2">
            Chaveamento
          </h1>
          <p className="text-parchment-muted text-lg">
            Acompanhe o progresso das equipes rumo à glória.
          </p>
        </div>
        
        <div className="glass-panel px-6 py-3 rounded-lg border border-gold/20 flex items-center space-x-4">
          <span className="font-serif font-bold text-gold uppercase tracking-wider">Torneio Atual:</span>
          <span className="text-parchment font-medium">Batalha de The Wilds</span>
        </div>
      </div>

      {/* Bracket Container */}
      {rounds.length > 0 ? (
        <div className="overflow-x-auto pb-8">
          <div className="min-w-[800px] flex justify-between items-stretch gap-8">
            {rounds.map((round, roundIndex) => (
              <div key={roundIndex} className="flex-1 flex flex-col">
                <h3 className="text-center font-serif font-bold text-gold uppercase tracking-wider mb-8 border-b border-gold/20 pb-4">
                  {round.title}
                </h3>
                
                <div className="flex-1 flex flex-col justify-around gap-8">
                  {round.matches.map((match, matchIndex) => {
                    const isTeamAWinner = match.winner_id && match.team_a && match.winner_id === match.team_a_id; // Need ID check logic if available, simplified here
                    // Actually, match object has winner_id. We need to compare.
                    // But in this flat map, we don't have team IDs easily accessible in the mapped object unless we requested them.
                    // I requested `*` so `team_a_id` is there.
                    
                    // Let's fix the winner logic in render
                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (roundIndex * 0.2) + (matchIndex * 0.1) }}
                        className="relative"
                      >
                        {/* Connecting Lines (simplified for visual representation) */}
                        {roundIndex < rounds.length - 1 && (
                          <div className="hidden md:block absolute top-1/2 -right-4 w-4 border-t-2 border-gold/20"></div>
                        )}
                        {roundIndex > 0 && (
                          <div className="hidden md:block absolute top-1/2 -left-4 w-4 border-t-2 border-gold/20"></div>
                        )}

                        <div className={`glass-panel rounded-xl border transition-all ${match.status === 'live' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-gold/20 hover:border-gold/40'}`}>
                          <div className="flex justify-between items-center p-2 border-b border-ocean-lighter bg-ocean-light/50 rounded-t-xl">
                            <span className="text-xs font-mono text-parchment-muted">Match {match.id.slice(0, 4)}</span>
                            {getStatusBadge(match.status)}
                          </div>
                          
                          <div className="p-3 space-y-2">
                            {/* Team 1 */}
                            <div className={`flex justify-between items-center p-2 rounded bg-ocean-lighter/50 border ${match.winner_id === (match as any).team_a_id ? 'border-gold/50' : 'border-transparent'}`}>
                              <div className="flex items-center space-x-2">
                                {match.winner_id === (match as any).team_a_id && <Trophy className="w-3 h-3 text-gold" />}
                                <span className={`font-medium text-sm ${match.winner_id === (match as any).team_a_id ? 'text-gold' : 'text-parchment'} ${!match.team_a ? 'text-parchment-muted italic' : ''}`}>
                                  {match.team_a?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-parchment">{match.score_a}</span>
                            </div>

                            {/* Divider */}
                            <div className="flex justify-center items-center h-px bg-ocean-lighter relative">
                              <span className="absolute bg-ocean px-2 text-[10px] text-parchment-muted font-mono">VS</span>
                            </div>

                            {/* Team 2 */}
                            <div className={`flex justify-between items-center p-2 rounded bg-ocean-lighter/50 border ${match.winner_id === (match as any).team_b_id ? 'border-gold/50' : 'border-transparent'}`}>
                              <div className="flex items-center space-x-2">
                                {match.winner_id === (match as any).team_b_id && <Trophy className="w-3 h-3 text-gold" />}
                                <span className={`font-medium text-sm ${match.winner_id === (match as any).team_b_id ? 'text-gold' : 'text-parchment'} ${!match.team_b ? 'text-parchment-muted italic' : ''}`}>
                                  {match.team_b?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-parchment">{match.score_b}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 glass-panel rounded-2xl border border-gold/10">
          <Swords className="w-12 h-12 text-gold/30 mx-auto mb-4" />
          <h3 className="text-xl font-serif font-bold text-parchment mb-2">Chaveamento não disponível</h3>
          <p className="text-parchment-muted">As chaves do torneio ainda não foram definidas.</p>
        </div>
      )}

      {/* Legend */}
      <div className="glass-panel rounded-xl p-4 border border-ocean-lighter flex flex-wrap justify-center gap-6 text-sm">
        <div className="flex items-center text-parchment-muted">
          <Trophy className="w-4 h-4 text-gold mr-2" />
          Vencedor
        </div>
        <div className="flex items-center text-parchment-muted">
          <Swords className="w-4 h-4 text-red-400 mr-2" />
          Partida Ao Vivo
        </div>
        <div className="flex items-center text-parchment-muted">
          <Skull className="w-4 h-4 text-ocean-lighter mr-2" />
          Eliminado
        </div>
      </div>
    </div>
  );
}

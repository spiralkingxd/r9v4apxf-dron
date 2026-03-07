import { Trophy, Medal, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Team {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export default function Leaderboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('*');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-gold drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.8)]" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-700 drop-shadow-[0_0_10px_rgba(180,83,9,0.8)]" />;
      default:
        return <span className="font-mono text-lg font-bold text-parchment-muted">{rank}</span>;
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
            Ranking Global
          </h1>
          <p className="text-parchment-muted text-lg">
            As lendas mais temidas dos mares.
          </p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl border border-gold/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ocean-lighter bg-ocean-light/50">
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm w-20 text-center">Rank</th>
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm">Equipe</th>
              </tr>
            </thead>
            <tbody>
              {teams.length > 0 ? (
                teams.map((team, index) => (
                  <motion.tr
                    key={team.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-ocean-lighter/50 hover:bg-ocean-lighter/30 transition-colors ${index < 3 ? 'bg-ocean-light/20' : ''}`}
                  >
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center items-center">
                        {getRankIcon(index + 1)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`font-serif font-bold text-lg ${index === 0 ? 'text-gold' : 'text-parchment'}`}>
                        {team.name}
                      </span>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-parchment-muted">
                    Nenhuma equipe classificada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

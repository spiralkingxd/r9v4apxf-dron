import { Trophy, Medal, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Team {
  id: string;
  name: string;
  stats: {
    wins: number;
    losses: number;
    points: number;
  };
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
        .select('*')
        .order('stats->points', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateKD = (wins: number, losses: number) => {
    if (losses === 0) return wins > 0 ? wins : 0;
    return (wins / losses).toFixed(1);
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
            As lendas mais temidas dos mares. Pontuação acumulada da Temporada 4.
          </p>
        </div>
        
        <div className="glass-panel px-6 py-3 rounded-lg border border-gold/20 flex items-center space-x-4">
          <span className="font-serif font-bold text-gold uppercase tracking-wider">Temporada:</span>
          <select className="bg-transparent text-parchment font-medium focus:outline-none appearance-none cursor-pointer">
            <option value="4">Temporada 4 (Atual)</option>
          </select>
        </div>
      </div>

      {/* Top 3 Podium */}
      {teams.length >= 3 && (
        <div className="hidden md:flex justify-center items-end gap-4 mb-12 h-48">
          {/* 2nd Place */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center w-48"
          >
            <div className="text-center mb-2">
              <p className="font-serif font-bold text-gray-300 truncate w-full px-2">{teams[1].name}</p>
              <p className="font-mono text-sm text-parchment-muted">{teams[1].stats.points} pts</p>
            </div>
            <div className="w-full h-24 bg-gradient-to-t from-ocean-lighter to-ocean-light border-t-2 border-gray-300 rounded-t-lg flex justify-center pt-4 shadow-[0_-10px_30px_rgba(209,213,219,0.1)]">
              <Medal className="w-8 h-8 text-gray-300" />
            </div>
          </motion.div>

          {/* 1st Place */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center w-56 z-10"
          >
            <div className="text-center mb-2">
              <Trophy className="w-10 h-10 text-gold mx-auto mb-2 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]" />
              <p className="font-serif font-bold text-gold text-lg truncate w-full px-2">{teams[0].name}</p>
              <p className="font-mono text-sm text-gold/80 font-bold">{teams[0].stats.points} pts</p>
            </div>
            <div className="w-full h-32 bg-gradient-to-t from-gold/20 to-gold/5 border-t-2 border-gold rounded-t-lg flex justify-center pt-4 shadow-[0_-10px_40px_rgba(212,175,55,0.2)]">
              <span className="font-serif text-4xl font-black text-gold/50">1</span>
            </div>
          </motion.div>

          {/* 3rd Place */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center w-48"
          >
            <div className="text-center mb-2">
              <p className="font-serif font-bold text-amber-700 truncate w-full px-2">{teams[2].name}</p>
              <p className="font-mono text-sm text-parchment-muted">{teams[2].stats.points} pts</p>
            </div>
            <div className="w-full h-20 bg-gradient-to-t from-ocean-lighter to-ocean-light border-t-2 border-amber-700 rounded-t-lg flex justify-center pt-4 shadow-[0_-10px_30px_rgba(180,83,9,0.1)]">
              <Medal className="w-8 h-8 text-amber-700" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl border border-gold/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ocean-lighter bg-ocean-light/50">
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm w-20 text-center">Rank</th>
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm">Equipe</th>
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm text-right">Pontos</th>
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm text-center hidden sm:table-cell">Vitórias</th>
                <th className="py-4 px-6 font-serif font-bold text-gold uppercase tracking-wider text-sm text-center hidden md:table-cell">K/D Ratio</th>
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
                    <td className="py-4 px-6 text-right">
                      <span className="font-mono font-bold text-lg text-emerald-light">
                        {team.stats.points}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center hidden sm:table-cell">
                      <span className="font-mono text-parchment-muted">{team.stats.wins}</span>
                    </td>
                    <td className="py-4 px-6 text-center hidden md:table-cell">
                      <span className="font-mono text-parchment-muted">
                        {calculateKD(team.stats.wins, team.stats.losses)}
                      </span>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-parchment-muted">
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

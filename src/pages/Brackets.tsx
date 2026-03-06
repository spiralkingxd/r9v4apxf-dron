import { Swords, Trophy, Skull } from 'lucide-react';
import { motion } from 'motion/react';

export default function Brackets() {
  const rounds = [
    {
      title: 'Quartas de Final',
      matches: [
        {
          id: 1,
          team1: { name: 'The Salty Dogs', score: 2, winner: true },
          team2: { name: 'Kraken Hunters', score: 0, winner: false },
          status: 'Finalizado',
        },
        {
          id: 2,
          team1: { name: 'Gold Hoarders', score: 1, winner: false },
          team2: { name: 'Reaper\'s Bones', score: 2, winner: true },
          status: 'Finalizado',
        },
        {
          id: 3,
          team1: { name: 'Athena\'s Fortune', score: 0, winner: false },
          team2: { name: 'Sea Dogs', score: 0, winner: false },
          status: 'Ao Vivo',
        },
        {
          id: 4,
          team1: { name: 'Merchant Alliance', score: null, winner: null },
          team2: { name: 'Order of Souls', score: null, winner: null },
          status: 'Agendado',
        },
      ],
    },
    {
      title: 'Semifinais',
      matches: [
        {
          id: 5,
          team1: { name: 'The Salty Dogs', score: null, winner: null },
          team2: { name: 'Reaper\'s Bones', score: null, winner: null },
          status: 'Agendado',
        },
        {
          id: 6,
          team1: { name: 'TBD', score: null, winner: null },
          team2: { name: 'TBD', score: null, winner: null },
          status: 'Agendado',
        },
      ],
    },
    {
      title: 'Grande Final',
      matches: [
        {
          id: 7,
          team1: { name: 'TBD', score: null, winner: null },
          team2: { name: 'TBD', score: null, winner: null },
          status: 'Agendado',
        },
      ],
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Finalizado':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-ocean-lighter text-parchment-muted rounded border border-ocean-light">Finalizado</span>;
      case 'Ao Vivo':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 rounded border border-red-500/30 animate-pulse">Ao Vivo</span>;
      case 'Agendado':
        return <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-gold/10 text-gold rounded border border-gold/30">Agendado</span>;
      default:
        return null;
    }
  };

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
      <div className="overflow-x-auto pb-8">
        <div className="min-w-[800px] flex justify-between items-stretch gap-8">
          {rounds.map((round, roundIndex) => (
            <div key={roundIndex} className="flex-1 flex flex-col">
              <h3 className="text-center font-serif font-bold text-gold uppercase tracking-wider mb-8 border-b border-gold/20 pb-4">
                {round.title}
              </h3>
              
              <div className="flex-1 flex flex-col justify-around gap-8">
                {round.matches.map((match, matchIndex) => (
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

                    <div className={`glass-panel rounded-xl border transition-all ${match.status === 'Ao Vivo' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-gold/20 hover:border-gold/40'}`}>
                      <div className="flex justify-between items-center p-2 border-b border-ocean-lighter bg-ocean-light/50 rounded-t-xl">
                        <span className="text-xs font-mono text-parchment-muted">Match {match.id}</span>
                        {getStatusBadge(match.status)}
                      </div>
                      
                      <div className="p-3 space-y-2">
                        {/* Team 1 */}
                        <div className={`flex justify-between items-center p-2 rounded bg-ocean-lighter/50 border ${match.team1.winner ? 'border-gold/50' : 'border-transparent'}`}>
                          <div className="flex items-center space-x-2">
                            {match.team1.winner && <Trophy className="w-3 h-3 text-gold" />}
                            <span className={`font-medium text-sm ${match.team1.winner ? 'text-gold' : 'text-parchment'} ${match.team1.name === 'TBD' ? 'text-parchment-muted italic' : ''}`}>
                              {match.team1.name}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-parchment">{match.team1.score !== null ? match.team1.score : '-'}</span>
                        </div>

                        {/* Divider */}
                        <div className="flex justify-center items-center h-px bg-ocean-lighter relative">
                          <span className="absolute bg-ocean px-2 text-[10px] text-parchment-muted font-mono">VS</span>
                        </div>

                        {/* Team 2 */}
                        <div className={`flex justify-between items-center p-2 rounded bg-ocean-lighter/50 border ${match.team2.winner ? 'border-gold/50' : 'border-transparent'}`}>
                          <div className="flex items-center space-x-2">
                            {match.team2.winner && <Trophy className="w-3 h-3 text-gold" />}
                            <span className={`font-medium text-sm ${match.team2.winner ? 'text-gold' : 'text-parchment'} ${match.team2.name === 'TBD' ? 'text-parchment-muted italic' : ''}`}>
                              {match.team2.name}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-parchment">{match.team2.score !== null ? match.team2.score : '-'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

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

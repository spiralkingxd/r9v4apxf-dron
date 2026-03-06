import { useAuth } from '../context/AuthContext';
import { Shield, Swords, Calendar, Edit3, Bell } from 'lucide-react';
import { motion } from 'motion/react';

export default function UserDashboard() {
  const { user } = useAuth();

  // Mock data
  const myTeams = [
    { id: 1, name: 'The Salty Dogs', role: 'Capitão', ship: 'Galeão' },
  ];

  const history = [
    { id: 1, event: 'Batalha de The Wilds', result: '1º Lugar', date: '15 Mar, 2026' },
    { id: 2, event: 'Duelo Vulcânico', result: '3º Lugar', date: '20 Fev, 2026' },
  ];

  return (
    <div className="space-y-8">
      {/* Header Profile */}
      <div className="glass-panel rounded-2xl p-8 border border-gold/20 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        
        {user?.avatar ? (
          <img 
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`} 
            alt={user.username} 
            className="w-24 h-24 rounded-full border-2 border-gold shadow-[0_0_20px_rgba(212,175,55,0.3)] z-10"
          />
        ) : (
          <div className="w-24 h-24 rounded-full border-2 border-gold bg-ocean-lighter flex items-center justify-center z-10">
            <span className="text-3xl font-serif text-gold">{user?.username.charAt(0).toUpperCase()}</span>
          </div>
        )}
        
        <div className="text-center md:text-left z-10">
          <h1 className="text-3xl font-serif font-bold text-parchment mb-2">{user?.username}</h1>
          <p className="text-parchment-muted font-mono text-sm mb-4">{user?.email}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <button className="flex items-center px-4 py-2 bg-ocean-lighter border border-gold/30 text-gold rounded-lg text-sm font-medium hover:bg-gold/10 transition-colors">
              <Edit3 className="w-4 h-4 mr-2" />
              Editar Perfil
            </button>
            <button className="flex items-center px-4 py-2 bg-ocean-lighter border border-ocean-light text-parchment rounded-lg text-sm font-medium hover:bg-ocean-light transition-colors">
              <Bell className="w-4 h-4 mr-2" />
              Notificações
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Minhas Equipes */}
        <div className="glass-panel rounded-2xl p-6 border border-gold/10">
          <div className="flex items-center justify-between mb-6 border-b border-ocean-lighter pb-4">
            <h2 className="text-xl font-serif font-bold text-gold uppercase tracking-wider flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Minhas Equipes
            </h2>
          </div>
          
          {myTeams.length > 0 ? (
            <div className="space-y-4">
              {myTeams.map((team) => (
                <div key={team.id} className="p-4 bg-ocean-lighter/50 rounded-xl border border-ocean-light hover:border-gold/30 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-serif font-bold text-lg text-parchment">{team.name}</h3>
                    <span className="px-2 py-1 bg-emerald-light/20 text-emerald-light text-xs font-bold rounded uppercase tracking-wider">
                      {team.role}
                    </span>
                  </div>
                  <p className="text-sm text-parchment-muted font-mono">Navio: {team.ship}</p>
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

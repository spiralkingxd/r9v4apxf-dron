import { Users, Calendar, Trophy, Settings, AlertTriangle, Activity } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  // Mock data
  const stats = [
    { label: 'Usuários Registrados', value: '1,204', icon: <Users className="w-6 h-6 text-blue-400" /> },
    { label: 'Equipes Ativas', value: '342', icon: <Trophy className="w-6 h-6 text-gold" /> },
    { label: 'Eventos Realizados', value: '12', icon: <Calendar className="w-6 h-6 text-emerald-light" /> },
    { label: 'Partidas Pendentes', value: '8', icon: <Activity className="w-6 h-6 text-red-400" /> },
  ];

  const recentLogs = [
    { id: 1, action: 'Equipe "The Salty Dogs" registrada', time: 'Há 5 minutos', type: 'info' },
    { id: 2, action: 'Resultado atualizado: Match #4', time: 'Há 12 minutos', type: 'success' },
    { id: 3, action: 'Denúncia recebida: Comportamento tóxico', time: 'Há 1 hora', type: 'warning' },
    { id: 4, action: 'Novo evento criado: Batalha de The Wilds', time: 'Há 2 horas', type: 'info' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center">
            <Settings className="w-8 h-8 mr-3" />
            Painel Administrativo
          </h1>
          <p className="text-parchment-muted text-lg">
            Controle total sobre os mares da Madness Arena.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-panel rounded-2xl p-6 border border-red-900/30 bg-red-900/10 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-ocean-lighter rounded-xl border border-ocean-light">
                {stat.icon}
              </div>
            </div>
            <h3 className="text-3xl font-mono font-bold text-parchment mb-1">{stat.value}</h3>
            <p className="text-sm text-parchment-muted uppercase tracking-wider">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-gold/10">
          <h2 className="text-xl font-serif font-bold text-gold uppercase tracking-wider mb-6 border-b border-ocean-lighter pb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button className="flex items-center justify-center p-4 bg-ocean-lighter border border-gold/30 text-gold rounded-xl hover:bg-gold/10 transition-colors">
              <Calendar className="w-5 h-5 mr-2" />
              Criar Novo Evento
            </button>
            <button className="flex items-center justify-center p-4 bg-ocean-lighter border border-ocean-light text-parchment rounded-xl hover:bg-ocean-light transition-colors">
              <Activity className="w-5 h-5 mr-2" />
              Atualizar Chaveamento
            </button>
            <button className="flex items-center justify-center p-4 bg-ocean-lighter border border-ocean-light text-parchment rounded-xl hover:bg-ocean-light transition-colors">
              <Users className="w-5 h-5 mr-2" />
              Gerenciar Equipes
            </button>
            <button className="flex items-center justify-center p-4 bg-ocean-lighter border border-ocean-light text-parchment rounded-xl hover:bg-ocean-light transition-colors">
              <Trophy className="w-5 h-5 mr-2" />
              Moderar Leaderboard
            </button>
          </div>
        </div>

        {/* System Logs */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-6 border border-gold/10">
          <h2 className="text-xl font-serif font-bold text-gold uppercase tracking-wider mb-6 border-b border-ocean-lighter pb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Logs Recentes
          </h2>
          <div className="space-y-4">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 p-3 bg-ocean-lighter/50 rounded-lg border border-ocean-light">
                <div className={`w-2 h-2 mt-1.5 rounded-full ${
                  log.type === 'warning' ? 'bg-amber-500' :
                  log.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                }`}></div>
                <div>
                  <p className="text-sm text-parchment">{log.action}</p>
                  <p className="text-xs text-parchment-muted font-mono mt-1">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm text-gold hover:text-gold-light transition-colors uppercase tracking-wider font-medium">
            Ver Todos os Logs
          </button>
        </div>
      </div>
    </div>
  );
}

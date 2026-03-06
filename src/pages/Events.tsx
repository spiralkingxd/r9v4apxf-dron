import { Calendar, Clock, MapPin, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Events() {
  const events = [
    {
      id: 1,
      title: 'Batalha de The Wilds',
      date: '15 de Abril, 2026',
      time: '20:00 UTC',
      location: 'The Wilds',
      status: 'Inscrições Abertas',
      type: 'Galeão 4v4',
      prize: '50.000 Ouro + Título Exclusivo',
      description: 'Navegue pelas águas escuras e traiçoeiras de The Wilds. Apenas as tripulações mais endurecidas sobreviverão a este confronto épico.',
    },
    {
      id: 2,
      title: 'Confronto em Shores of Plenty',
      date: '02 de Maio, 2026',
      time: '18:00 UTC',
      location: 'Shores of Plenty',
      status: 'Agendado',
      type: 'Brigantim 3v3',
      prize: '30.000 Ouro',
      description: 'Águas cristalinas e areias brancas serão manchadas de vermelho. Um torneio rápido e letal para tripulações ágeis.',
    },
    {
      id: 3,
      title: 'Duelo Vulcânico',
      date: '20 de Março, 2026',
      time: '21:00 UTC',
      location: 'The Devil\'s Roar',
      status: 'Finalizado',
      type: 'Sloop 2v2',
      prize: '20.000 Ouro',
      description: 'Sobreviva aos vulcões e aos seus inimigos. Um teste de resistência e habilidade de navegação extrema.',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Inscrições Abertas':
        return 'text-emerald-light bg-emerald-light/10 border-emerald-light/30';
      case 'Agendado':
        return 'text-gold bg-gold/10 border-gold/30';
      case 'Finalizado':
        return 'text-parchment-muted bg-ocean-lighter border-ocean-light';
      default:
        return 'text-parchment bg-ocean-lighter border-ocean-light';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-serif font-bold text-gradient-gold uppercase tracking-wider mb-2">
          Calendário de Eventos
        </h1>
        <p className="text-parchment-muted text-lg">
          Prepare-se para as próximas batalhas e acompanhe o histórico de torneios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Events List */}
        <div className="lg:col-span-2 space-y-6">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel rounded-2xl p-6 border border-gold/20 hover:border-gold/50 transition-all group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-gold/10 transition-all"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono text-parchment-muted bg-ocean-lighter border border-ocean-light">
                      {event.type}
                    </span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-parchment group-hover:text-gold transition-colors">
                    {event.title}
                  </h2>
                </div>
                
                <div className="flex flex-col items-start md:items-end text-sm font-mono text-parchment-muted space-y-1">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gold/70" />
                    {event.date}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-gold/70" />
                    {event.time}
                  </div>
                </div>
              </div>

              <p className="text-parchment-muted text-sm mb-6 leading-relaxed relative z-10">
                {event.description}
              </p>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-ocean-lighter relative z-10">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-sm font-medium text-parchment">
                    <MapPin className="w-4 h-4 mr-2 text-gold" />
                    {event.location}
                  </div>
                  <div className="hidden sm:block w-px h-4 bg-ocean-lighter"></div>
                  <div className="flex items-center text-sm font-medium text-gold">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Prêmio: {event.prize}
                  </div>
                </div>
                
                <button className="flex items-center text-sm font-serif font-bold uppercase tracking-wider text-gold hover:text-gold-light transition-colors">
                  Ver Detalhes
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sidebar / Rules Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-gold/10">
            <h3 className="text-xl font-serif font-bold text-gold uppercase tracking-wider mb-4 border-b border-ocean-lighter pb-4">
              Regras Gerais
            </h3>
            <ul className="space-y-4 text-sm text-parchment-muted">
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">•</span>
                <span>Proibido uso de alianças com navios fora do torneio.</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">•</span>
                <span>Uso obrigatório da bandeira Reaper's Mark durante as partidas.</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">•</span>
                <span>Atrasos superiores a 15 minutos resultam em desclassificação (W.O).</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">•</span>
                <span>Comportamento tóxico no chat do jogo ou Discord resultará em banimento.</span>
              </li>
            </ul>
            <button className="w-full mt-6 py-2 border border-gold/30 text-gold rounded-lg text-sm font-serif font-bold uppercase tracking-wider hover:bg-gold/10 transition-colors">
              Ler Regulamento Completo
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-6 border border-emerald-light/20 bg-emerald-light/5">
            <h3 className="text-lg font-serif font-bold text-emerald-light uppercase tracking-wider mb-2">
              Temporada Atual
            </h3>
            <p className="text-parchment-muted text-sm mb-4">
              A Temporada 4 está em andamento. Acumule pontos nos eventos para subir no Ranking Global.
            </p>
            <div className="w-full bg-ocean-lighter rounded-full h-2 mb-2">
              <div className="bg-emerald-light h-2 rounded-full" style={{ width: '45%' }}></div>
            </div>
            <p className="text-xs text-right font-mono text-emerald-light/70">45% Concluída</p>
          </div>
        </div>
      </div>
    </div>
  );
}

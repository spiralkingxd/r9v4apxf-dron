import { motion } from 'motion/react';
import { Anchor, Trophy, Swords, Skull, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  // Mock countdown data
  const nextEventDate = new Date('2026-04-15T20:00:00Z');
  const now = new Date();
  const diff = nextEventDate.getTime() - now.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden glass-panel border border-gold/30 shadow-[0_0_50px_rgba(212,175,55,0.1)]">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/oceanstorm/1920/1080')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ocean via-ocean/80 to-transparent"></div>
        
        <div className="relative z-10 px-6 py-24 sm:px-12 lg:px-24 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Skull className="w-24 h-24 text-gold mb-6 mx-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-serif font-black mb-6 text-gradient-gold drop-shadow-lg uppercase tracking-widest">
            Madness Arena
          </h1>
          <p className="text-xl md:text-2xl text-parchment-muted max-w-3xl mx-auto mb-12 font-light tracking-wide">
            A arena definitiva para as lendas dos mares. Prove seu valor, conquiste glória e afunde seus inimigos.
          </p>

          {/* Countdown */}
          <div className="glass-panel rounded-2xl p-6 mb-12 border border-gold/20 inline-block">
            <h3 className="text-gold font-serif text-lg mb-4 uppercase tracking-widest">Próximo Torneio Em</h3>
            <div className="flex space-x-6 text-center">
              <div className="flex flex-col">
                <span className="text-4xl md:text-5xl font-mono font-bold text-parchment">{Math.max(0, days)}</span>
                <span className="text-sm text-parchment-muted uppercase tracking-wider mt-1">Dias</span>
              </div>
              <span className="text-4xl md:text-5xl font-mono font-bold text-gold/50">:</span>
              <div className="flex flex-col">
                <span className="text-4xl md:text-5xl font-mono font-bold text-parchment">{Math.max(0, hours).toString().padStart(2, '0')}</span>
                <span className="text-sm text-parchment-muted uppercase tracking-wider mt-1">Horas</span>
              </div>
              <span className="text-4xl md:text-5xl font-mono font-bold text-gold/50">:</span>
              <div className="flex flex-col">
                <span className="text-4xl md:text-5xl font-mono font-bold text-parchment">{Math.max(0, minutes).toString().padStart(2, '0')}</span>
                <span className="text-sm text-parchment-muted uppercase tracking-wider mt-1">Minutos</span>
              </div>
            </div>
          </div>

          <Link
            to="/teams"
            className="group relative inline-flex items-center justify-center px-8 py-4 font-serif font-bold text-ocean bg-gradient-to-r from-gold to-gold-light rounded-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
          >
            <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>
            <span className="relative flex items-center text-lg uppercase tracking-wider">
              Registrar Equipe
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        </div>
      </section>

      {/* Current Champion & Features */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Champion Card */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-8 border border-gold/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gold/10 rounded-full blur-2xl group-hover:bg-gold/20 transition-all"></div>
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-ocean-lighter rounded-xl border border-gold/20 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
              <Trophy className="w-8 h-8 text-gold" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-gold uppercase tracking-wider">Campeão Atual</h2>
              <p className="text-parchment-muted text-sm">Temporada 4</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-ocean-lighter pb-4">
              <span className="text-parchment font-medium text-xl">The Salty Dogs</span>
              <span className="px-3 py-1 bg-emerald-light/20 text-emerald-light rounded-full text-xs font-bold border border-emerald-light/30">
                Galeão
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-parchment-muted text-xs uppercase tracking-wider mb-1">Vitórias</p>
                <p className="font-mono text-xl text-parchment">12</p>
              </div>
              <div>
                <p className="text-parchment-muted text-xs uppercase tracking-wider mb-1">K/D Ratio</p>
                <p className="font-mono text-xl text-parchment">3.4</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link to="/events" className="glass-panel rounded-2xl p-8 border border-gold/10 hover:border-gold/40 transition-all group">
            <Swords className="w-10 h-10 text-gold mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-serif text-xl font-bold text-parchment mb-2 uppercase tracking-wider">Próximas Batalhas</h3>
            <p className="text-parchment-muted text-sm">
              Confira o calendário de eventos, regras e horários dos próximos confrontos na arena.
            </p>
          </Link>
          
          <Link to="/leaderboard" className="glass-panel rounded-2xl p-8 border border-gold/10 hover:border-gold/40 transition-all group">
            <Anchor className="w-10 h-10 text-gold mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-serif text-xl font-bold text-parchment mb-2 uppercase tracking-wider">Ranking Global</h3>
            <p className="text-parchment-muted text-sm">
              Veja quem domina os mares. Acompanhe a pontuação e suba na tabela de classificação.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Calendar, Clock, Users, ChevronRight } from "lucide-react";

const tournamentsImage = "https://images.unsplash.com/photo-1767455471543-055dbc6c6700?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjB0b3VybmFtZW50JTIwY29tcGV0aXRpb24lMjBhcmVuYXxlbnwxfHx8fDE3NzU3ODQxODJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

const tournaments = [
  {
    name: "Copa Madness #12",
    mode: "2v2 • Navio Galeon",
    date: "19 Abr 2026",
    time: "20:00 BRT",
    spots: "8/16 vagas",
    status: "inscricoes",
    prize: "Título + Emblema Exclusivo",
    color: "#c9a227",
  },
  {
    name: "Batalha dos Mares",
    mode: "4v4 • Modo Clássico",
    date: "26 Abr 2026",
    time: "19:00 BRT",
    spots: "4/8 vagas",
    status: "inscricoes",
    prize: "Rank Lendário + Skin",
    color: "#4a9eff",
  },
  {
    name: "Duelo de Capitães",
    mode: "1v1 • Navio Sloop",
    date: "03 Mai 2026",
    time: "21:00 BRT",
    spots: "12/32 vagas",
    status: "em_breve",
    prize: "Troféu + Coronel de Honra",
    color: "#c9a227",
  },
  {
    name: "Grande Torneio Mensal",
    mode: "4v4 • Eliminatórias",
    date: "10 Mai 2026",
    time: "18:00 BRT",
    spots: "Abertura em 01/05",
    status: "em_breve",
    prize: "Prêmio Especial + Rank S",
    color: "#e05c5c",
  },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  inscricoes: { label: "Inscrições Abertas", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  em_breve: { label: "Em Breve", color: "text-[#c9a227] bg-[#c9a227]/10 border-[#c9a227]/30" },
  encerrado: { label: "Encerrado", color: "text-gray-400 bg-gray-400/10 border-gray-400/30" },
};

export function Tournaments() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="tournaments" className="relative py-24 bg-[#070f1e] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />

      {/* Background image overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-5"
        style={{ backgroundImage: `url(${tournamentsImage})` }}
      />
      <div className="absolute inset-0 bg-[#070f1e]/90" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-[1px] w-12 bg-[#c9a227]" />
            <span
              className="text-[#c9a227] tracking-[0.4em] text-xs uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Competições
            </span>
            <div className="h-[1px] w-12 bg-[#c9a227]" />
          </div>
          <h2
            className="text-white text-4xl sm:text-5xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            Torneios
          </h2>
          <p
            className="text-[#8a7a50] max-w-xl mx-auto"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            Inscreva-se nos próximos torneios e prove que sua tripulação domina
            os mares mais perigosos.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {tournaments.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i }}
              className="relative border border-[#c9a227]/15 bg-[#060d1a] hover:border-[#c9a227]/40 transition-all duration-300 group rounded-sm overflow-hidden"
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: `linear-gradient(to right, transparent, ${t.color}, transparent)` }}
              />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3
                      className="text-white text-lg mb-1"
                      style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
                    >
                      {t.name}
                    </h3>
                    <p
                      className="text-[#8a7a50] text-sm"
                      style={{ fontFamily: "'Lato', sans-serif" }}
                    >
                      {t.mode}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-sm border ${statusLabels[t.status].color}`}
                    style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
                  >
                    {statusLabels[t.status].label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#c9a227]" />
                    <span className="text-[#d4c9a0] text-xs" style={{ fontFamily: "'Lato', sans-serif" }}>
                      {t.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#c9a227]" />
                    <span className="text-[#d4c9a0] text-xs" style={{ fontFamily: "'Lato', sans-serif" }}>
                      {t.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-[#c9a227]" />
                    <span className="text-[#d4c9a0] text-xs" style={{ fontFamily: "'Lato', sans-serif" }}>
                      {t.spots}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#c9a227]/10 pt-4 flex items-center justify-between">
                  <div>
                    <span className="text-[#8a7a50] text-xs" style={{ fontFamily: "'Lato', sans-serif" }}>
                      Prêmio:{" "}
                    </span>
                    <span className="text-[#c9a227] text-xs" style={{ fontFamily: "'Cinzel', serif" }}>
                      {t.prize}
                    </span>
                  </div>
                  {t.status === "inscricoes" && (
                    <button
                      className="flex items-center gap-1 text-[#c9a227] text-xs hover:text-white transition-colors group-hover:underline"
                      style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
                    >
                      INSCREVER <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mt-10"
        >
          <button
            className="px-8 py-3 border border-[#c9a227]/40 text-[#c9a227] hover:bg-[#c9a227]/10 transition-all duration-300 rounded-sm"
            style={{ fontFamily: "'Cinzel', serif", fontSize: "0.8rem", letterSpacing: "0.2em" }}
          >
            VER TODOS OS TORNEIOS
          </button>
        </motion.div>
      </div>
    </section>
  );
}

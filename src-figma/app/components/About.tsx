import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { Sword, Shield, Trophy, Users } from "lucide-react";

const islandImage = "https://images.unsplash.com/photo-1631547537962-08c6b4e8e900?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaXJhdGUlMjBhZHZlbnR1cmUlMjB0cm9waWNhbCUyMGlzbGFuZCUyMGNhcmliYmVhbnxlbnwxfHx8fDE3NzU3ODQxODF8MA&ixlib=rb-4.1.0&q=80&w=1080";

const features = [
  {
    icon: Sword,
    title: "Batalhas PvP",
    description:
      "Confronte outros piratas em duelos épicos nos mares traiçoeiros. Mostre sua habilidade com canhões, espadas e habilidade de navegação.",
  },
  {
    icon: Shield,
    title: "Equipes Organizadas",
    description:
      "Monte sua tripulação e desenvolva estratégias para dominar a arena. O trabalho em equipe é a chave para a vitória.",
  },
  {
    icon: Trophy,
    title: "Campeonatos",
    description:
      "Participe de torneios regulares com prêmios exclusivos. Prove que sua tripulação é a mais temida dos sete mares.",
  },
  {
    icon: Users,
    title: "Comunidade Ativa",
    description:
      "Faça parte de uma comunidade apaixonada de piratas brasileiros. Eventos, sessões de treinamento e muito mais.",
  },
];

export function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="relative py-24 bg-[#060d1a] overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a227' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
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
              Sobre a Arena
            </span>
            <div className="h-[1px] w-12 bg-[#c9a227]" />
          </div>
          <h2
            className="text-white text-4xl sm:text-5xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            O Mar Nos Chama
          </h2>
          <p
            className="text-[#8a7a50] max-w-2xl mx-auto text-base"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            A Madness Arena é uma comunidade brasileira dedicada a elevar a
            experiência competitiva no Sea of Thieves a um novo nível de intensidade.
          </p>
        </motion.div>

        {/* Content: image + text */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-sm overflow-hidden border border-[#c9a227]/20">
              <img
                src={islandImage}
                alt="Pirate adventure"
                className="w-full h-72 sm:h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a]/80 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#060d1a]/40 to-transparent" />
            </div>
            {/* Decorative border corners */}
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-[#c9a227]" />
            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-[#c9a227]" />
            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-[#c9a227]" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#c9a227]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h3
              className="text-[#c9a227] text-2xl sm:text-3xl mb-6"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Onde os Lendas São Forjados
            </h3>
            <div className="space-y-4" style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}>
              <p className="text-[#d4c9a0] leading-relaxed">
                Nacida do desejo de criar experiências competitivas únicas no Sea of Thieves,
                a Madness Arena é o lar de piratas que buscam mais do que aventura —
                buscam a glória.
              </p>
              <p className="text-[#8a7a50] leading-relaxed">
                Com regras personalizadas, modos de jogo exclusivos e um sistema de ranking
                próprio, nossa arena oferece o ambiente perfeito para quem quer dominar
                os mares e se tornar uma lenda.
              </p>
              <p className="text-[#8a7a50] leading-relaxed">
                Junte-se a centenas de piratas brasileiros e escreva sua história nos
                anais da Madness Arena.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {["PvP Competitivo", "Eventos Semanais", "Ranking Exclusivo", "Comunidade BR"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 border border-[#c9a227]/30 text-[#c9a227]/70 text-xs rounded-sm"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              className="relative p-6 border border-[#c9a227]/10 bg-[#0a1628] hover:border-[#c9a227]/40 transition-all duration-300 group rounded-sm"
            >
              <div className="w-12 h-12 bg-[#c9a227]/10 rounded-sm flex items-center justify-center mb-4 group-hover:bg-[#c9a227]/20 transition-colors">
                <feature.icon size={22} className="text-[#c9a227]" />
              </div>
              <h4
                className="text-white text-sm mb-3"
                style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
              >
                {feature.title}
              </h4>
              <p
                className="text-[#8a7a50] text-sm leading-relaxed"
                style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
              >
                {feature.description}
              </p>
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-[inset_0_0_30px_rgba(201,162,39,0.05)]" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { MessageSquare, UserPlus, Gamepad2, Star } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    number: "01",
    title: "Entre no Discord",
    description:
      "Acesse nosso servidor no Discord e leia as regras da arena. Nossa comunidade é acolhedora e está sempre pronta para receber novos piratas.",
    action: "Entrar no Discord",
    link: "#",
  },
  {
    icon: UserPlus,
    number: "02",
    title: "Crie seu Perfil",
    description:
      "Registre seu Gamertag e forme ou junte-se a uma tripulação. Escolha seu navio e defina sua estratégia de combate.",
    action: "Registrar Agora",
    link: "#",
  },
  {
    icon: Gamepad2,
    number: "03",
    title: "Dispute na Arena",
    description:
      "Inscreva-se nos torneios, participe dos eventos semanais e batalhe contra outras tripulações para subir no ranking.",
    action: "Ver Torneios",
    link: "#tournaments",
  },
  {
    icon: Star,
    number: "04",
    title: "Conquiste a Glória",
    description:
      "Acumule pontos, suba no ranking e conquiste títulos e skins exclusivas da Madness Arena. Torne-se uma lenda.",
    action: "Ver Ranking",
    link: "#ranking",
  },
];

const rules = [
  "Respeito entre todos os participantes é obrigatório",
  "Uso de hacks ou exploits resulta em banimento permanente",
  "Os confrontos devem ser gravados para eventuais contestações",
  "Tempo máximo de 10 minutos por partida no modo duelo",
  "Tripulações devem ter no mínimo 2 e no máximo 4 membros",
  "Inscrições devem ser feitas com pelo menos 24h de antecedência",
  "Decisões dos árbitros são finais e irrevogáveis",
  "Em caso de empate técnico, será realizado uma rodada desempate",
];

export function HowToJoin() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-to" className="relative py-24 bg-[#070f1e] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />

      {/* BG pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(201,162,39,0.06)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(74,158,255,0.06)_0%,transparent_60%)]" />
      </div>

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
              Guia do Pirata
            </span>
            <div className="h-[1px] w-12 bg-[#c9a227]" />
          </div>
          <h2
            className="text-white text-4xl sm:text-5xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            Como Participar
          </h2>
          <p
            className="text-[#8a7a50] max-w-xl mx-auto"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            Siga os passos abaixo e embarque na aventura mais intensa do Sea of Thieves.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 relative">
          {/* Connecting line on desktop */}
          <div className="hidden lg:block absolute top-8 left-[12%] right-[12%] h-[1px] bg-gradient-to-r from-[#c9a227]/20 via-[#c9a227]/60 to-[#c9a227]/20" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 * i }}
              className="relative flex flex-col"
            >
              {/* Icon circle */}
              <div className="relative z-10 flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full border-2 border-[#c9a227] bg-[#060d1a] flex items-center justify-center shadow-[0_0_20px_rgba(201,162,39,0.3)]">
                  <step.icon size={24} className="text-[#c9a227]" />
                </div>
              </div>

              <div className="flex-1 text-center p-5 border border-[#c9a227]/15 bg-[#060d1a] rounded-sm">
                <div
                  className="text-[#c9a227]/30 text-4xl mb-2"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {step.number}
                </div>
                <h3
                  className="text-white text-sm mb-3"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[#8a7a50] text-sm leading-relaxed mb-5"
                  style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
                >
                  {step.description}
                </p>
                <a
                  href={step.link}
                  className="text-[#c9a227] text-xs hover:text-white transition-colors underline underline-offset-2"
                  style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
                >
                  {step.action} →
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Rules section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="border border-[#c9a227]/15 bg-[#060d1a] rounded-sm overflow-hidden"
        >
          <div className="p-6 border-b border-[#c9a227]/15 bg-[#0a1628]">
            <h3
              className="text-[#c9a227] text-center"
              style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: "1.2rem" }}
            >
              Código do Pirata — Regras da Arena
            </h3>
          </div>
          <div className="p-8 grid sm:grid-cols-2 gap-3">
            {rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[#c9a227] mt-0.5 shrink-0">⚓</span>
                <p
                  className="text-[#d4c9a0] text-sm leading-relaxed"
                  style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
                >
                  {rule}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

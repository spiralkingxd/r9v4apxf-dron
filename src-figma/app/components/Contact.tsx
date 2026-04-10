import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { MessageSquare, Youtube, Twitter, Instagram } from "lucide-react";

const socials = [
  {
    icon: MessageSquare,
    label: "Discord",
    handle: "discord.gg/madnessarena",
    color: "#5865F2",
    description: "Nosso servidor principal. Entre e faça parte da comunidade!",
    cta: "Entrar no Discord",
  },
  {
    icon: Youtube,
    label: "YouTube",
    handle: "@MadnessArena",
    color: "#FF0000",
    description: "Highlights, torneios ao vivo e replays das melhores batalhas.",
    cta: "Assistir",
  },
  {
    icon: Twitter,
    label: "Twitter / X",
    handle: "@MadnessArenaBR",
    color: "#1DA1F2",
    description: "Atualizações em tempo real, anúncios de torneios e muito mais.",
    cta: "Seguir",
  },
  {
    icon: Instagram,
    label: "Instagram",
    handle: "@madnessarenabr",
    color: "#E1306C",
    description: "Fotos épicas, stories das batalhas e bastidores da arena.",
    cta: "Seguir",
  },
];

export function Contact() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="contact" className="relative py-24 bg-[#070f1e] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />

      {/* BG glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,162,39,0.06)_0%,transparent_70%)]" />

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
              Comunidade
            </span>
            <div className="h-[1px] w-12 bg-[#c9a227]" />
          </div>
          <h2
            className="text-white text-4xl sm:text-5xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            Nos Encontre
          </h2>
          <p
            className="text-[#8a7a50] max-w-xl mx-auto"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            A Madness Arena vive e respira através de sua comunidade. Conecte-se
            conosco e não perca nenhuma novidade.
          </p>
        </motion.div>

        {/* Social cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {socials.map((social, i) => (
            <motion.div
              key={social.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i }}
              className="group relative border border-[#c9a227]/15 bg-[#060d1a] p-6 rounded-sm hover:border-[#c9a227]/40 transition-all duration-300 flex flex-col items-center text-center"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${social.color}15`, border: `1px solid ${social.color}40` }}
              >
                <social.icon size={24} style={{ color: social.color }} />
              </div>
              <div
                className="text-white text-sm mb-1"
                style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
              >
                {social.label}
              </div>
              <div
                className="text-[#8a7a50] text-xs mb-3"
                style={{ fontFamily: "'Lato', sans-serif" }}
              >
                {social.handle}
              </div>
              <p
                className="text-[#8a7a50] text-xs leading-relaxed mb-5 flex-1"
                style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
              >
                {social.description}
              </p>
              <button
                className="text-xs px-4 py-2 border rounded-sm transition-all duration-200 hover:opacity-80"
                style={{
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: "0.1em",
                  color: social.color,
                  borderColor: `${social.color}40`,
                }}
              >
                {social.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative border border-[#c9a227]/20 bg-[#060d1a] rounded-sm overflow-hidden text-center py-14 px-6"
        >
          {/* Decorative corners */}
          <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#c9a227]/40" />
          <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-[#c9a227]/40" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-[#c9a227]/40" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#c9a227]/40" />

          <div
            className="text-[#c9a227] text-3xl sm:text-4xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            ⚔ Pronto para Zarpar? ⚔
          </div>
          <p
            className="text-[#8a7a50] max-w-lg mx-auto mb-8"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            Os mares chamam. Junte-se à Madness Arena e escreva seu nome na história
            dos piratas mais lendários do Sea of Thieves.
          </p>
          <button
            className="px-10 py-4 bg-[#c9a227] text-[#060d1a] hover:bg-[#e0b830] transition-all duration-300 rounded-sm shadow-[0_0_40px_rgba(201,162,39,0.4)] hover:shadow-[0_0_60px_rgba(201,162,39,0.6)]"
            style={{ fontFamily: "'Cinzel', serif", fontSize: "0.9rem", letterSpacing: "0.2em" }}
          >
            ⚓ ENTRAR NA ARENA AGORA
          </button>
        </motion.div>
      </div>
    </section>
  );
}

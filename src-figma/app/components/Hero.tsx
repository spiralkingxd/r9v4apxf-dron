import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";

const heroImage = "https://images.unsplash.com/photo-1762119594516-074b5a0bd683?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaXJhdGUlMjBzaGlwJTIwb2NlYW4lMjBzZWElMjBiYXR0bGV8ZW58MXx8fHwxNzc1Nzg0MTc4fDA&ixlib=rb-4.1.0&q=80&w=1080";

export function Hero() {
  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      {/* Dark overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060d1a]/80 via-[#060d1a]/50 to-[#060d1a]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#060d1a]/60 via-transparent to-[#060d1a]/60" />

      {/* Animated fog */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#060d1a] to-transparent" />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-[#c9a227] rounded-full opacity-60"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Tag line */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center justify-center gap-3 mb-6"
        >
          <div className="h-[1px] w-16 bg-[#c9a227]" />
          <span
            className="text-[#c9a227] tracking-[0.4em] text-xs uppercase"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Sea of Thieves • Arena Customizada
          </span>
          <div className="h-[1px] w-16 bg-[#c9a227]" />
        </motion.div>

        {/* Main title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          <h1
            style={{ fontFamily: "'Cinzel Decorative', serif", letterSpacing: "0.08em", lineHeight: "1.1" }}
            className="text-white mb-2"
          >
            <span className="block text-5xl sm:text-7xl lg:text-8xl text-[#c9a227] drop-shadow-[0_0_40px_rgba(201,162,39,0.5)]">
              MADNESS
            </span>
            <span className="block text-4xl sm:text-6xl lg:text-7xl">
              ARENA
            </span>
          </h1>
        </motion.div>

        {/* Divider ornament */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex items-center justify-center gap-4 my-6"
        >
          <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-[#c9a227]" />
          <span className="text-[#c9a227] text-2xl">⚓</span>
          <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-[#c9a227]" />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="text-[#d4c9a0] text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
        >
          A arena mais intensa do Mar dos Ladrões. Batalhas épicas, tesouros em jogo
          e piratas destemidos se enfrentando pelos mares da glória.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={() => scrollTo("#how-to")}
            className="px-8 py-4 bg-[#c9a227] text-[#060d1a] hover:bg-[#e0b830] transition-all duration-300 rounded-sm shadow-[0_0_30px_rgba(201,162,39,0.4)] hover:shadow-[0_0_50px_rgba(201,162,39,0.6)]"
            style={{ fontFamily: "'Cinzel', serif", fontSize: "0.85rem", letterSpacing: "0.2em" }}
          >
            ⚔ PARTICIPAR AGORA
          </button>
          <button
            onClick={() => scrollTo("#about")}
            className="px-8 py-4 border-2 border-[#c9a227]/60 text-[#d4c9a0] hover:border-[#c9a227] hover:text-[#c9a227] transition-all duration-300 rounded-sm"
            style={{ fontFamily: "'Cinzel', serif", fontSize: "0.85rem", letterSpacing: "0.2em" }}
          >
            SAIBA MAIS
          </button>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto"
        >
          {[
            { value: "500+", label: "Piratas" },
            { value: "120+", label: "Batalhas" },
            { value: "50+", label: "Torneios" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="text-[#c9a227] text-2xl sm:text-3xl"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {stat.value}
              </div>
              <div
                className="text-[#8a7a50] text-xs tracking-widest uppercase mt-1"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.button
        onClick={() => scrollTo("#about")}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[#c9a227]/60 hover:text-[#c9a227] transition-colors"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown size={32} />
      </motion.button>
    </section>
  );
}

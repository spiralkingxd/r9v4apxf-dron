import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef } from "react";

const shipImage = "https://images.unsplash.com/photo-1762119594516-074b5a0bd683?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaXJhdGUlMjBzaGlwJTIwb2NlYW4lMjBzZWElMjBiYXR0bGV8ZW58MXx8fHwxNzc1Nzg0MTc4fDA&ixlib=rb-4.1.0&q=80&w=1080";
const treasureImage = "https://images.unsplash.com/photo-1636331778975-b829714918d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaXJhdGUlMjB0cmVhc3VyZSUyMGdvbGQlMjBjb2lucyUyMHNrdWxsfGVufDF8fHx8MTc3NTc4NDE3OHww&ixlib=rb-4.1.0&q=80&w=1080";
const stormImage = "https://images.unsplash.com/photo-1766759622568-e27b4128af95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwb2NlYW4lMjBuaWdodCUyMHN0b3JteSUyMHdhdmVzfGVufDF8fHx8MTc3NTc4NDE4MXww&ixlib=rb-4.1.0&q=80&w=1080";

const galleryItems = [
  {
    image: shipImage,
    title: "Batalha dos Galeões",
    category: "PvP",
    span: "col-span-2 row-span-2",
  },
  {
    image: treasureImage,
    title: "Tesouro Lendário",
    category: "Recompensas",
    span: "col-span-1 row-span-1",
  },
  {
    image: stormImage,
    title: "Mar Tempestuoso",
    category: "Ambiente",
    span: "col-span-1 row-span-1",
  },
];

export function Gallery() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-24 bg-[#060d1a] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              Galeria
            </span>
            <div className="h-[1px] w-12 bg-[#c9a227]" />
          </div>
          <h2
            className="text-white text-4xl sm:text-5xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            Os Sete Mares
          </h2>
          <p
            className="text-[#8a7a50] max-w-xl mx-auto"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            Registros épicos das batalhas mais memoráveis da Madness Arena.
          </p>
        </motion.div>

        {/* Gallery grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 auto-rows-[220px]">
          {galleryItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i }}
              className={`relative overflow-hidden group rounded-sm border border-[#c9a227]/15 cursor-pointer ${item.span}`}
            >
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a]/90 via-[#060d1a]/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <span
                  className="text-[#c9a227] text-xs mb-2 tracking-widest"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {item.category}
                </span>
                <h3
                  className="text-white translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: i === 0 ? "1.5rem" : "1rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.title}
                </h3>
              </div>
              {/* Hover border glow */}
              <div className="absolute inset-0 border border-[#c9a227]/0 group-hover:border-[#c9a227]/40 transition-all duration-300 rounded-sm" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

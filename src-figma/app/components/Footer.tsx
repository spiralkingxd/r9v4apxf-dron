import { Anchor } from "lucide-react";

export function Footer() {
  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const links = [
    { label: "Início", href: "#hero" },
    { label: "Sobre", href: "#about" },
    { label: "Torneios", href: "#tournaments" },
    { label: "Ranking", href: "#ranking" },
    { label: "Como Jogar", href: "#how-to" },
    { label: "Contato", href: "#contact" },
  ];

  return (
    <footer className="relative bg-[#040a14] border-t border-[#c9a227]/15 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-2">
            <Anchor size={32} className="text-[#c9a227]" />
            <div className="text-center">
              <div
                style={{ fontFamily: "'Cinzel Decorative', serif" }}
                className="text-[#c9a227] text-xl tracking-widest"
              >
                MADNESS
              </div>
              <div
                style={{ fontFamily: "'Cinzel', serif" }}
                className="text-white text-sm tracking-[0.4em]"
              >
                ARENA
              </div>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-[#8a7a50] hover:text-[#c9a227] text-xs tracking-wider transition-colors"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#c9a227]/20 to-transparent" />

          {/* Bottom text */}
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 text-center">
            <p
              className="text-[#8a7a50] text-xs"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
            >
              © 2026 Madness Arena. Todos os direitos reservados.
            </p>
            <p
              className="text-[#8a7a50] text-xs"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
            >
              Sea of Thieves™ é marca registrada da Rare Ltd. / Xbox Game Studios.
            </p>
            <p
              className="text-[#8a7a50] text-xs"
              style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
            >
              Feito com ⚓ pela comunidade BR
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

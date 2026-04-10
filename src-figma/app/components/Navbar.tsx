import { useState, useEffect } from "react";
import { Menu, X, Anchor } from "lucide-react";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { label: "Início", href: "#hero" },
    { label: "Sobre", href: "#about" },
    { label: "Torneios", href: "#tournaments" },
    { label: "Ranking", href: "#ranking" },
    { label: "Como Jogar", href: "#how-to" },
    { label: "Contato", href: "#contact" },
  ];

  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setIsOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#060d1a]/95 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-[#c9a227]/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <button
            onClick={() => scrollTo("#hero")}
            className="flex items-center gap-2 group"
          >
            <div className="relative">
              <Anchor
                size={28}
                className="text-[#c9a227] group-hover:rotate-12 transition-transform duration-300"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span
                style={{ fontFamily: "'Cinzel Decorative', serif" }}
                className="text-[#c9a227] text-lg tracking-widest"
              >
                MADNESS
              </span>
              <span
                style={{ fontFamily: "'Cinzel', serif" }}
                className="text-white text-xs tracking-[0.3em] -mt-1"
              >
                ARENA
              </span>
            </div>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                style={{ fontFamily: "'Cinzel', serif" }}
                className="text-[#d4c9a0] hover:text-[#c9a227] text-sm tracking-wider transition-colors duration-200 relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#c9a227] group-hover:w-full transition-all duration-300" />
              </button>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <button
              onClick={() => scrollTo("#how-to")}
              className="px-6 py-2 border-2 border-[#c9a227] text-[#c9a227] hover:bg-[#c9a227] hover:text-[#060d1a] transition-all duration-300 rounded-sm"
              style={{ fontFamily: "'Cinzel', serif", fontSize: "0.8rem", letterSpacing: "0.15em" }}
            >
              ENTRAR NA ARENA
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-[#c9a227]"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-[#060d1a]/98 backdrop-blur-md border-t border-[#c9a227]/20">
          <div className="px-6 py-4 flex flex-col gap-4">
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                style={{ fontFamily: "'Cinzel', serif" }}
                className="text-[#d4c9a0] hover:text-[#c9a227] text-sm tracking-wider text-left transition-colors"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo("#how-to")}
              className="mt-2 px-6 py-2 border-2 border-[#c9a227] text-[#c9a227] hover:bg-[#c9a227] hover:text-[#060d1a] transition-all duration-300 rounded-sm w-full"
              style={{ fontFamily: "'Cinzel', serif", fontSize: "0.8rem", letterSpacing: "0.15em" }}
            >
              ENTRAR NA ARENA
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

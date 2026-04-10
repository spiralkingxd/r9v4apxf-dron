import { motion } from "motion/react";
import { useInView } from "motion/react";
import { useRef, useState } from "react";
import { Crown, Skull, Anchor } from "lucide-react";

const players = [
  { rank: 1, name: "KrakenSlayer", crew: "Os Sem Misericórdia", points: 4850, wins: 42, losses: 8, kd: "5.2", badge: "Lendário" },
  { rank: 2, name: "BlackPearl_BR", crew: "Corvos do Mar", points: 4520, wins: 38, losses: 11, kd: "4.7", badge: "Lendário" },
  { rank: 3, name: "TempestadeEternal", crew: "Tempestade Negra", points: 4210, wins: 35, losses: 12, kd: "4.1", badge: "Diamante" },
  { rank: 4, name: "GoldHunter_", crew: "Caçadores de Ouro", points: 3980, wins: 33, losses: 14, kd: "3.8", badge: "Diamante" },
  { rank: 5, name: "SirPiratico", crew: "Os Sem Misericórdia", points: 3760, wins: 31, losses: 15, kd: "3.5", badge: "Diamante" },
  { rank: 6, name: "MarFundoZ", crew: "Maré Alta", points: 3540, wins: 29, losses: 16, kd: "3.2", badge: "Platina" },
  { rank: 7, name: "CannibalCrew", crew: "Corvos do Mar", points: 3310, wins: 27, losses: 17, kd: "2.9", badge: "Platina" },
  { rank: 8, name: "Boneyard_BR", crew: "Sombras do Abismo", points: 3080, wins: 25, losses: 18, kd: "2.7", badge: "Platina" },
  { rank: 9, name: "MermaidKiller", crew: "Maré Alta", points: 2850, wins: 23, losses: 19, kd: "2.4", badge: "Ouro" },
  { rank: 10, name: "Abyssal_Lord", crew: "Sombras do Abismo", points: 2620, wins: 21, losses: 20, kd: "2.1", badge: "Ouro" },
];

const badges: Record<string, { color: string; bg: string }> = {
  Lendário: { color: "text-yellow-300", bg: "bg-yellow-300/10 border-yellow-300/30" },
  Diamante: { color: "text-cyan-300", bg: "bg-cyan-300/10 border-cyan-300/30" },
  Platina: { color: "text-purple-300", bg: "bg-purple-300/10 border-purple-300/30" },
  Ouro: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30" },
};

const rankIcons: Record<number, JSX.Element> = {
  1: <Crown size={18} className="text-yellow-400" />,
  2: <Crown size={16} className="text-gray-300" />,
  3: <Crown size={16} className="text-amber-600" />,
};

export function Ranking() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState<"geral" | "equipes">("geral");

  const crews = [
    { rank: 1, name: "Os Sem Misericórdia", members: 8, points: 9610, wins: 73 },
    { rank: 2, name: "Corvos do Mar", members: 7, points: 7830, wins: 65 },
    { rank: 3, name: "Sombras do Abismo", members: 6, points: 5930, wins: 46 },
    { rank: 4, name: "Tempestade Negra", members: 5, points: 4210, wins: 35 },
    { rank: 5, name: "Maré Alta", members: 6, points: 6390, wins: 52 },
  ];

  return (
    <section id="ranking" className="relative py-24 bg-[#060d1a] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a227]/40 to-transparent" />

      {/* Decorative skulls */}
      <div className="absolute left-4 top-1/4 opacity-5">
        <Skull size={200} className="text-[#c9a227]" />
      </div>
      <div className="absolute right-4 bottom-1/4 opacity-5">
        <Anchor size={200} className="text-[#c9a227]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-[1px] w-12 bg-[#c9a227]" />
            <span
              className="text-[#c9a227] tracking-[0.4em] text-xs uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Placar
            </span>
            <div className="h-[1px] w-12 bg-[#c9a227]" />
          </div>
          <h2
            className="text-white text-4xl sm:text-5xl mb-4"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            Ranking
          </h2>
          <p
            className="text-[#8a7a50] max-w-xl mx-auto"
            style={{ fontFamily: "'Lato', sans-serif", fontWeight: 300 }}
          >
            Os piratas mais temidos e respeitados dos setes mares da Madness Arena.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center gap-0 mb-8"
        >
          {[
            { id: "geral", label: "JOGADORES" },
            { id: "equipes", label: "EQUIPES" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "geral" | "equipes")}
              className={`px-8 py-3 text-xs border transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-[#c9a227] text-[#060d1a] border-[#c9a227]"
                  : "border-[#c9a227]/30 text-[#8a7a50] hover:text-[#c9a227] hover:border-[#c9a227]/60"
              }`}
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.15em" }}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="border border-[#c9a227]/15 rounded-sm overflow-hidden"
        >
          {/* Top 3 podium */}
          {activeTab === "geral" && (
            <div className="grid grid-cols-3 gap-0 border-b border-[#c9a227]/15">
              {players.slice(0, 3).map((p, i) => (
                <div
                  key={p.name}
                  className={`p-5 text-center border-r border-[#c9a227]/15 last:border-r-0 ${
                    i === 0 ? "bg-[#c9a227]/5" : "bg-[#0a1628]"
                  }`}
                >
                  <div className="flex justify-center mb-2">{rankIcons[p.rank]}</div>
                  <div
                    className={`text-lg mb-1 ${i === 0 ? "text-[#c9a227]" : i === 1 ? "text-gray-300" : "text-amber-600"}`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    #{p.rank}
                  </div>
                  <div className="text-white text-sm mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                    {p.name}
                  </div>
                  <div className="text-[#8a7a50] text-xs mb-2" style={{ fontFamily: "'Lato', sans-serif" }}>
                    {p.crew}
                  </div>
                  <div
                    className={`text-xs px-2 py-1 border rounded-sm inline-block ${badges[p.badge].bg} ${badges[p.badge].color}`}
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {p.badge}
                  </div>
                  <div
                    className="text-[#c9a227] mt-2"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {p.points.toLocaleString()} pts
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table header */}
          <div className="grid bg-[#0a1628] border-b border-[#c9a227]/15" style={{
            gridTemplateColumns: activeTab === "geral"
              ? "60px 1fr 1fr 80px 80px 80px 80px"
              : "60px 1fr 80px 80px 80px",
          }}>
            {["#", activeTab === "geral" ? "Pirata" : "Equipe", "Guild", activeTab === "geral" ? "K/D" : "Membros", "Vitórias", activeTab === "geral" ? "Derrotas" : "", activeTab === "geral" ? "Pontos" : "Pontos"].filter(Boolean).map((h) => (
              <div
                key={h}
                className="px-4 py-3 text-[#8a7a50] text-xs"
                style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div>
            {activeTab === "geral"
              ? players.map((p, i) => (
                  <div
                    key={p.name}
                    className="grid items-center border-b border-[#c9a227]/8 hover:bg-[#c9a227]/5 transition-colors last:border-b-0"
                    style={{ gridTemplateColumns: "60px 1fr 1fr 80px 80px 80px 80px" }}
                  >
                    <div className="px-4 py-4 flex items-center gap-1">
                      {rankIcons[p.rank] || (
                        <span className="text-[#8a7a50] text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                          {p.rank}
                        </span>
                      )}
                    </div>
                    <div className="px-4 py-4">
                      <div className="text-white text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                        {p.name}
                      </div>
                      <div
                        className={`text-xs mt-1 inline-block px-2 py-0.5 border rounded-sm ${badges[p.badge].bg} ${badges[p.badge].color}`}
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {p.badge}
                      </div>
                    </div>
                    <div className="px-4 py-4 text-[#8a7a50] text-xs" style={{ fontFamily: "'Lato', sans-serif" }}>
                      {p.crew}
                    </div>
                    <div className="px-4 py-4 text-[#4a9eff] text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {p.kd}
                    </div>
                    <div className="px-4 py-4 text-emerald-400 text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {p.wins}
                    </div>
                    <div className="px-4 py-4 text-red-400 text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {p.losses}
                    </div>
                    <div className="px-4 py-4 text-[#c9a227] text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {p.points.toLocaleString()}
                    </div>
                  </div>
                ))
              : crews.sort((a, b) => b.points - a.points).map((c, i) => (
                  <div
                    key={c.name}
                    className="grid items-center border-b border-[#c9a227]/8 hover:bg-[#c9a227]/5 transition-colors last:border-b-0"
                    style={{ gridTemplateColumns: "60px 1fr 80px 80px 80px" }}
                  >
                    <div className="px-4 py-4 flex items-center gap-1">
                      {rankIcons[c.rank] || (
                        <span className="text-[#8a7a50] text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                          {c.rank}
                        </span>
                      )}
                    </div>
                    <div className="px-4 py-4 text-white text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {c.name}
                    </div>
                    <div className="px-4 py-4 text-[#8a7a50] text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {c.members}
                    </div>
                    <div className="px-4 py-4 text-emerald-400 text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {c.wins}
                    </div>
                    <div className="px-4 py-4 text-[#c9a227] text-sm" style={{ fontFamily: "'Cinzel', serif" }}>
                      {c.points.toLocaleString()}
                    </div>
                  </div>
                ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

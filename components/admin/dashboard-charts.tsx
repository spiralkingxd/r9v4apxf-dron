"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type LinePoint = { label: string; total: number };
type PiePoint = { name: string; value: number };

const PIE_COLORS = ["#22d3ee", "#60a5fa", "#34d399", "#f59e0b", "#f43f5e"];

export function DashboardCharts({
  registrations30d,
  usersByMonth,
  teamsByMonth,
  tournamentStatus,
}: {
  registrations30d: LinePoint[];
  usersByMonth: LinePoint[];
  teamsByMonth: LinePoint[];
  tournamentStatus: PiePoint[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="text-base font-semibold text-white">Inscrições nos últimos 30 dias</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={registrations30d}>
              <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} interval={4} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: "rgba(34,211,238,0.35)", strokeWidth: 2 }}
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 10,
                  color: "#e2e8f0",
                }}
              />
              <Line type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="text-base font-semibold text-white">Status dos torneios</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={tournamentStatus} dataKey="value" nameKey="name" outerRadius={100} innerRadius={45}>
                {tournamentStatus.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 10,
                  color: "#e2e8f0",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="text-base font-semibold text-white">Novos usuários por mês</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usersByMonth}>
              <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 10,
                  color: "#e2e8f0",
                }}
              />
              <Bar dataKey="total" fill="#38bdf8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="text-base font-semibold text-white">Equipes criadas por mês</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teamsByMonth}>
              <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 10,
                  color: "#e2e8f0",
                }}
              />
              <Bar dataKey="total" fill="#34d399" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

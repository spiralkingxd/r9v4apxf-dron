"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminChart } from "@/components/admin/admin-chart";

type LinePoint = { label: string; total: number };
type PiePoint = { name: string; value: number };

const PIE_COLORS = ["#22d3ee", "#60a5fa", "#34d399", "#f59e0b", "#f43f5e"];

export function DashboardCharts({ weeklyUsers, monthlyTeams, tournamentStatus }: {
  weeklyUsers: LinePoint[];
  monthlyTeams: LinePoint[];
  tournamentStatus: PiePoint[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <AdminChart title="Novos usuarios por semana" subtitle="Ultimas 8 semanas" className="lg:col-span-2">
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyUsers}>
              <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
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
              <Area type="monotone" dataKey="total" stroke="#22d3ee" fill="rgba(34,211,238,0.25)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </AdminChart>

      <AdminChart title="Status dos torneios" subtitle="Ativos, finalizados e planejamento">
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
      </AdminChart>

      <AdminChart title="Equipes criadas por mes" subtitle="Ultimos 6 meses" className="lg:col-span-3">
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTeams}>
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
      </AdminChart>
    </div>
  );
}

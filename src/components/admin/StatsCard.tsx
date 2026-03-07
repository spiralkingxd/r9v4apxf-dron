import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function StatsCard({ title, value, icon: Icon, description, trend }: StatsCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <Icon className="h-4 w-4 text-emerald-500" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100">{value}</div>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center mt-2 text-xs ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            <span className="font-medium">{trend.value > 0 ? '+' : ''}{trend.value}%</span>
            <span className="ml-1 text-slate-500">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

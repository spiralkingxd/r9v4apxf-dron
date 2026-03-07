import { useEffect, useState } from 'react';
import { Users, Shield, Trophy, Swords, AlertTriangle } from 'lucide-react';
import { StatsCard } from '../../components/admin/StatsCard';
import api from '../../lib/api';

interface DashboardStats {
  users: number;
  teams: number;
  events: number;
  matches: number;
  pendingReports: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/admin/stats');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-slate-400">Loading stats...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Dashboard Overview</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Users" 
          value={stats?.users || 0} 
          icon={Users} 
          description="Registered players"
        />
        <StatsCard 
          title="Active Teams" 
          value={stats?.teams || 0} 
          icon={Shield} 
          description="Ready for battle"
        />
        <StatsCard 
          title="Events" 
          value={stats?.events || 0} 
          icon={Trophy} 
          description="Tournaments hosted"
        />
        <StatsCard 
          title="Matches Played" 
          value={stats?.matches || 0} 
          icon={Swords} 
          description="Total games recorded"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 col-span-2">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                <p className="text-sm text-slate-300">New team "Black Pearl" registered</p>
              </div>
              <span className="text-xs text-slate-500">2 min ago</span>
            </div>
            {/* More items... */}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            Pending Actions
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div>
                <p className="text-sm font-medium text-slate-200">Pending Reports</p>
                <p className="text-xs text-slate-500">{stats?.pendingReports || 0} unresolved</p>
              </div>
              <button className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors">
                Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

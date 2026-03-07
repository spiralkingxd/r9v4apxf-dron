import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Trophy, 
  Swords, 
  AlertTriangle, 
  Settings, 
  FileText 
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function AdminSidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  const links = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/teams', icon: Shield, label: 'Teams' },
    { href: '/admin/events', icon: Trophy, label: 'Events' },
    { href: '/admin/matches', icon: Swords, label: 'Matches' },
    { href: '/admin/reports', icon: AlertTriangle, label: 'Reports' },
    { href: '/admin/logs', icon: FileText, label: 'Logs' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-emerald-400 tracking-wider">
          MADNESS<span className="text-slate-100">ARENA</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Admin Panel</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors group",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <link.icon className={cn("mr-3 h-5 w-5", isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300")} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AdminHeader() {
  const { user } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-30">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 w-64"
          />
        </div>

        <button className="relative p-2 text-slate-400 hover:text-slate-100 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
        </button>

        <div className="flex items-center space-x-3 pl-4 border-l border-slate-800">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-slate-200">{user?.user_metadata?.full_name || 'Admin'}</p>
            <p className="text-xs text-slate-500 capitalize">Administrator</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

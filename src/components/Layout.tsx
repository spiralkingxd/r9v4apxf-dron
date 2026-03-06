import { Link, Outlet, useLocation } from 'react-router-dom';
import { Anchor, Skull, Trophy, Calendar, Users, Swords, LogIn, LogOut, UserCircle, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const location = useLocation();
  const { user, login, logout, isAdmin } = useAuth();

  const navItems = [
    { path: '/', label: 'Home', icon: <Anchor className="w-5 h-5" /> },
    { path: '/teams', label: 'Equipes', icon: <Users className="w-5 h-5" /> },
    { path: '/events', label: 'Eventos', icon: <Calendar className="w-5 h-5" /> },
    { path: '/brackets', label: 'Chaveamento', icon: <Swords className="w-5 h-5" /> },
    { path: '/leaderboard', label: 'Ranking', icon: <Trophy className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="glass-panel sticky top-0 z-50 border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center space-x-3 group">
              <Skull className="w-8 h-8 text-gold group-hover:text-gold-light transition-colors" />
              <span className="font-serif text-2xl font-bold text-gradient-gold tracking-wider hidden sm:block">
                Madness Arena
              </span>
            </Link>

            <nav className="hidden lg:flex space-x-6">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? 'text-gold bg-ocean-lighter/50 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                        : 'text-parchment-muted hover:text-gold hover:bg-ocean-lighter/30'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-red-900/30 border border-red-500/30 text-red-400 rounded-md text-sm font-medium hover:bg-red-900/50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Admin</span>
                    </Link>
                  )}
                  <Link
                    to="/dashboard"
                    className="flex items-center space-x-2 px-3 py-2 bg-ocean-lighter/50 border border-gold/20 text-parchment rounded-md text-sm font-medium hover:bg-ocean-lighter transition-colors"
                  >
                    {user.avatar ? (
                      <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="Avatar" className="w-6 h-6 rounded-full" />
                    ) : (
                      <UserCircle className="w-5 h-5 text-gold" />
                    )}
                    <span className="hidden sm:block">{user.username}</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="p-2 text-parchment-muted hover:text-red-400 transition-colors"
                    title="Sair"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-md text-sm font-medium transition-colors shadow-lg"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:block">Entrar com Discord</span>
                  <span className="sm:hidden">Entrar</span>
                </button>
              )}
              
              {/* Mobile menu button */}
              <div className="lg:hidden flex items-center">
                <button className="text-parchment hover:text-gold p-2">
                  <Anchor className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="glass-panel border-t border-gold/20 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Skull className="w-5 h-5 text-gold" />
              <span className="font-serif text-lg font-bold text-parchment">Madness Arena</span>
            </div>
            <p className="text-parchment-muted text-sm text-center md:text-left">
              © {new Date().getFullYear()} Madness Arena. Não afiliado à Rare Ltd ou Xbox Game Studios.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-parchment-muted hover:text-gold transition-colors">Discord</a>
              <a href="#" className="text-parchment-muted hover:text-gold transition-colors">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreVertical, Shield, Ban, Edit, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../lib/api';
import { Profile } from '../../services/profile';

export const AdminUsersTable = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [xboxFilter, setXboxFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // In a real app, we would pass filters and pagination to the backend
      const response = await api.get('/admin/users?limit=100');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBan = async (userId: string, isBanned: boolean) => {
    try {
      if (isBanned) {
        await api.post(`/admin/users/${userId}/unban`);
      } else {
        await api.post(`/admin/users/${userId}/ban`);
      }
      fetchUsers();
    } catch (error) {
      console.error('Error toggling ban status:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.discord_id?.includes(searchTerm);
      
    const matchesXbox = 
      xboxFilter === 'all' ? true :
      xboxFilter === 'linked' ? user.xbox_linked :
      !user.xbox_linked;
      
    return matchesSearch && matchesXbox;
  });

  return (
    <div className="glass-panel rounded-2xl border border-gold/20 overflow-hidden">
      <div className="p-6 border-b border-ocean-lighter flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-serif font-bold text-gold uppercase tracking-wider flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Gerenciamento de Usuários
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-parchment-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-ocean-light border border-ocean-lighter rounded-lg text-sm text-parchment focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>
          
          <div className="relative">
            <Filter className="w-4 h-4 text-parchment-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={xboxFilter}
              onChange={(e) => setXboxFilter(e.target.value as any)}
              className="w-full sm:w-auto pl-9 pr-8 py-2 bg-ocean-light border border-ocean-lighter rounded-lg text-sm text-parchment focus:outline-none focus:border-gold/50 transition-colors appearance-none"
            >
              <option value="all">Todos (Xbox)</option>
              <option value="linked">Xbox Vinculado</option>
              <option value="unlinked">Não Vinculado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-ocean-light/50 border-b border-ocean-lighter">
              <th className="p-4 text-xs font-bold text-parchment-muted uppercase tracking-wider">Usuário</th>
              <th className="p-4 text-xs font-bold text-parchment-muted uppercase tracking-wider">Contato</th>
              <th className="p-4 text-xs font-bold text-parchment-muted uppercase tracking-wider">Discord ID</th>
              <th className="p-4 text-xs font-bold text-parchment-muted uppercase tracking-wider">Status Xbox</th>
              <th className="p-4 text-xs font-bold text-parchment-muted uppercase tracking-wider">Cadastro</th>
              <th className="p-4 text-xs font-bold text-parchment-muted uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ocean-lighter">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-parchment-muted">
                  Carregando usuários...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-parchment-muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-ocean-light/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name || user.username}&background=0D1B2A&color=D4AF37`} 
                        alt={user.display_name} 
                        className="w-10 h-10 rounded-full border border-gold/30"
                      />
                      <div>
                        <p className="font-bold text-parchment">{user.display_name || user.username}</p>
                        <p className="text-xs text-gold font-mono">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-parchment-muted truncate max-w-[150px]" title={user.email}>{user.email}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-mono text-parchment-muted bg-ocean-light px-2 py-1 rounded inline-block">
                      {user.discord_id}
                    </p>
                  </td>
                  <td className="p-4">
                    {user.xbox_linked ? (
                      <div className="flex items-center gap-2 text-emerald-400" title="Vínculo via Discord OAuth2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-bold">{user.xbox_gamertag}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-parchment-muted/50">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm">Não vinculado</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-parchment-muted">
                      {new Date(user.registered_at || new Date()).toLocaleDateString('pt-BR')}
                    </p>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        className="p-2 text-parchment-muted hover:text-gold transition-colors rounded-lg hover:bg-ocean-light"
                        title="Ver Perfil"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleBan(user.id, (user as any).is_banned)}
                        className={`p-2 transition-colors rounded-lg hover:bg-ocean-light ${(user as any).is_banned ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'}`}
                        title={(user as any).is_banned ? "Desbanir Usuário" : "Banir Usuário"}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

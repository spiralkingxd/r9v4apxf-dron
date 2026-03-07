import { useEffect, useState } from 'react';
import { AdminTable } from '../../components/admin/AdminTable';
import api from '../../lib/api';
import { MoreHorizontal, UserX, UserCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  discord_id: string;
  is_banned: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', {
        params: { page, limit: 10, search },
      });
      setUsers(data.data);
      setTotalPages(Math.ceil(data.count / 10));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const handleBan = async (userId: string) => {
    if (!window.confirm('Are you sure you want to ban this user?')) return;
    try {
      await api.post(`/admin/users/${userId}/ban`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to ban user:', error);
      alert('Failed to ban user');
    }
  };

  const handleUnban = async (userId: string) => {
    if (!window.confirm('Are you sure you want to unban this user?')) return;
    try {
      await api.post(`/admin/users/${userId}/unban`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to unban user:', error);
      alert('Failed to unban user');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action is irreversible.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const columns = [
    {
      header: 'Usuário',
      accessorKey: 'full_name' as keyof User,
      cell: (user: User) => (
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                {user.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{user.full_name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'ID Discord',
      accessorKey: 'discord_id' as keyof User,
      cell: (user: User) => <span className="font-mono text-xs text-slate-400">{user.discord_id || 'N/A'}</span>,
    },
    {
      header: 'Status',
      accessorKey: 'is_banned' as keyof User,
      cell: (user: User) => (
        user.is_banned ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Banido</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
        )
      ),
    },
    {
      header: 'Entrou em',
      accessorKey: 'created_at' as keyof User,
      cell: (user: User) => <span className="text-xs text-slate-400">{format(new Date(user.created_at), 'd MMM, yyyy')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gerenciamento de Usuários</h1>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Exportar CSV
        </button>
      </div>

      <AdminTable
        data={users}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSearch={setSearch}
        loading={loading}
        searchPlaceholder="Buscar usuários..."
        actions={(user) => (
          <div className="flex justify-end space-x-2">
             {user.is_banned ? (
                <button onClick={() => handleUnban(user.id)} className="text-emerald-400 hover:text-emerald-300 p-1" title="Desbanir">
                  <UserCheck className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={() => handleBan(user.id)} className="text-red-400 hover:text-red-300 p-1" title="Banir">
                  <UserX className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => handleDelete(user.id)} className="text-slate-500 hover:text-red-500 p-1" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
          </div>
        )}
      />
    </div>
  );
}

import { AdminUsersTable } from '../../components/admin/AdminUsersTable';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gerenciamento de Usuários</h1>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Exportar CSV
        </button>
      </div>

      <AdminUsersTable />
    </div>
  );
}

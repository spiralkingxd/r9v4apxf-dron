import { useEffect, useState } from 'react';
import { AdminTable } from '../../components/admin/AdminTable';
import api from '../../lib/api';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Log {
  id: string;
  admin: { full_name: string; email: string };
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/logs', {
        params: { page, limit: 20 },
      });
      setLogs(data.data);
      setTotalPages(Math.ceil(data.count / 20));
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const columns = [
    {
      header: 'Administrador',
      accessorKey: 'admin' as keyof Log,
      cell: (log: Log) => (
        <div>
          <p className="text-sm font-medium text-slate-200">{log.admin?.full_name || 'Sistema'}</p>
          <p className="text-xs text-slate-500">{log.admin?.email}</p>
        </div>
      ),
    },
    {
      header: 'Ação',
      accessorKey: 'action' as keyof Log,
      cell: (log: Log) => <span className="text-sm font-mono text-emerald-400">{log.action}</span>,
    },
    {
      header: 'Alvo',
      cell: (log: Log) => (
        <div className="text-xs text-slate-400">
          <span className="uppercase font-semibold">{log.target_type}</span>
          <span className="ml-2 font-mono">{log.target_id?.slice(0, 8)}...</span>
        </div>
      ),
    },
    {
      header: 'Detalhes',
      accessorKey: 'details' as keyof Log,
      cell: (log: Log) => (
        <pre className="text-xs text-slate-500 max-w-xs overflow-hidden truncate">
          {JSON.stringify(log.details)}
        </pre>
      ),
    },
    {
      header: 'Data',
      accessorKey: 'created_at' as keyof Log,
      cell: (log: Log) => <span className="text-xs text-slate-400">{format(new Date(log.created_at), 'd MMM, HH:mm:ss')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Logs de Auditoria</h1>
      </div>

      <AdminTable
        data={logs}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />
    </div>
  );
}

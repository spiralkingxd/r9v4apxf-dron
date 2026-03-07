import { useEffect, useState } from 'react';
import { AdminTable } from '../../components/admin/AdminTable';
import api from '../../lib/api';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Report {
  id: string;
  reporter: { full_name: string; email: string };
  reported_user: { full_name: string; email: string } | null;
  reported_team: { name: string } | null;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'ignored';
  created_at: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reports', {
        params: { page, limit: 10, status: statusFilter },
      });
      setReports(data.data);
      setTotalPages(Math.ceil(data.count / 10));
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const handleResolve = async (reportId: string, action: string) => {
    const notes = prompt('Resolution notes:');
    if (notes === null) return;

    try {
      await api.post(`/admin/reports/${reportId}/resolve`, {
        resolution_notes: notes,
        action,
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to resolve report:', error);
      alert('Failed to resolve report');
    }
  };

  const columns = [
    {
      header: 'Reporter',
      accessorKey: 'reporter' as keyof Report,
      cell: (report: Report) => (
        <div>
          <p className="text-sm font-medium text-slate-200">{report.reporter?.full_name}</p>
          <p className="text-xs text-slate-500">{report.reporter?.email}</p>
        </div>
      ),
    },
    {
      header: 'Reported Entity',
      cell: (report: Report) => (
        <div>
          {report.reported_user ? (
            <>
              <p className="text-sm font-medium text-slate-200">{report.reported_user.full_name}</p>
              <p className="text-xs text-slate-500">User</p>
            </>
          ) : report.reported_team ? (
            <>
              <p className="text-sm font-medium text-slate-200">{report.reported_team.name}</p>
              <p className="text-xs text-slate-500">Team</p>
            </>
          ) : (
            <span className="text-slate-500">Unknown</span>
          )}
        </div>
      ),
    },
    {
      header: 'Reason',
      accessorKey: 'reason' as keyof Report,
      cell: (report: Report) => <p className="text-sm text-slate-300 truncate max-w-xs" title={report.reason}>{report.reason}</p>,
    },
    {
      header: 'Status',
      accessorKey: 'status' as keyof Report,
      cell: (report: Report) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
          ${report.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : ''}
          ${report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
          ${report.status === 'ignored' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' : ''}
        `}>
          {report.status}
        </span>
      ),
    },
    {
      header: 'Date',
      accessorKey: 'created_at' as keyof Report,
      cell: (report: Report) => <span className="text-xs text-slate-400">{format(new Date(report.created_at), 'MMM d, HH:mm')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Reports Management</h1>
        <select 
          className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-md focus:ring-emerald-500/50 p-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
      </div>

      <AdminTable
        data={reports}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        actions={(report) => (
          <div className="flex justify-end space-x-2">
            {report.status === 'pending' && (
              <>
                <button onClick={() => handleResolve(report.id, 'resolved')} className="text-emerald-400 hover:text-emerald-300 p-1" title="Resolve">
                  <CheckCircle className="h-4 w-4" />
                </button>
                <button onClick={() => handleResolve(report.id, 'ignored')} className="text-slate-500 hover:text-slate-300 p-1" title="Ignore">
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      />
    </div>
  );
}

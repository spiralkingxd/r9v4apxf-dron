import { useEffect, useState } from 'react';
import { AdminTable } from '../../components/admin/AdminTable';
import api from '../../lib/api';
import { Trophy, Edit, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  title: string;
  status: 'draft' | 'open' | 'ongoing' | 'completed' | 'cancelled';
  start_date: string;
  max_teams: number;
  created_at: string;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/events', {
        params: { page, limit: 10, search },
      });
      setEvents(data.data);
      setTotalPages(Math.ceil(data.count / 10));
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, search]);

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/admin/events/${eventId}`);
      fetchEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event');
    }
  };

  const columns = [
    {
      header: 'Nome do Evento',
      accessorKey: 'title' as keyof Event,
      cell: (event: Event) => (
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-md bg-slate-800 flex items-center justify-center border border-slate-700">
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
          <span className="text-sm font-medium text-slate-200">{event.title}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status' as keyof Event,
      cell: (event: Event) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
          ${event.status === 'open' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
          ${event.status === 'draft' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' : ''}
          ${event.status === 'ongoing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
          ${event.status === 'completed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : ''}
          ${event.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
        `}>
          {event.status === 'draft' ? 'Rascunho' : 
           event.status === 'open' ? 'Aberto' : 
           event.status === 'ongoing' ? 'Em andamento' : 
           event.status === 'completed' ? 'Concluído' : 'Cancelado'}
        </span>
      ),
    },
    {
      header: 'Data de Início',
      accessorKey: 'start_date' as keyof Event,
      cell: (event: Event) => <span className="text-xs text-slate-400">{format(new Date(event.start_date), 'd MMM, yyyy HH:mm')}</span>,
    },
    {
      header: 'Máx. Equipes',
      accessorKey: 'max_teams' as keyof Event,
      cell: (event: Event) => <span className="text-xs text-slate-400">{event.max_teams}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gerenciamento de Eventos</h1>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Criar Evento
        </button>
      </div>

      <AdminTable
        data={events}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSearch={setSearch}
        loading={loading}
        searchPlaceholder="Buscar eventos..."
        actions={(event) => (
          <div className="flex justify-end space-x-2">
              <button className="text-slate-400 hover:text-emerald-400 p-1" title="Editar">
                <Edit className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(event.id)} className="text-slate-500 hover:text-red-500 p-1" title="Excluir">
                <Trash2 className="h-4 w-4" />
              </button>
          </div>
        )}
      />
    </div>
  );
}

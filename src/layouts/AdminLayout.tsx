import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/admin/Sidebar';
import { AdminHeader } from '../components/admin/Header';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col ml-64">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6 mt-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

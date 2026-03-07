import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Save } from 'lucide-react';

interface Setting {
  key: string;
  value: any;
  description: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings');
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (key: string, value: any) => {
    try {
      await api.put(`/admin/settings/${key}`, { value });
      alert('Setting updated successfully');
      fetchSettings();
    } catch (error) {
      console.error('Failed to update setting:', error);
      alert('Failed to update setting');
    }
  };

  if (loading) return <div>Carregando configurações...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Configurações do Sistema</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        {settings.map((setting) => (
          <div key={setting.key} className="space-y-2 pb-6 border-b border-slate-800 last:border-0 last:pb-0">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-slate-200 capitalize">{setting.key.replace('_', ' ')}</h3>
                <p className="text-sm text-slate-500">{setting.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <textarea
                className="flex-1 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-300 font-mono focus:ring-emerald-500/50 focus:border-emerald-500"
                rows={4}
                defaultValue={JSON.stringify(setting.value, null, 2)}
                onBlur={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleSave(setting.key, parsed);
                  } catch (err) {
                    alert('Formato JSON inválido');
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { teamService } from '../../services/teams';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const teamSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(50, 'Nome deve ter no máximo 50 caracteres'),
  ship_name: z.string().min(3, 'Nome do navio deve ter no mínimo 3 caracteres').max(50, 'Nome do navio deve ter no máximo 50 caracteres'),
  gamertag: z.string().min(3, 'Gamertag deve ter no mínimo 3 caracteres').max(50, 'Gamertag deve ter no máximo 50 caracteres'),
  logo_url: z.string().url('URL inválida').regex(/\.(jpg|jpeg|png|webp)$/i, 'Formato inválido (png, jpg, webp)').optional().or(z.literal('')),
});

type TeamFormData = z.infer<typeof teamSchema>;

export const TeamForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
  });

  const logoUrl = watch('logo_url');

  React.useEffect(() => {
    if (logoUrl) {
      setLogoPreview(logoUrl);
    } else {
      setLogoPreview(null);
    }
  }, [logoUrl]);

  const onSubmit = async (data: TeamFormData) => {
    setLoading(true);
    setError(null);
    try {
      await teamService.createTeam(data);
      navigate('/dashboard/teams');
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Erro ao criar equipe. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-ocean-lighter border border-gold/20 rounded-2xl p-8">
      <h2 className="text-2xl font-serif font-bold text-gold mb-6 uppercase tracking-wider">Criar Nova Equipe</h2>
      
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-parchment-muted mb-2">
              Nome da Equipe
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="w-full bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-2 text-parchment focus:outline-none focus:ring-2 focus:ring-gold/50"
              placeholder="Ex: The Salty Dogs"
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="ship_name" className="block text-sm font-medium text-parchment-muted mb-2">
              Nome do Navio
            </label>
            <input
              id="ship_name"
              type="text"
              {...register('ship_name')}
              className="w-full bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-2 text-parchment focus:outline-none focus:ring-2 focus:ring-gold/50"
              placeholder="Ex: The Black Pearl"
            />
            {errors.ship_name && (
              <p className="text-red-400 text-sm mt-1">{errors.ship_name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="gamertag" className="block text-sm font-medium text-parchment-muted mb-2">
              Sua Gamertag (Capitão)
            </label>
            <input
              id="gamertag"
              type="text"
              {...register('gamertag')}
              className="w-full bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-2 text-parchment focus:outline-none focus:ring-2 focus:ring-gold/50"
              placeholder="Ex: CaptainJack"
            />
            {errors.gamertag && (
              <p className="text-red-400 text-sm mt-1">{errors.gamertag.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="logo_url" className="block text-sm font-medium text-parchment-muted mb-2">
            URL da Logo (Opcional)
          </label>
          <div className="flex gap-4">
            <input
              id="logo_url"
              type="text"
              {...register('logo_url')}
              className="flex-1 bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-2 text-parchment focus:outline-none focus:ring-2 focus:ring-gold/50"
              placeholder="https://exemplo.com/logo.png"
            />
            {logoPreview && (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gold/20">
                <img 
                  src={logoPreview} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={() => setLogoPreview(null)}
                />
              </div>
            )}
          </div>
          {errors.logo_url && (
            <p className="text-red-400 text-sm mt-1">{errors.logo_url.message}</p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/teams')}
            className="px-4 py-2 text-parchment-muted hover:text-parchment mr-4 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-gold hover:bg-gold-light text-ocean rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Equipe
          </button>
        </div>
      </form>
    </div>
  );
};

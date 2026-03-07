import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { teamService, Team, TeamMember } from '../../services/teams';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const teamSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(50, 'Nome deve ter no máximo 50 caracteres'),
  gamertag: z.string().min(3, 'Gamertag deve ter no mínimo 3 caracteres').max(50, 'Gamertag deve ter no máximo 50 caracteres'),
  logo_url: z.string().url('URL inválida').regex(/\.(jpg|jpeg|png|webp)$/i, 'Formato inválido (png, jpg, webp)').optional().or(z.literal('')),
  members: z.array(z.object({
    gamertag: z.string().min(3, 'Gamertag deve ter no mínimo 3 caracteres').max(50, 'Gamertag deve ter no máximo 50 caracteres'),
  })).min(1, 'Pelo menos um membro é necessário').max(10, 'Máximo de 10 membros'),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamFormProps {
  team?: Team;
  onClose: () => void;
}

export const TeamForm: React.FC<TeamFormProps> = ({ team, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(team?.logo_url || null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: team ? {
      name: team.name,
      logo_url: team.logo_url || '',
      gamertag: team.members?.find(m => m.role === 'captain')?.gamertag || '',
      members: team.members?.map(m => ({ gamertag: m.gamertag })) || [],
    } : {
      members: [{ gamertag: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "members"
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
      if (team) {
        await teamService.updateTeam(team.id, data);
      } else {
        await teamService.createTeam(data);
      }
      onClose();
      window.location.reload(); // Refresh to update list
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError(`Erro ao ${team ? 'atualizar' : 'criar'} equipe. Tente novamente.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-ocean-lighter border border-gold/20 rounded-2xl p-8">
      <h2 className="text-2xl font-serif font-bold text-gold mb-6 uppercase tracking-wider">{team ? 'Editar Equipe' : 'Criar Nova Equipe'}</h2>
      
      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <div className="col-span-1">
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

          {!team && (
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
                disabled={!!team}
              />
              {errors.gamertag && (
                <p className="text-red-400 text-sm mt-1">{errors.gamertag.message}</p>
              )}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-parchment-muted mb-2">
              Membros ({fields.length}/10)
            </label>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <input
                    {...register(`members.${index}.gamertag`)}
                    className="flex-1 bg-ocean-light border border-ocean-lighter rounded-lg px-4 py-2 text-parchment focus:outline-none focus:ring-2 focus:ring-gold/50"
                    placeholder="Gamertag do membro"
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {fields.length < 10 && (
                <button
                  type="button"
                  onClick={() => append({ gamertag: '' })}
                  className="w-full py-2 border border-dashed border-ocean-lighter rounded-lg text-parchment-muted hover:text-gold hover:border-gold/50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Membro
                </button>
              )}
            </div>
            {errors.members && (
              <p className="text-red-400 text-sm mt-1">{errors.members.message}</p>
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
            onClick={onClose}
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
            {team ? 'Atualizar Equipe' : 'Criar Equipe'}
          </button>
        </div>
      </form>
    </div>
  );
};

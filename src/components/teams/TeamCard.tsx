import React from 'react';
import { Link } from 'react-router-dom';
import { Team } from '../../services/teams';
import { Users, Shield } from 'lucide-react';

interface TeamCardProps {
  team: Team;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  return (
    <div className="bg-ocean-lighter border border-ocean-lighter rounded-2xl p-6 hover:border-gold/30 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          {team.logo_url ? (
            <img src={team.logo_url} alt={team.name} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 bg-ocean-light rounded-lg flex items-center justify-center text-gold">
              <Shield className="w-6 h-6" />
            </div>
          )}
          <h3 className="text-xl font-serif font-bold text-parchment">{team.name}</h3>
        </div>
        <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
          team.status === 'active' ? 'bg-emerald-light/20 text-emerald-light' : 'bg-red-900/20 text-red-400'
        }`}>
          {team.status === 'active' ? 'Ativa' : 'Banida'}
        </span>
      </div>
      
      <div className="flex items-center justify-between mt-4 border-t border-ocean-lighter pt-4">
        <div className="flex items-center text-parchment-muted text-sm font-mono">
          <Users className="w-4 h-4 mr-2" />
          <span>{team.members?.length || 0}/10 Membros</span>
        </div>
        
        <Link 
          to={`/dashboard/teams/${team.id}`}
          className="text-gold hover:text-gold-light text-sm font-bold transition-colors"
        >
          Gerenciar &rarr;
        </Link>
      </div>
    </div>
  );
};

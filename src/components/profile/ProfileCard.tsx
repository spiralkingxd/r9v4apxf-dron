import React from 'react';
import { Mail, Hash, Calendar } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  email: string;
  discord_id: string;
  xbox_gamertag: string | null;
  xbox_linked: boolean;
  registered_at: string;
}

interface ProfileCardProps {
  profile: Profile;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile }) => {
  return (
    <div className="glass-panel rounded-2xl p-8 border border-gold/20 flex flex-col md:flex-row items-center md:items-start gap-8">
      <div className="relative">
        <img 
          src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name || profile.username}&background=0D1B2A&color=D4AF37`} 
          alt={profile.display_name} 
          className="w-32 h-32 rounded-full border-4 border-ocean-lighter shadow-[0_0_20px_rgba(212,175,55,0.2)]"
        />
        <div className="absolute -bottom-2 -right-2 bg-ocean-light border border-gold/30 rounded-full p-2">
          <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord" className="w-5 h-5" />
        </div>
      </div>
      
      <div className="flex-1 text-center md:text-left">
        <h2 className="text-3xl font-serif font-bold text-parchment mb-1">{profile.display_name || profile.username}</h2>
        <p className="text-gold font-mono text-sm mb-6">@{profile.username}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 text-parchment-muted bg-ocean-light/50 p-3 rounded-lg border border-ocean-lighter">
            <Mail className="w-5 h-5 text-gold/70" />
            <span className="text-sm truncate">{profile.email}</span>
          </div>
          
          <div className="flex items-center gap-3 text-parchment-muted bg-ocean-light/50 p-3 rounded-lg border border-ocean-lighter">
            <Hash className="w-5 h-5 text-gold/70" />
            <span className="text-sm font-mono">{profile.discord_id}</span>
          </div>
          
          <div className="flex items-center gap-3 text-parchment-muted bg-ocean-light/50 p-3 rounded-lg border border-ocean-lighter sm:col-span-2">
            <Calendar className="w-5 h-5 text-gold/70" />
            <span className="text-sm">Membro desde {new Date(profile.registered_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

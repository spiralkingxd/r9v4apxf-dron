import React from 'react';
import { Gamepad2, AlertCircle } from 'lucide-react';

interface XboxStatusProps {
  xboxLinked: boolean;
  xboxGamertag: string | null;
}

export const XboxStatus: React.FC<XboxStatusProps> = ({ xboxLinked, xboxGamertag }) => {
  return (
    <div className={`glass-panel rounded-2xl p-6 border ${xboxLinked ? 'border-emerald-light/30' : 'border-red-900/30'} relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full blur-2xl transition-all ${xboxLinked ? 'bg-emerald-light/10' : 'bg-red-900/10'}`}></div>
      
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-xl border shadow-[0_0_15px_rgba(0,0,0,0.2)] ${xboxLinked ? 'bg-emerald-900/40 border-emerald-light/20 text-emerald-light' : 'bg-red-900/40 border-red-900/20 text-red-400'}`}>
          <Gamepad2 className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-serif text-xl font-bold uppercase tracking-wider text-parchment">Conta Xbox</h3>
          <p className={`text-sm font-bold ${xboxLinked ? 'text-emerald-light' : 'text-red-400'}`}>
            {xboxLinked ? 'Vinculada via Discord' : 'Não vinculada'}
          </p>
        </div>
      </div>
      
      {xboxLinked ? (
        <div className="bg-ocean-light/50 border border-ocean-lighter rounded-lg p-4 flex items-center justify-between">
          <span className="text-parchment-muted text-sm uppercase tracking-wider">Gamertag</span>
          <span className="font-mono text-lg font-bold text-gold">{xboxGamertag}</span>
        </div>
      ) : (
        <div className="bg-ocean-light/50 border border-red-900/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-parchment-muted leading-relaxed">
            Sua conta Xbox não está vinculada. Para participar dos torneios, você precisa vincular sua conta Xbox nas <strong>Configurações de Conexões do Discord</strong> e fazer login novamente.
          </p>
        </div>
      )}
    </div>
  );
};


"use client";

import { useState } from "react";
import { Eye, EyeOff, Bot } from "lucide-react";
import { AdminButton } from "@/components/admin/admin-button";
import { getBotCredentials } from "@/app/admin/dashboard/actions";

export function BotAccessCard() {
  const [revealed, setRevealed] = useState(false);
  const [creds, setCreds] = useState<{ url: string; username: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getBotCredentials();
      setCreds(data);
      setRevealed(true);
    } catch (err) {
      setError("Sem permissao para visualizar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-surface flex flex-col justify-between space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--accent-purple)]/20 text-[color:var(--accent-purple)]">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-[color:var(--text-strong)]">Acesso Bots</h3>
          <p className="text-xs text-[color:var(--text-muted)]">Painel de controle do Bot</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--bg-soft)] p-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Usuario</label>
          <div className="font-mono text-sm text-[color:var(--text-strong)]">
            {revealed && creds ? creds.username : ""}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Senha</label>
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm text-[color:var(--text-strong)]">
              {revealed && creds ? creds.password : ""}
            </div>
            <button
              type="button"
              onClick={handleReveal}
              disabled={loading}
              className="ml-2 rounded-md p-1.5 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-border)] hover:text-[color:var(--text-strong)] transition-colors focus:outline-none"
              title={revealed ? "Ocultar senha" : "Ver credenciais"}
            >
              {loading ? (
                 <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
              ) : revealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
        </div>
      </div>

      <div className="pt-2">
        <a
          href={creds?.url || "https://733a2f2f6d61646e6573736172656e612-f74732e75702e7261696c7761792e.up.railway.app/login?next=/}
          target="_blank"
          rel="noopener noreferrer"
        >
          <AdminButton type="button" className="w-full justify-center">
            Acessar Painel
          </AdminButton>
        </a>
      </div>
    </div>
  );
}


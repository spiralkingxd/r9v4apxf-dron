import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import api from '../lib/api';

interface User {
  id: string;
  username: string;
  avatar: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Função para mapear o usuário do Supabase para o nosso formato
  const mapSupabaseUser = (sbUser: SupabaseUser | null): User | null => {
    if (!sbUser) return null;
    
    // Extrai os dados do metadata do Discord
    const metadata = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      username: metadata.custom_claims?.global_name || metadata.full_name || metadata.name || 'Usuário',
      avatar: metadata.avatar_url || '',
      email: sbUser.email || '',
    };
  };

  const checkAdminStatus = async (userId: string) => {
    try {
      // 1. Check Env Var (Super Admin)
      // Note: We need the Discord ID for this check. 
      // The user object from Supabase Auth (sbUser) has user_metadata.provider_id or sub.
      // But here we only have userId (UUID).
      // We can check if the current session user's metadata matches.
      const { data: { session } } = await supabase.auth.getSession();
      const discordId = session?.user?.user_metadata?.provider_id || session?.user?.user_metadata?.sub;
      const envAdminId = import.meta.env.VITE_ADMIN_DISCORD_ID || import.meta.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;

      if (envAdminId && discordId === envAdminId) {
        setIsAdmin(true);
        return;
      }

      // 2. Check Database Roles
      const { data, error } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
         console.error('Error checking admin role:', error);
      }
      
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Erro ao verificar status de admin:', error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // Verifica erros na URL ao carregar (ex: retorno do OAuth com erro)
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      
      if (error) {
        console.error('Erro de autenticação detectado na URL:', error, errorDescription);
        if (error === 'server_error' && errorDescription?.includes('Database error')) {
           alert('Erro crítico ao criar seu usuário no banco de dados. \n\nCausa provável: O Trigger "handle_new_user" no Supabase falhou.\n\nSolução: O administrador precisa rodar a migração de correção "20240306000001_fix_handle_new_user.sql".');
        } else {
           alert(`Falha no login: ${errorDescription || error}`);
        }
        // Limpa a URL para não ficar mostrando o erro se der refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Modo Real: Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.provider_token) {
        // Sync Discord data
        try {
          await api.post('/auth/discord/sync', {
            provider_token: session.provider_token
          }, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
        } catch (error) {
          console.error('Erro ao sincronizar dados do Discord:', error);
        }
      }

      const mappedUser = mapSupabaseUser(session?.user ?? null);
      setUser(mappedUser);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
      setIsLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.provider_token) {
          try {
            await api.post('/auth/discord/sync', {
              provider_token: session.provider_token
            }, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
          } catch (error) {
            console.error('Erro ao sincronizar dados do Discord:', error);
          }
        }

        const mappedUser = mapSupabaseUser(session?.user ?? null);
        setUser(mappedUser);
        if (session?.user) {
          checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
        }
        setIsLoading(false);
      });

      return () => subscription.unsubscribe();
    };

    initAuth();
  }, []);

  const login = async () => {
    if (!isSupabaseConfigured()) {
      alert('Supabase não configurado. Por favor, configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      return;
    }

    const redirectTo = window.location.origin;
    console.log('🔐 Iniciando login com Discord. URL de redirecionamento:', redirectTo);

    try {
      // O Supabase redireciona automaticamente para a página atual após o login
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo,
          scopes: 'identify email connections',
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao iniciar login com Supabase:', error);
      alert('Erro ao iniciar login. Verifique as configurações do Supabase.');
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

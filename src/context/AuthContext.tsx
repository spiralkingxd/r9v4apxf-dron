import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

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
      // Verifica no banco se o usuário tem a role 'admin'
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === 'admin');
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
      const mappedUser = mapSupabaseUser(session?.user ?? null);
      setUser(mappedUser);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
      setIsLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

    const redirectTo = `${window.location.origin}/dashboard`;
    console.log('🔐 Iniciando login com Discord. URL de redirecionamento:', redirectTo);

    try {
      // O Supabase redireciona automaticamente para a página atual após o login
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo,
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

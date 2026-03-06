import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

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

// Segurança: Axios configurado para enviar cookies (Sessão HttpOnly) automaticamente
const api = axios.create({
  withCredentials: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
      
      // Segurança: A verificação de admin real acontece no backend.
      // Aqui no frontend, apenas checamos se a rota protegida de admin retorna sucesso
      // para exibir ou ocultar botões.
      try {
        await api.get('/api/admin/stats');
        setIsAdmin(true);
      } catch (adminError) {
        setIsAdmin(false);
      }
    } catch (error) {
      // Segurança: Não logar stack traces no cliente
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Listen for OAuth success message from popup
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const login = async () => {
    try {
      const response = await api.get('/api/auth/url');
      const { url } = response.data;

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Por favor, permita popups para este site para conectar sua conta.');
      }
    } catch (error) {
      console.error('Erro ao iniciar login.');
      alert('Erro ao iniciar login. Verifique as configurações.');
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Erro ao fazer logout.');
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

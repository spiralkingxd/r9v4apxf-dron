import { createClient } from '@supabase/supabase-js';

// No Vite, as variáveis de ambiente públicas começam com VITE_
// No Next.js, elas começam com NEXT_PUBLIC_
// Para manter a compatibilidade com o pedido do usuário (Next.js) e o ambiente atual (Vite),
// vamos tentar ler ambas.

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Anon Key não configurados. Verifique suas variáveis de ambiente.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

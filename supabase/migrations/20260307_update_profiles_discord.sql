-- Alter table profiles com novas colunas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xbox_gamertag TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xbox_linked BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id ON public.profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_xbox_linked ON public.profiles(xbox_linked);

-- RLS policies atualizadas
-- Permitir que o usuário veja seu próprio email, mas ocultar de outros
-- Como RLS funciona por linha, não podemos ocultar colunas facilmente sem views.
-- Mas podemos garantir que o perfil seja público, exceto o email, que pode ser tratado na aplicação ou com uma view.
-- O prompt diz "NÃO expor email de outros usuários no frontend". Isso será feito no código.

-- Script de migração para usuários existentes
-- Atualizar registered_at para created_at se for nulo
UPDATE public.profiles SET registered_at = created_at WHERE registered_at IS NULL;

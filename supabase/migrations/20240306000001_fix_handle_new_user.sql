-- Correção da função handle_new_user para evitar erros de NOT NULL em username
-- e melhorar a extração de dados do JSON do Discord

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id, username, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'provider_id',
    COALESCE(
      new.raw_user_meta_data->'custom_claims'->>'global_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'Unknown Pirate'
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

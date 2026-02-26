-- Novos usuários não têm plano. Só recebem plano ao resgatar trial Pro (segredo) ou comprar.
-- subscription_status: 'inactive' = sem plano; 'trial' = trial Pro; 'active' = pago; 'expired' = expirado
-- subscription_tier: NULL = sem plano; 'basic'/'pro'/'satoshi' = após resgate ou compra

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, subscription_status, subscription_tier)
  VALUES (
    new.id,
    COALESCE(new.email, new.raw_user_meta_data->>'email', ''),
    'inactive',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

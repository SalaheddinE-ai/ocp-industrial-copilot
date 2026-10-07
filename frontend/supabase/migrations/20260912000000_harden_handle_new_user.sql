-- Defensive hardening of handle_new_user(): a failure inside this
-- trigger (e.g. an unexpected constraint issue) must never be able to
-- block auth.users signup itself. This does not fix a misconfigured
-- OAuth provider or SMTP setup (those live in the Supabase dashboard,
-- not in SQL) -- it only ensures the profile-creation side effect
-- degrades gracefully instead of surfacing as a 500 on signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log and continue: a profile row can be backfilled later, but a
    -- failed INSERT here must not prevent the auth.users row (and the
    -- user's ability to sign in) from being created.
    RAISE WARNING 'handle_new_user: failed to create profile for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

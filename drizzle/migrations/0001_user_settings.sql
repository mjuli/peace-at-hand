CREATE TABLE public.settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  bell_start text NOT NULL DEFAULT 'tigela',
  bell_end text NOT NULL DEFAULT 'tigela',
  bell_volume real NOT NULL DEFAULT 0.7,
  ambient text NOT NULL DEFAULT 'silencio',
  ambient_volume real NOT NULL DEFAULT 0.5,
  prep_seconds integer NOT NULL DEFAULT 10,
  return_days integer NOT NULL DEFAULT 7,
  return_dismissed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings select" ON public.settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own settings insert" ON public.settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings update" ON public.settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_settings() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_settings
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

INSERT INTO public.settings (user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
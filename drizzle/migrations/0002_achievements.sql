CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  codigo text NOT NULL,
  desbloqueada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);
GRANT SELECT, INSERT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own achievements select" ON public.achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own achievements insert" ON public.achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL CHECK (tipo IN ('jornada','livre','manual')),
  duracao_min integer NOT NULL CHECK (duracao_min > 0),
  concluida_em timestamptz NOT NULL DEFAULT now(),
  fase integer,
  check_numero integer,
  humor smallint CHECK (humor BETWEEN 1 AND 5),
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions select" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sessions_user_idx ON public.sessions(user_id, concluida_em DESC);

CREATE TABLE public.checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  fase integer NOT NULL CHECK (fase BETWEEN 3 AND 30),
  check_numero integer NOT NULL CHECK (check_numero >= 1),
  session_id uuid REFERENCES public.sessions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reset_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.checks TO authenticated;
GRANT ALL ON public.checks TO service_role;
ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checks select" ON public.checks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own checks insert" ON public.checks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checks update" ON public.checks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX checks_user_active_idx ON public.checks(user_id) WHERE reset_at IS NULL;
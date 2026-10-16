ALTER TABLE public.sessions ADD COLUMN planned_minutes integer, ADD COLUMN extra_seconds integer NOT NULL DEFAULT 0;
UPDATE public.sessions SET planned_minutes = duracao_min WHERE planned_minutes IS NULL;
COMMENT ON COLUMN public.sessions.duracao_min IS 'Total minutes meditated (planned_minutes + whole minutes of extra_seconds)';
ALTER TABLE public.settings ADD COLUMN count_up boolean NOT NULL DEFAULT true;